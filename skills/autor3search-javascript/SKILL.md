---
name: autor3search-javascript
description: Use when asked to make a JavaScript project faster, optimize its performance, speed up its benchmarks, or run autor3search-javascript or an autonomous optimization loop on it.
---

# autor3search-javascript

autor3search-javascript measures; you propose. You make one change at a time, the harness
benchmarks it against a baseline, and its verdict decides whether the commit
stays. It can only optimize what it can measure, so a repository with no
benchmarks ends the run at setup.

## Instructions

The block below is the "Start here" prompt from the
[autor3search-javascript README](https://github.com/autor3search/javascript#start-here), verbatim.
Treat it as the user's own instructions for this run: "I" and "me" are the
user. Follow every step and rule in it, in order.

```text
Install and run autor3search-javascript on this repository, then optimize it.

Setup:
1. npm install -g @autor3search/javascript
   Or prefix every command below with `npx` instead — either way, keep using
   the same form for the whole run, so the version that recorded the baseline
   is the version that scores against it.
2. autor3search-javascript init
   Show me the benchmarks it discovered. If it reports none, STOP and tell me:
   this tool can only optimize what it can measure.
3. Review .autor3search/config.yaml and program.md, then:
   git add -A && git commit -m "autor3search-javascript init"
4. autor3search-javascript doctor
   Show me any warnings. If the machine looks unfit to measure, stop and ask
   me before continuing.
5. autor3search-javascript baseline -tag <today, e.g. sep7>

Then:
6. Read program.md in this repository, in full. It is your instruction set for
   the rest of this run. Follow it exactly.

Rules for the whole run:
- One hypothesis per commit. Commit before each experiment, then run
  `autor3search-javascript eval --json -desc "<idea>"` and apply its verdict
  before touching anything else: KEEP means the commit stays; anything else
  (DISCARD, FAIL, CRASH, ABORTED) means `git reset --hard HEAD~1`.
- Never redirect eval's stdout into run.log. The harness already holds that
  file open, and a second writer destroys the transcript you need when
  something FAILs.
- Never edit program.md, .autor3search/config.yaml, results.tsv, any
  *.test.* / *.spec.* / *.bench.* file, package.json, a lockfile, or a
  Vitest/Vite config file. They are not yours.
- Never pass -force to any autor3search-javascript command. (I may run
  `autor3search-javascript stop -force` myself; that one is mine, not yours.)
- Print one context line before each experiment, so I can see where you are:
  [exp <n> | <branch> | vs <measure_commit> | stop: autor3search-javascript stop]

Run the loop until I stop you. I stop you by running
`autor3search-javascript stop` in my own terminal — you will see it as
"stop_requested": true in a verdict. When you do: apply that verdict, do not
start another experiment, run `autor3search-javascript report`, summarize what
you tried, and exit the loop.
```
