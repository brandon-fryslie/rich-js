/**
 * rich-strip: every built-in `Joiner`, printed one after another.
 *
 * The entry for `npm run strip` and for the demo's card on the docs site
 * alike. In the card it runs on the page's stand-in process, so the terminal
 * it builds is the card's.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();
try {
  runDemo(host);
} finally {
  host.stop();
}
