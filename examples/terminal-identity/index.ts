/**
 * terminal-identity — the terminal asked who it is, and what the answer makes
 * of what the environment said.
 *
 * THIS IS A DEMO: `askTerminalIdentity` (`src/host/terminal-version.ts`) over
 * `App.ask`. The panel shows the terminal and layers the environment
 * inferred, then, once XTVERSION is answered, the same with the answer
 * weighed in: a terminal that names itself is `identified`, which a `strict`
 * policy acts on; under tmux, tmux answers for itself and the terminal past it
 * stays inferred. A terminal that does not implement XTVERSION changes
 * nothing. Any key quits.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { App, askTerminalIdentity } from "../../src/host/index.js";
import { Panel, RichText, Style, type TerminalFeatures } from "../../src/index.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: terminal-identity requires an interactive terminal.\n");
  process.exit(1);
}

const describe = ({ capabilities: { terminal }, layers }: TerminalFeatures): string =>
  `${terminal.name} (${terminal.evidence}: ${terminal.source})` + (layers.length === 0 ? "" : ` behind ${layers.map((layer) => layer.kind).join(", ")}`);

let asked = "asking…";

const app = new App({
  host,
  surface: "inline",
  view: () => {
    const body = RichText.assemble([`environment  ${environment}\n`, `answer       ${asked}`, ["\n\nany key quits", Style.parse("dim")]]);
    return new Panel(body, { title: "terminal-identity", expand: false });
  },
});
const environment = describe(app.terminalFeatures);

app.onKey(() => app.stop());
// Settled now, so a frame that throws while the ask is out is held here, not
// left an unhandled rejection; it is rethrown when awaited below.
const running = app.run();
const ended = running.then(
  () => undefined,
  (error: unknown) => ({ error }),
);
const learned = await askTerminalIdentity(app);
// A key may have stopped the app while the ask was out.
if (app.phase === "running") {
  if (learned === undefined) {
    asked = "nothing learned";
  } else {
    app.terminalFeatures = learned;
    asked = describe(learned);
  }
  app.refresh();
}
const outcome = await ended;
if (outcome !== undefined) throw outcome.error;
