/**
 * terminal-colors — the terminal asked for its own foreground and background,
 * and a frame drawn against what it answered.
 *
 * THIS IS A DEMO: `terminalColors` (`src/host/terminal-colors.ts`) over
 * `App.ask`. The app starts on the terminal the color depth assumes, asks
 * with OSC 10 and OSC 11, and from then on draws against the answer: the
 * panel shows both colors as swatches and says whether the terminal answered.
 * A terminal that does not support the queries answers DA1 alone, and the app
 * keeps the colors it assumed. Any key quits.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { App, terminalColors } from "../../src/host/index.js";
import { Panel, RichText, Style } from "../../src/index.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: terminal-colors requires an interactive terminal.\n");
  process.exit(1);
}

let heard = "asking…";

const app = new App({
  host,
  surface: "inline",
  view: () => {
    const { foregroundColor, backgroundColor } = app.terminal;
    const swatch = (label: string, hex: string): RichText =>
      RichText.assemble([`${label.padEnd(11)}`, ["      ", Style.parse(`on ${hex}`)], ` ${hex}`]);
    const body = RichText.assemble([
      swatch("foreground", foregroundColor.hex),
      "\n",
      swatch("background", backgroundColor.hex),
      [`\n\n${heard} · any key quits`, Style.parse("dim")],
    ]);
    return new Panel(body, { title: "terminal-colors", expand: false });
  },
});

app.onKey(() => app.stop());
const running = app.run();
const learned = await terminalColors(app);
heard = learned === undefined ? "the terminal did not say; these are assumed" : "the terminal's own colors";
if (learned !== undefined) app.terminal = learned;
app.refresh();
await running;
