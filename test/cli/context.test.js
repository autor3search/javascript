import { mkdtemp } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import * as gitx from '../../src/gitx.js'
import { expandSingleDashFlags, loadRepoConfig, resolveRepo, resolveRun } from '../../src/cli/context.js'
import { STATE_HOME_ENV } from '../../src/state/index.js'
import { makeRepo, writeFiles } from '../helpers/repo.js'

const original = process.env[STATE_HOME_ENV]
beforeEach(async () => {
  process.env[STATE_HOME_ENV] = await mkdtemp(join(tmpdir(), 'a3s-ctx-home-'))
})
afterEach(() => {
  if (original === undefined) delete process.env[STATE_HOME_ENV]
  else process.env[STATE_HOME_ENV] = original
})

describe('resolveRepo', () => {
  it('finds the repository root from a subdirectory', async () => {
    const dir = await makeRepo({ 'src/a.js': 'export const a = 1\n' })
    expect(await resolveRepo(join(dir, 'src'))).toContain('a3s-repo-')
  })

  it('explains itself when the directory is not a git repository', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'a3s-notgit-'))
    await expect(resolveRepo(dir)).rejects.toThrow(/not inside a git repository/)
  })
})

describe('resolveRun', () => {
  it('infers the tag from a run branch', async () => {
    const dir = await makeRepo()
    await gitx.createBranch(dir, 'autor3search-javascript/sep7')
    const run = await resolveRun(dir)
    expect(run.tag).toBe('sep7')
    expect(run.branch).toBe('autor3search-javascript/sep7')
  })

  it('refuses to guess a tag from a non-run branch', async () => {
    const dir = await makeRepo()
    await expect(resolveRun(dir)).rejects.toThrow(/-tag/)
  })

  it('lets an explicit tag win over the branch', async () => {
    const dir = await makeRepo()
    await gitx.createBranch(dir, 'autor3search-javascript/sep7')
    expect((await resolveRun(dir, 'other')).tag).toBe('other')
  })

  it('rejects a tag that would escape the state directory', async () => {
    const dir = await makeRepo()
    for (const bad of ['../escape', 'a/b', '.', '..']) {
      await expect(resolveRun(dir, bad)).rejects.toThrow()
    }
  })

  it('gives different runs different state directories', async () => {
    // The whole point: a command must never act on another run's state.
    const dir = await makeRepo()
    const a = await resolveRun(dir, 'tagA')
    const b = await resolveRun(dir, 'tagB')
    expect(a.stateDir).not.toBe(b.stateDir)
  })

  it('gives different repositories different state directories for the same tag', async () => {
    const one = await makeRepo()
    const two = await makeRepo()
    expect((await resolveRun(one, 'same')).stateDir).not.toBe((await resolveRun(two, 'same')).stateDir)
  })
})

describe('loadRepoConfig', () => {
  it('names the command to run when there is no config', async () => {
    const dir = await makeRepo()
    await expect(loadRepoConfig(dir)).rejects.toThrow(/init/)
  })

  it('loads a valid config', async () => {
    const dir = await makeRepo()
    await writeFiles(dir, { '.autor3search/config.yaml': 'count: 8\n' })
    expect((await loadRepoConfig(dir)).count).toBe(8)
  })
})

describe('expandSingleDashFlags', () => {
  // The real `stop` declaration: one string option, two booleans, and the
  // single-character -C. Passing the parseArgs options themselves is the
  // point — a hand-kept list of names is what let -force go unexpanded.
  const STOP_OPTIONS = {
    C: { type: 'string' },
    tag: { type: 'string' },
    clear: { type: 'boolean' },
    force: { type: 'boolean' },
  }

  it('rewrites a documented single-dash flag into the form parseArgs accepts', () => {
    expect(expandSingleDashFlags(['-tag', 'sep7'], STOP_OPTIONS)).toEqual(['--tag', 'sep7'])
  })

  it('leaves single-character flags and long forms alone', () => {
    expect(expandSingleDashFlags(['-C', '/tmp', '--tag', 'x'], STOP_OPTIONS)).toEqual(['-C', '/tmp', '--tag', 'x'])
  })

  it('does not rewrite a VALUE that looks like a flag', () => {
    // `-desc "-tag is confusing"` must keep its value verbatim.
    const options = { desc: { type: 'string' }, tag: { type: 'string' } }
    expect(expandSingleDashFlags(['-desc', '-tag'], options)).toEqual(['--desc', '-tag'])
  })

  it('leaves an unrelated token untouched', () => {
    expect(expandSingleDashFlags(['-nope', 'x'], STOP_OPTIONS)).toEqual(['-nope', 'x'])
  })

  it('rewrites a single-dash BOOLEAN flag, which README documents for stop', () => {
    expect(expandSingleDashFlags(['-force'], STOP_OPTIONS)).toEqual(['--force'])
    expect(expandSingleDashFlags(['-clear'], STOP_OPTIONS)).toEqual(['--clear'])
  })

  it('does not swallow the token after a boolean flag', () => {
    // A boolean takes no value, so the token after it is another flag and must
    // still be expanded. Treating it as a value is what made the first attempt
    // at this fix wrong: `-force -tag t` became `['--force', '-tag', 't']` and
    // died on "Unknown option '-t'" — one bug traded for a subtler one.
    expect(expandSingleDashFlags(['-force', '-tag', 't'], STOP_OPTIONS)).toEqual(['--force', '--tag', 't'])
  })

  it('still treats a string option as taking a value, in either order', () => {
    expect(expandSingleDashFlags(['-tag', 't', '-force'], STOP_OPTIONS)).toEqual(['--tag', 't', '--force'])
  })
})
