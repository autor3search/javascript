import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { beforeEach, describe, expect, it } from 'vitest'
import { clearStop, forceRequested, requestForceStop, requestStop, stopRequested } from '../../src/state/stop.js'

let dir
beforeEach(async () => {
  dir = join(await mkdtemp(join(tmpdir(), 'a3s-stop-')), 'run')
})

describe('stop sentinel', () => {
  it('reports no request before one is made', async () => {
    expect(await stopRequested(dir)).toBe(false)
  })

  it('creates the state directory rather than failing on a missing one', async () => {
    // A human reaching for the brake must never be told the directory does
    // not exist yet.
    await requestStop(dir)
    expect(await stopRequested(dir)).toBe(true)
  })

  it('is idempotent', async () => {
    await requestStop(dir)
    await requestStop(dir)
    expect(await stopRequested(dir)).toBe(true)
  })

  it('clears a pending request', async () => {
    await requestStop(dir)
    await clearStop(dir)
    expect(await stopRequested(dir)).toBe(false)
  })

  it('does not error clearing a request that was never made', async () => {
    await expect(clearStop(dir)).resolves.toBeUndefined()
  })

  it('reports false rather than throwing when the sentinel is unreadable', async () => {
    // A stop that cannot be read must never abort a run by itself — the human
    // still has --force and Ctrl+C.
    await rm(dir, { recursive: true, force: true })
    expect(await stopRequested(dir)).toBe(false)
  })

  it('reports no forced stop before one is made', async () => {
    expect(await forceRequested(dir)).toBe(false)
  })

  it('creates the state directory for a forced stop rather than failing on a missing one', async () => {
    await requestForceStop(dir)
    expect(await forceRequested(dir)).toBe(true)
  })

  it('is idempotent for a forced stop', async () => {
    await requestForceStop(dir)
    await requestForceStop(dir)
    expect(await forceRequested(dir)).toBe(true)
  })

  it('keeps the two sentinels independent', async () => {
    // A graceful stop must not read as a forced one: the first lets the
    // experiment finish and be scored, the second throws it away.
    await requestStop(dir)
    expect(await forceRequested(dir)).toBe(false)
    await rm(dir, { recursive: true, force: true })
    await requestForceStop(dir)
    expect(await stopRequested(dir)).toBe(false)
  })

  it('clears both sentinels at once', async () => {
    // One brake, one release. A --clear that left the forced marker behind
    // would abort every later eval on this tag with no way to tell why.
    await requestStop(dir)
    await requestForceStop(dir)
    await clearStop(dir)
    expect(await stopRequested(dir)).toBe(false)
    expect(await forceRequested(dir)).toBe(false)
  })

  it('reports false rather than throwing when the forced sentinel is unreadable', async () => {
    await rm(dir, { recursive: true, force: true })
    expect(await forceRequested(dir)).toBe(false)
  })
})
