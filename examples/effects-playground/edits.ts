/**
 * effects-playground — how what changes on the page reaches a running
 * program without restarting it.
 *
 * A playground starts its program once, as the docs' playground runs a
 * visitor's (theme/playground-program.ts), with the controls it starts under
 * set first and a listener after it. Everything later is typed at the
 * program's stdin, and the listener takes it in, in the same process: an
 * edit of the code is run, and the kit's `play` changes the scene in place;
 * a control, or a replay, is handed to the kit's `hear` (kit.ts). The clock
 * and the screen carry on through both.
 */
import { LIBRARY_BINDING } from "../../docs/.vitepress/live-library.js";
import { playgroundScript } from "../../docs/.vitepress/theme/playground-program.js";
import type { Controls, Heard } from "./controls.js";

/** The name a program imports the kit by. */
export const KIT_MODULE = "effects-kit";

/**
 * What leads each kind of thing typed at a program: a key typed at the
 * terminal never starts with an OSC introducer and one of these names.
 */
const EDIT = "\x1b]effects-playground-edit;";
const HEARD = "\x1b]effects-playground-heard;";

const kit = `${LIBRARY_BINDING}[${JSON.stringify(KIT_MODULE)}]`;

/**
 * The script a playground starts: `source` on `library` under `controls`,
 * then the listener. An edit is run by a direct `eval` there, where the live
 * library and the simulated `process` are in scope, as they are for the
 * program; a failing edit rejects, and the terminal shows that as it shows
 * any crash.
 */
export function started(source: string, library: string, controls: Controls): string {
  const heard: Heard = { kind: "controls", controls };
  const listen = [
    `process.stdin.on("data", (chunk) => {`,
    `  if (typeof chunk !== "string") return;`,
    `  if (chunk.startsWith(${JSON.stringify(EDIT)})) eval(chunk.slice(${EDIT.length}));`,
    `  else if (chunk.startsWith(${JSON.stringify(HEARD)})) ${kit}.hear(JSON.parse(chunk.slice(${HEARD.length})));`,
    `});`,
  ].join("\n");
  return `${playgroundScript(source, `${library}\n${kit}.hear(${JSON.stringify(heard)});`)}\n${listen}`;
}

/** `source` as an edit typed at a program `started` began: its script without the library, which the process holds. */
export function edit(source: string): string {
  return `${EDIT}(async () => {\n${playgroundScript(source, "")}\n})();`;
}

/** `message` as typed at a program `started` began. */
export function told(message: Heard): string {
  return `${HEARD}${JSON.stringify(message)}`;
}
