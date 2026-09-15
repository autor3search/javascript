import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { STATE_HOME_ENV, stateDir } from '../../src/state/index.js'
import { forceRequested, stopRequested } from '../../src/state/stop.js'
import { runCli } from '../helpers/cli.js'
import { makeBenchRepo } from '../helpers/bench-repo.js'
import { commitFiles } from '../helpers/repo.js'

const original = process.env[STATE_HOME_ENV]
beforeEach(async () => {
  process.env[STATE_HOME_ENV] = await mkdtemp(join(tmpdir(), 'a3s-stop-home-'))
})
afterEach(() => {
  if (original === undefined) delete process.env[STATE_HOME_ENV]
  else process.env[STATE_HOME_ENV] = original
})

async function ready() {
  const dir = await makeBenchRepo()
  await runCli(['init', '-C', dir])
  await commitFiles(dir, {}, 'init')
  await runCli(['baseline', '-C', dir, '-tag', 't'])
  return dir
}

describe('stop', () => {
  it('writes a request the next eval will report', async () => {
    const dir = await ready()
    const { code, out } = await runCli(['stop', '-C', dir])
    expect(code).toBe(0)
    expect(await stopRequested(await stateDir(dir, 't'))).toBe(true)
    expect(out).toMatch(/after the current experiment/)
  })

  it('clears a pending request with --clear', async () => {
    const dir = await ready()
    await runCli(['stop', '-C', dir])
    const { code, out } = await runCli(['stop', '-C', dir, '--clear'])
    expect(code).toBe(0)
    expect(await stopRequested(await stateDir(dir, 't'))).toBe(false)
    expect(out).toMatch(/cancelled/i)
  })

  it('says plainly when --force finds no eval running', async () => {
    const dir = await ready()
    const { code, out } = await runCli(['stop', '-C', dir, '--force'])
    expect(code).toBe(0)
    expect(out).toMatch(/no eval is running/i)
    expect(out).toMatch(/will abort the next eval/i)
  })

  it('still writes the request when --force finds no eval running to abandon', async () => {
    const dir = await ready()
    await runCli(['stop', '-C', dir, '--force'])
    expect(await stopRequested(await stateDir(dir, 't'))).toBe(true)
  })

  it('warns a later plain stop that a forced stop from earlier is still pending', async () => {
    // stop --force issued while nothing was running leaves the marker sticky
    // — it aborts the NEXT eval, not this session's. A human who later runs
    // plain `stop` (forgetting --clear) must not be told the current
    // experiment will be measured: there may be no current experiment, and
    // the marker will still take out whichever eval starts next.
    const dir = await ready()
    await runCli(['stop', '-C', dir, '--force'])
    const { code, out } = await runCli(['stop', '-C', dir])
    expect(code).toBe(0)
    expect(out).toMatch(/forced stop from earlier is still pending/i)
    expect(out).not.toMatch(/will still be measured/i)
  })

  it('writes the forced marker, not just the graceful request', async () => {
    const dir = await ready()
    await runCli(['stop', '-C', dir, '--force'])
    expect(await forceRequested(await stateDir(dir, 't'))).toBe(true)
  })

  it('leaves no forced marker behind for a graceful stop', async () => {
    // The two brakes mean different things: graceful finishes and scores the
    // experiment, forced throws it away.
    const dir = await ready()
    await runCli(['stop', '-C', dir])
    expect(await forceRequested(await stateDir(dir, 't'))).toBe(false)
  })

  it('--clear removes a forced marker too', async () => {
    const dir = await ready()
    await runCli(['stop', '-C', dir, '--force'])
    await runCli(['stop', '-C', dir, '--clear'])
    expect(await forceRequested(await stateDir(dir, 't'))).toBe(false)
  })

  it('reports the repository state and does not change it', async () => {
    const dir = await ready()
    const { out } = await runCli(['stop', '-C', dir, '--force'])
    expect(out).toMatch(/git reset --hard HEAD~1/)
    const { isClean } = await import('../../src/gitx.js')
    expect(await isClean(dir)).toBe(true)
  })

  it('rejects --clear together with --force', async () => {
    const dir = await ready()
    const { code, err } = await runCli(['stop', '-C', dir, '--clear', '--force'])
    expect(code).not.toBe(0)
    expect(err).toMatch(/--clear and --force/)
  })

  it('works from another branch when given -tag', async () => {
    const dir = await ready()
    const { checkout } = await import('../../src/gitx.js')
    await checkout(dir, 'main')
    expect((await runCli(['stop', '-C', dir, '-tag', 't'])).code).toBe(0)
  })
})
