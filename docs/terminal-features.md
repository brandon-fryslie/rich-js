# Terminal Features

A terminal can do more than draw cells: show a progress indicator in its tab
or dock, change its tab color, raise a notification. Each terminal spells these
differently, some not at all, and a multiplexer such as tmux sits between and
decides what reaches the terminal behind it. rich-js chooses what to send from
**capabilities**, not terminal names. A name is evidence toward a capability,
and how good that evidence is goes with it.

## Evidence and policy

Every fact about the terminal carries how it is known:

| Evidence | Meaning |
| --- | --- |
| `declared` | The program stated it. |
| `confirmed` | The terminal answered a probe for it. |
| `identified` | The terminal named itself and its version. |
| `inferred` | The environment suggests it (`TERM_PROGRAM`, `LC_TERMINAL`). An inherited variable or ssh can make it wrong. |
| `unknown` | Nothing says either way. |

Each encoding also records what a terminal *without* it does on receiving it:
`ignored`, drawn as `garbage`, or `misread` as a different request. The policy
weighs the two:

- **`strict`** (the default) acts on `declared`, `confirmed` and `identified` evidence.
- **`bestGuess`** also acts on `inferred` evidence, but only for an encoding a miss ignores.

OSC 9;4 progress is `misread` where it is unsupported: bare OSC 9 is a
notification, so a terminal that lacks 9;4 would pop up "4;1;50". On the
environment's word alone it is therefore never sent.

## Layers

Between the program and the terminal sits a stack of **layers**, innermost
first: tmux, screen, zellij, an editor's terminal. Each encoding says how each
kind of layer treats it:

- `native`: the layer understands it.
- `passthrough`: it reaches the terminal only wrapped, which tmux forwards when `allow-passthrough` is on.
- `impossible`: it cannot cross the layer.

Each passthrough layer adds one wrap, so tmux inside tmux doubles every ESC twice.

## The send log

Every decision is reported to `onSend`, including the ones that write nothing,
each with its reason:

```ts
import { Console, Progress, declareCapabilities, type TerminalSend } from "@promptctl/rich-js";

const log: TerminalSend[] = [];
const console = new Console({
  forceTerminal: true,
  environment: { env: { TERM: "xterm-256color" } },
  file: { write: () => {} },
  terminalFeatures: {
    capabilities: declareCapabilities(["OSC 9;4"]),
    layers: [{ kind: "tmux", passthrough: "declared" }],
    onSend: (send) => log.push(send),
  },
});

const progress = new Progress({ console, autoRefresh: false });
progress.start();
const task = progress.addTask("copying", { total: 4 });
progress.updateTask(task, { completed: 2 });
progress.refresh();
progress.stop();

for (const send of log) globalThis.console.log(`${send.feature}: ${send.bytes === undefined ? "not sent" : "sent"} (${send.reason})`);
```

## Progress

A `Progress` on a `Live` declares its tasks to the terminal's own indicator,
summed across every progress display on the frame. A task with no total, or
one not yet started, makes it indeterminate. Declarations go through the
render pass's commit, so a measurement, a hidden display and a frame nobody saw
declare nothing. The painter that owns the terminal sends only what changed,
and takes the indicator away when it hands the terminal back.

`npm run terminal-features` shows it on your terminal. Add `-- --declare` to
state your terminal reads OSC 9;4 (iTerm2, Ghostty, Windows Terminal), and
`-- --tmux` to state tmux passes it through.
