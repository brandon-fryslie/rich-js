/**
 * terminal-features — a Progress mirrored in the terminal's own progress
 * indicator (the tab, the dock, the taskbar), with every decision the library
 * made about sending it printed afterwards: the send log.
 *
 * THIS IS A DEMO: `ConsoleOptions.terminalFeatures` (`src/core/terminal-capabilities.ts`).
 * Run bare, the environment's word alone sends nothing, and the log says why:
 * OSC 9;4 is misread as a notification by a terminal that lacks it. Give
 * `--declare` to state your terminal reads OSC 9;4 (iTerm2, Ghostty, Windows
 * Terminal), and `--tmux` to state tmux's `allow-passthrough` is on.
 */

import { Console, Progress, declareCapabilities, type TerminalSend } from "../../src/index.js";

const flags = new Set(process.argv.slice(2));
const log: TerminalSend[] = [];
const console = new Console({
  terminalFeatures: {
    ...(flags.has("--declare") ? { capabilities: declareCapabilities(["OSC 9;4"]) } : {}),
    ...(flags.has("--tmux") ? { layers: [{ kind: "tmux", passthrough: "declared" }] } : {}),
    onSend: (send) => log.push(send),
  },
});

const progress = new Progress({ console });
progress.start();
const task = progress.addTask("working", { total: 40 });
for (let step = 0; step < 40; step++) {
  await new Promise((resolve) => setTimeout(resolve, 75));
  progress.updateTask(task, { advance: 1 });
}
progress.stop();

for (const send of log) console.print(`[dim]${send.feature}[/] ${send.bytes === undefined ? "[yellow]not sent[/]" : "[green]sent[/]"} ${send.reason}`, { markup: true, highlight: false });
