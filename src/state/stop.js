/**
 * The sentinel coordinating between the human's shell and the agent's loop.
 *
 * It lives out-of-tree alongside the rest of the run state, for the same
 * reason everything else there does: a sentinel inside the repository would
 * dirty the working tree the agent commits from, and would have to be
 * special-cased in the scope gate and in .gitignore. Out here it is invisible
 * to every gate and to git, and both `stop` and `eval` still find it because
 * the state directory is derived from the repository path and run tag, not
 * from anything either process holds privately.
 */
import { rm, stat, writeFile } from 'node:fs/promises'
import { ensureSecureDir } from './index.js'
import { join } from 'node:path'

/**
 * Marks that the human has asked the run to end. `eval` reports its presence
 * alongside the verdict; the AGENT decides when to act on it, which is what
 * makes a graceful stop graceful — nothing here interrupts an experiment
 * already under way.
 */
export const STOP_REQUEST_FILE = 'stop.request'

/**
 * Marks that the human has asked the run to abandon what it is measuring RIGHT
 * NOW, rather than after the current experiment.
 *
 * A marker rather than a signal, because a signal cannot cross processes on
 * every platform this harness supports. Windows has no process-to-process
 * SIGTERM or SIGINT; Node implements `process.kill` there as TerminateProcess,
 * so the target dies where it stands — its `finally` never runs, `eval` exits
 * with a null code instead of 2, and its claim is left behind to go stale.
 * Polling a file behaves identically everywhere. It also closes a race that
 * exists on POSIX, where signalling a pid read from a file can reach an
 * unrelated process the OS has since recycled that pid onto.
 *
 * STICKY, and deliberately so: an unattended agent loop starts a fresh `eval`
 * seconds after the last one exits, so a marker consumed by the eval it aborts
 * would be gone before the loop's next iteration read it — the human hits the
 * brake and the run carries on regardless. Only `clearStop` removes it.
 */
export const STOP_FORCE_FILE = 'stop.force'

/**
 * Asks the run in stateDir to end after the current experiment.
 *
 * Creating stateDir when missing is deliberate: a human reaching for the
 * brake should never be told the directory does not exist yet. A request
 * against a tag whose baseline never finished is harmless — the sentinel
 * simply sits there until a run reads it, or clearStop removes it.
 */
export async function requestStop(stateDir) {
  await ensureSecureDir(stateDir)
  await writeFile(join(stateDir, STOP_REQUEST_FILE), 'stop requested\n')
}

/**
 * Asks the eval running in stateDir to abandon its experiment at once.
 *
 * Creates stateDir for the same reason requestStop does: a human reaching for
 * the brake should never be told the directory does not exist yet.
 */
export async function requestForceStop(stateDir) {
  await ensureSecureDir(stateDir)
  await writeFile(join(stateDir, STOP_FORCE_FILE), 'forced stop requested\n')
}

/**
 * Reports whether a forced stop is pending. Boolean rather than throwing, for
 * the same reason stopRequested is: an unreadable sentinel and an absent one
 * deserve the same answer, and a marker that cannot be read must never abort a
 * run by itself.
 *
 * @returns {Promise<boolean>}
 */
export async function forceRequested(stateDir) {
  return stat(join(stateDir, STOP_FORCE_FILE)).then(
    () => true,
    () => false,
  )
}

/**
 * Cancels both pending requests — one brake, one release. Clearing one never
 * made is not an error.
 */
export async function clearStop(stateDir) {
  await rm(join(stateDir, STOP_REQUEST_FILE), { force: true })
  await rm(join(stateDir, STOP_FORCE_FILE), { force: true })
}

/**
 * Reports whether a stop is pending.
 *
 * Returns a boolean rather than throwing, because every caller wants the same
 * answer for an unreadable sentinel as for an absent one: carry on. A stop
 * that cannot be read must never abort a run by itself.
 *
 * @returns {Promise<boolean>}
 */
export async function stopRequested(stateDir) {
  return stat(join(stateDir, STOP_REQUEST_FILE)).then(
    () => true,
    () => false,
  )
}
