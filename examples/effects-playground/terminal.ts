/**
 * effects-playground in a real terminal — one effect's program, played here
 * as the page's panel plays it, beside it: every edit, slider, run control,
 * replay and restart made on the page is made here too, in place.
 *
 * THIS IS A DEMO for comparing a terminal's rendering with the page's; run it
 * while the playground's dev server is up:
 *
 *   npm run effects-playground:terminal -- <effect> [server]
 *
 * It runs the program as a panel runs it (edits.ts) — on the live library
 * the server builds, under the docs' simulated process — but writes to this
 * terminal, and follows the page through the server (mirror.ts). q or
 * Ctrl-C quits.
 */
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { EFFECTS } from "../effects-feel/vocabulary.js";
import { CONTROL_DEFAULTS, type Controls, type Heard } from "./controls.js";
import { edit, started, told } from "./edits.js";
import { EVENTS_PATH, LIBRARY_PATH, type Said } from "./mirror.js";

const USAGE = `npm run effects-playground:terminal -- <${EFFECTS.join(" | ")}> [server, default http://localhost:5199]`;

const effect = EFFECTS.find((e) => e === process.argv[2]);
if (effect === undefined) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}
const server = process.argv[3] ?? "http://localhost:5199";

const response = await fetch(`${server}${LIBRARY_PATH}`).catch((error: unknown) => {
  process.stderr.write(`no playground server at ${server} (${String(error)}); start it with npm run effects-playground\n`);
  process.exit(1);
});
const library = await response.text();

/** Leave the alternate screen the program drew on, show the cursor, and end. */
function quit(code: number): never {
  process.stdout.write("\x1b[?1049l\x1b[?25h");
  process.exit(code);
}

/** The latest the page has said: the run controls, and the program (none until the server has sent it). */
let controls: Controls = CONTROL_DEFAULTS;
let source: string | undefined;

/**
 * The program, once it is running and listening. Until then what the page
 * says is only remembered, and the program is told the latest once it listens.
 */
let type: ((chunk: string) => void) | undefined;

function start(begun: string, under: Controls): void {
  let deliver: (chunk: string) => void = () => {};
  void runInTerminal(started(begun, library, under), {
    columns: process.stdout.columns,
    rows: process.stdout.rows,
    isTTY: true,
    env: { TERM: process.env["TERM"] ?? "xterm-256color", COLORTERM: process.env["COLORTERM"] ?? "truecolor" },
    write: (chunk) => void process.stdout.write(chunk),
    onInput: (to) => (deliver = to),
    exit: quit,
  }).then(() => {
    type = deliver;
    // What the page said while the program was starting.
    if (source !== begun) type(edit(source!));
    if (controls !== under) type(told({ kind: "controls", controls }));
  });
}

function hear(said: Said): void {
  const tell = (heard: Heard): void => type?.(told(heard));
  switch (said.kind) {
    case "controls":
      controls = said.controls;
      return tell({ kind: "controls", controls });
    case "replay":
      return tell({ kind: "replay" });
    case "source":
    case "restart": {
      const first = source === undefined;
      source = said.source;
      if (first) return start(source, controls);
      if (said.kind === "restart") tell({ kind: "restart" });
      return type?.(edit(source));
    }
  }
}

// A bad edit rejects where nothing awaits it; the program plays on as it was,
// and the error is shown on the last row.
process.on("unhandledRejection", (error) => {
  const line = String(error instanceof Error ? error.message : error).split("\n")[0]!;
  process.stdout.write(`\x1b7\x1b[${process.stdout.rows};1H\x1b[2K\x1b[31m${line}\x1b[0m\x1b8`);
});

process.stdin.setRawMode?.(true);
process.stdin.on("data", (key: Buffer) => {
  const pressed = key.toString();
  if (pressed === "q" || pressed === "\x03") quit(0);
});

const events = await fetch(`${server}${EVENTS_PATH}?effect=${effect}`);
const decoder = new TextDecoder();
let buffer = "";
for await (const chunk of events.body!) {
  buffer += decoder.decode(chunk as Uint8Array, { stream: true });
  for (let end = buffer.indexOf("\n\n"); end !== -1; end = buffer.indexOf("\n\n")) {
    const event = buffer.slice(0, end);
    buffer = buffer.slice(end + 2);
    if (event.startsWith("data: ")) hear(JSON.parse(event.slice("data: ".length)) as Said);
  }
}
process.stdout.write("\x1b[?1049l\x1b[?25h");
process.stderr.write(`the playground server at ${server} went away\n`);
process.exit(1);
