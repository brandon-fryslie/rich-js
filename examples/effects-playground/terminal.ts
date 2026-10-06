/**
 * effects-playground in a real terminal — the effects' programs, played here
 * one under another as the page's panels play them, beside it: every edit,
 * slider, run control, replay and restart made on the page is made here too,
 * in place.
 *
 * THIS IS A DEMO for comparing a terminal's rendering with the page's; run it
 * while the playground's dev server is up:
 *
 *   npm run effects-playground:terminal -- [effect …] [--server=<url>]
 *
 * Every effect when none is named. It runs the programs as the panels run
 * theirs (edits.ts) — on the live library the server builds, under the docs'
 * simulated process — but all in one process, each its own scene on the
 * kit's one stage (kit.ts), writing to this terminal; and it follows the
 * page through the server (mirror.ts). q or Ctrl-C quits.
 */
import { runInTerminal } from "../../docs/.vitepress/simulated-process.js";
import { EFFECTS, type EffectName } from "../effects-feel/vocabulary.js";
import { CONTROL_DEFAULTS, type Controls, type Heard } from "./controls.js";
import { edit, started, told } from "./edits.js";
import { EVENTS_PATH, LIBRARY_PATH, type Said } from "./mirror.js";

const USAGE = `npm run effects-playground:terminal -- [${EFFECTS.join(" | ")} …] [--server=<url>, default http://localhost:5199]`;

const args = process.argv.slice(2);
const server = args.find((a) => a.startsWith("--server="))?.slice("--server=".length) ?? "http://localhost:5199";
const named = args.filter((a) => !a.startsWith("--"));
const effects = named.map((name) => EFFECTS.find((e) => e === name));
if (effects.includes(undefined)) {
  process.stderr.write(`${USAGE}\n`);
  process.exit(2);
}

const response = await fetch(`${server}${LIBRARY_PATH}`).catch((error: unknown) => {
  process.stderr.write(`no playground server at ${server} (${String(error)}); start it with npm run effects-playground\n`);
  process.exit(1);
});
const library = await response.text();

/** Leave the alternate screen the programs drew on, show the cursor, and end. */
function quit(code: number): never {
  process.stdout.write("\x1b[?1049l\x1b[?25h");
  process.exit(code);
}

/** The latest the page has said: the run controls, and each effect's program. */
let controls: Controls = CONTROL_DEFAULTS;
const sources = new Map<EffectName, string>();

/**
 * The process playing them, once it is running and listening, and the
 * program of each effect it has been given. Until it listens, what the page
 * says is only remembered, and it is given the latest once it does.
 */
let type: ((chunk: string) => void) | undefined;
const given = new Map<EffectName, string>();
let givenControls: Controls | undefined;

/** Give the process every program and control the page has changed since it was last given them. */
function bringUp(): void {
  if (type === undefined) return;
  for (const [effect, source] of sources) {
    if (given.get(effect) === source) continue;
    given.set(effect, source);
    type(edit(source));
  }
  if (givenControls !== controls) {
    givenControls = controls;
    type(told({ kind: "controls", controls }));
  }
}

function start(effect: EffectName, source: string): void {
  let deliver: (chunk: string) => void = () => {};
  given.set(effect, source);
  givenControls = controls;
  void runInTerminal(started(source, library, controls), {
    columns: process.stdout.columns,
    rows: process.stdout.rows,
    isTTY: true,
    env: { TERM: process.env["TERM"] ?? "xterm-256color", COLORTERM: process.env["COLORTERM"] ?? "truecolor" },
    write: (chunk) => void process.stdout.write(chunk),
    onInput: (to) => (deliver = to),
    exit: quit,
  }).then(() => {
    type = deliver;
    bringUp();
  });
}

function hear(said: Said): void {
  const tell = (heard: Heard): void => type?.(told(heard));
  switch (said.kind) {
    case "controls":
      controls = said.controls;
      return bringUp();
    case "replay":
      return tell({ kind: "replay", scene: said.effect });
    case "source":
    case "restart": {
      const first = sources.size === 0;
      sources.set(said.effect, said.source);
      if (first) return start(said.effect, said.source);
      if (said.kind === "restart") tell({ kind: "restart", scene: said.effect });
      return bringUp();
    }
  }
}

// A bad edit rejects where nothing awaits it; the programs play on as they
// were, and the error is shown on the last row.
process.on("unhandledRejection", (error) => {
  const line = String(error instanceof Error ? error.message : error).split("\n")[0]!;
  process.stdout.write(`\x1b7\x1b[${process.stdout.rows};1H\x1b[2K\x1b[31m${line}\x1b[0m\x1b8`);
});

process.stdin.setRawMode?.(true);
process.stdin.on("data", (key: Buffer) => {
  const pressed = key.toString();
  if (pressed === "q" || pressed === "\x03") quit(0);
});

const query = effects.map((e) => `effect=${e}`).join("&");
const events = await fetch(`${server}${EVENTS_PATH}${query === "" ? "" : `?${query}`}`);
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
