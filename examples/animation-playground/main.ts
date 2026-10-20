/**
 * animation-playground: every kind of motion rich-js has, under pause,
 * reverse, scrub, speed, reduced motion, colour depth and frame rate.
 *
 * THIS IS A DEMO. The entry for `npm run animation-playground` and for the
 * demo's card on the docs site alike. In the card it runs on the page's
 * stand-in process, so the terminal is the card's, at the card's size, with
 * the card's keys and pointer. The app hands the terminal back on every path
 * out, so there is nothing to restore here.
 */
import { systemClock } from "@promptctl/rich-js";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { run } from "./playground.js";

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: npm run animation-playground requires an interactive terminal.\n");
  process.exit(1);
}

await run(host, systemClock());
