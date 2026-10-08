/**
 * dropdown-demo: three Dropdowns and a custom widget, driven by the keyboard.
 *
 * The entry for `npm run demo:dropdown` and for the demo's card on the docs
 * site alike. In the card it runs on the page's stand-in process, so the
 * terminal it builds is the card's, at the card's size, with the card's keys.
 * The app hands the terminal back on every path out — Ctrl-C inside the demo,
 * a signal, a crash — so there is nothing to restore here.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: demo:dropdown requires an interactive terminal.\n");
  process.exit(1);
}

await runDemo(host).done;
host.write("\x1b[1;36mGoodbye!\x1b[0m\n");
