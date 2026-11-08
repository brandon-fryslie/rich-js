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
environment's word alone it is therefore never sent. OSC 52 (clipboard), OSC
22 (pointer shape) and OSC 9 (notification) go the other way: a terminal
without them ignores them, so they are sent whatever the terminal is, under
either policy, wherever the layers let them through.

## Layers

Between the program and the terminal sits a stack of **layers**, innermost
first: tmux, screen, zellij, an editor's terminal. Each encoding says how each
kind of layer treats it:

- `native`: the layer understands it.
- `passthrough`: it reaches the terminal only wrapped, which tmux forwards when `allow-passthrough` is on.
- `impossible`: it cannot cross the layer.

Each passthrough layer adds one wrap, so tmux inside tmux doubles every ESC twice.
screen ends its wrap at the first string terminator, so it cannot carry another
layer's wrap, and a sequence that would need it to is not sent. Neither can a
`native` layer, which re-emits only the sequence itself.

Each layer carries two pieces of evidence: `evidence`, how it is known the
layer is there at all, and `passthrough`, how it is known that it forwards a
wrapped sequence. A layer found in the environment is `inferred` and its
passthrough is one nothing has confirmed, and no policy acts on that, so nothing that needs tmux's or screen's
passthrough is sent until the program passes the layer in with its passthrough
`declared`. A layer the program passes in without `evidence` is `declared` by
being passed; one that carries it — a console's own `terminalFeatures`, handed
back — keeps it.

## Asking the terminal who it is

`askTerminalIdentity(app)`, from `@promptctl/rich-js/host`, asks the terminal
an `App` runs on with XTVERSION (`CSI > 0 q`) and returns the app's features
with the answer weighed in, to set as `app.terminalFeatures`, or `undefined`
when it learned nothing. A terminal that
names itself (`kitty(0.35.2)`, `foot(1.16.2)`, `WezTerm …`, `iTerm2 …`,
`ghostty …`, `VTE(7802)`) becomes `identified`, which `strict` acts on, so foot gets OSC 777
and kitty OSC 99 instead of the OSC 9 fallback. Its answer also proves no tmux,
zellij or screen sits in front of it, so such a layer the environment inferred
is dropped. Nothing known more strongly than `identified` — declared by the
program, or confirmed by a probe — is replaced or dropped by an answer. A
terminal that does not implement XTVERSION answers DA1 alone, one that names
itself off that list says nothing a choice turns on, and one that says only what
was already known changes nothing: each way the result is `undefined`. A VTE
older than 0.54, which draws a query it does not know as text, is not asked.

Under tmux or zellij, the multiplexer answers for itself and becomes the
innermost layer. Where the environment had not seen that multiplexer, the
terminal it named was read off the multiplexer's own `TERM`, so it becomes
`other`, unless the program declared it. The terminal past it cannot be asked. A query wrapped in
tmux's passthrough reaches it, but tmux takes the reply for one of its own and
hands its body to the pane as keystrokes
([tmux#5530](https://github.com/tmux/tmux/issues/5530)), so no wrapped query is
sent. The terminal past a multiplexer, and whether its passthrough is on, stay
what the environment infers or what the program declares — a program that runs
`tmux display -p '#{client_termname}'` itself can pass the answer in.

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

const out = new Console();
for (const send of log) out.print(`${send.feature}: ${send.bytes === undefined ? "not sent" : "sent"} (${send.reason})`, { markup: false });
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

## Window chrome and the cursor

An `App` declares what the window and tab around it show through
`app.chrome`. The chrome holds the title, and in iTerm2 the tab's color, the
session's status under the tab's title (a colored dot, a line of text and that
text's color) and a badge drawn behind the session's text. Like the progress
indicator, it is state rather than a request. It is declared on every frame,
sent only when it changes, and given back on every way the app ends or
suspends. A field left out is the terminal's own.

```ts silent
import { ColorRgba, RichText } from "@promptctl/rich-js";
import { App } from "@promptctl/rich-js/host";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const app = new App({ host: new NodeTerminalHost(), surface: "alternate", view: new RichText("deploying…") });
const amber = new ColorRgba(224, 160, 32);
app.chrome = { title: "deploy", tabColor: amber, status: { indicator: amber, text: "3 of 7" }, badge: "prod" };
```

| Field | Sequence | Read by | Given back with |
| --- | --- | --- | --- |
| `title` | OSC 2, over XTWINOPS 22 (title push) | every terminal | XTWINOPS 23 (title pop) |
| `tabColor` | iTerm2 OSC 6 | iTerm2 | `OSC 6;1;bg;*;default` |
| `status` | iTerm2 OSC 21337 | iTerm2 | every field sent empty |
| `badge` | iTerm2 OSC 1337 `SetBadgeFormat` | iTerm2 | an empty badge |

The title is pushed onto the terminal's title stack before the app's first
title and popped when the app gives it back, so the window shows the title it
had before. A terminal without a title stack ignores both, and the app's title
then stays shown after it exits. tmux keeps a title per pane and has no stack
to push onto, so under tmux the title is sent natively and is not given back.
The iTerm2 fields need iTerm2 to be identified or declared under `strict`.
Behind tmux they go through its passthrough.

A focused `TextInput` colors the terminal's own cursor with the color its
drawn cursor cell would have, the theme's `primary` unless its `cursorStyle`
says otherwise. It uses OSC 12, and gives the terminal its own cursor color
back with OSC 112 when the field stops showing the cursor. tmux keeps a cursor
color per pane and re-emits it, so OSC 12 crosses tmux natively.

A tmux client that detaches and reattaches is often a different terminal, and
it has none of what reached it through passthrough. While an app holds the
terminal, it asks for focus reports (`CSI ? 1004 h`). With `focus-events on`
in its config, which is off by default, tmux reports focus-in when a client
attaches. On that report, or on a resize, the app sends again every part
whose bytes went through a passthrough envelope. Without `focus-events`, a
reattach from a terminal of the same size is not seen, and what went through
the passthrough stays lost until the app next takes the terminal. Only those
are sent again. What tmux took natively it re-emits itself, and a bare
terminal forgets nothing when its window loses focus.

## Events

Events are requests the program makes once, not state a frame keeps: a
notification, an attention request, a shell-integration mark. They go through
the console, which sends each only to a terminal someone is at, and never into
a capture or a pipe.

`Console.notify` raises a notification and returns its id. kitty takes an
urgency, buttons and a click report on it; a click on the notification or one
of its buttons comes back to the app as `onNotificationClick`, with the id and
the 1-based button or none. That report exists only while the program still
reads the terminal: after it exits, kitty types the report at whatever reads
next, so a program that asks for clicks must not outlive `App`'s hand-back.
Elsewhere the notification is shown as it would have been without them. An
urgency kitty does not know, or a button with no label, is a `TypeError` on
every terminal, so a bad call fails the same way wherever it runs.

`Console.requestAttention` asks iTerm2 to bounce the dock icon, fire its
fireworks, cancel a bounce, or bring the window forward. A `Progress` that
finishes or fails does not request attention itself: a renderable cannot send
during a render, so the program calls `requestAttention` when its task ends.

`Console.mark` writes OSC 133 zones for shell integration. `Prompt` opens its
prompt and input zones before it asks, so the prompt text its input draws is
part of the input, and closes the command once an answer is accepted. An answer
that never comes ends the command with a bare `D`, which carries no exit, so
what follows is not read as its input. Every other `Console.print` is one
output zone, including a `Live`'s final frame, so a terminal that folds or
selects by zone sees each print as a command's output.

## Underlines

Curly, dotted and dashed underlines (SGR `4:3`–`4:5`) and an underline's own
color (SGR 58) are [styles](./style.md#underlines), drawn on every run that
carries one, so they are not sent once like a request. A console decides once,
when it is made, whether its terminal draws each, and holds the answer on its
output target as `underlines`; nothing is sent, so neither decision reaches
`onSend`. kitty, WezTerm, foot, Ghostty, Alacritty, iTerm2, VTE and Windows
Terminal read them. A terminal that does not would draw
`4:3` as italic, so `bestGuess` does not act on the environment's word for
them. tmux and zellij parse them and redraw them for each client, and screen
and an editor's terminal do not carry them. Where a console does not send
them, a curly, dotted or dashed underline is written as a plain one and the
color is left out:

```ts
import { Console, declareCapabilities } from "@promptctl/rich-js";

const markup = "[curlyUnderline underlineColor red]spelled wrong[/]";
for (const declared of [[], ["SGR 4:n", "SGR 58"]]) {
  let bytes = "";
  const console = new Console({
    forceTerminal: true,
    colorSystem: "truecolor",
    file: { write: (text: string) => void (bytes += text) },
    terminalFeatures: { capabilities: declareCapabilities(declared) },
  });
  console.print(markup);
  new Console().print(JSON.stringify(bytes), { markup: false, highlight: false });
}
```
