/**
 * effects-feel — node bootstrap: the command line parsed, a node terminal
 * host presenting the colour depth it asked for, and the demo run on it.
 *
 * THIS IS A DEMO, built so the feel of each effect can be agreed before any
 * curve lands in `src/`. See `curves.ts`.
 */

import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { runDemo } from "./app.js";
import { USAGE, envAtDepth, parseSettings } from "./settings.js";

// A command line the demo cannot run is the user's to fix: say what was wrong
// and how to spell it, and exit 2, the usage-error code. Nothing has taken the
// terminal yet, so there is nothing to hand back.
function parsed(): ReturnType<typeof parseSettings> {
  try {
    return parseSettings(process.argv.slice(2));
  } catch (error) {
    console.error(`${error instanceof Error ? error.message : String(error)}\n\n${USAGE}`);
    process.exit(2);
  }
}

const settings = parsed();
if (settings === undefined) {
  console.log(USAGE);
} else {
  const host = new NodeTerminalHost({ env: envAtDepth(process.env, settings.depth) });
  await runDemo(host, settings).done;
}
