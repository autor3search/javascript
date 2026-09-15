/**
 * Shared resolution for every command: which repository, which run.
 *
 * Nothing here calls process.chdir. `-C` is threaded through as a value
 * instead, which is safer under concurrent invocations and lets the tests
 * exercise commands without mutating global state.
 */
import { CONFIG_PATH, loadConfig } from '../config.js'
import * as gitx from '../gitx.js'
import { BRANCH_PREFIX, stateDir, validTag } from '../state/index.js'
import { join } from 'node:path'

/**
 * Rewrites single-dash multi-character flags into the long form parseArgs
 * accepts.
 *
 * Node's parseArgs recognises a single dash ONLY for a single-character option
 * name, so `-C` works but `-tag` fails with "Unknown option '-t'" and `-desc`
 * with "Unknown option '-d'". This harness documents the single-dash spelling
 * throughout — program.md tells the agent to run `eval -desc "..."` and
 * `baseline -tag sep7` — so the tokens are normalised here rather than
 * changing a contract an agent already follows.
 *
 * Only an exact whole-token match is rewritten, so a VALUE that happens to
 * look like a flag (`-desc "-tag is confusing"`) is left alone.
 *
 * The parseArgs OPTIONS are the input, not a list of names, and that is
 * load-bearing. A hand-kept list is free to fall out of step with the
 * declaration beside it, and did: `stop` accepted `-tag` but not the `-force`
 * the README documents, so `stop -force` failed with "Unknown option '-f'"
 * until this was derived instead. Deriving it means a flag cannot be
 * documented, declared, and still unparseable.
 *
 * Whether a flag consumes the token after it comes from its declared `type`.
 * A boolean takes no value, so the next token is another flag and must still
 * be expanded — skipping it is what made `-force -tag t` die on "Unknown
 * option '-t'". Single-character names are left alone because parseArgs
 * already accepts them in single-dash form; `-C` must stay `-C`.
 *
 * @param {string[]} args
 * @param {Record<string, {type: string}>} options the same parseArgs options the caller parses with
 * @returns {string[]}
 */
export function expandSingleDashFlags(args, options) {
  const expandable = new Map(
    Object.entries(options)
      .filter(([name]) => name.length > 1)
      .map(([name, opt]) => [`-${name}`, opt.type !== 'boolean']),
  )
  let expectingValue = false
  return args.map((token) => {
    if (expectingValue) {
      expectingValue = false
      return token
    }
    if (expandable.has(token)) {
      expectingValue = expandable.get(token)
      return `--${token.slice(1)}`
    }
    return token
  })
}

/** The repository root containing dir. */
export async function resolveRepo(dir) {
  try {
    return await gitx.root(dir)
  } catch (err) {
    throw new Error(`${dir} is not inside a git repository: ${err.message}`, { cause: err })
  }
}

/**
 * Resolves the run a command should act on.
 *
 * The tag comes from `-tag` when given, otherwise from the checked-out branch
 * — which is why `status` and `stop` accept `-tag`: they are meant to work
 * from any branch, including one the agent is not on.
 *
 * @param {string} dir
 * @param {string} [tag]
 */
export async function resolveRun(dir, tag) {
  const root = await resolveRepo(dir)
  let resolved = tag
  if (!resolved) {
    const branch = await gitx.currentBranch(root)
    if (!branch.startsWith(BRANCH_PREFIX)) {
      throw new Error(
        `the checked-out branch ${JSON.stringify(branch)} is not a run branch, so there is no tag to ` +
          `infer — pass -tag <tag>`,
      )
    }
    resolved = branch.slice(BRANCH_PREFIX.length)
  }
  validTag(resolved)
  return {
    root,
    tag: resolved,
    branch: `${BRANCH_PREFIX}${resolved}`,
    stateDir: await stateDir(root, resolved),
  }
}

/** Loads the in-repo config, with a message naming what to run when absent. */
export async function loadRepoConfig(root) {
  try {
    return await loadConfig(join(root, CONFIG_PATH))
  } catch (err) {
    if (err.cause?.code === 'ENOENT') {
      throw new Error(`no ${CONFIG_PATH} in ${root}: run 'autor3search-javascript init' first`, { cause: err })
    }
    throw err
  }
}
