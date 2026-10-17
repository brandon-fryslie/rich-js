/**
 * A demo's rows read whole in the terminal its card opens (its card.json): a
 * row wider than that is cut at the edge — a panel title mid-word, a status
 * line on a dangling separator — and what is cut off is gone, not wrapped.
 *
 * What a row should read is what the demo draws with room to spare. So each
 * demo runs twice, in a roomy terminal and in its card's, and every run of
 * words the roomy screens show has to be on the card's screens too. The
 * screens are xterm's model of the terminal the demo wrote to, so what is
 * compared is what a person sees.
 *
 * Only some rows can be cut that way. A panel's body wraps to the panel's
 * width, so its words land on different rows at different widths; the rows
 * read here are the ones that do not wrap — a panel's top border with its
 * title, a rule with its own, and every row drawn outside a box.
 */
import { expect, it } from "vitest";
import path from "node:path";
import xterm from "@xterm/headless";
import { cardJson } from "../../docs/.vitepress/demo-card.js";
import { REPO_ROOT } from "../../scripts/repo-facts.js";
import { scriptedHost, type ScriptedHost } from "../host/scripted-host.js";
import { runDemo as runTemplateBindings } from "../../examples/rich-template-bindings/app.js";
import { runDemo as runDropdownDemo } from "../../examples/dropdown-demo/app.js";

interface Size { readonly cols: number; readonly rows: number }

/** Starts a demo on `host`; the function it returns stops it, settling once it has. */
type Demo = (host: ScriptedHost) => () => Promise<void>;

/** The keys to type, read off the screen the demo first paints. */
type Keys = (first: readonly string[]) => readonly string[];

const ROOMY: Size = { cols: 240, rows: 200 };
const PAGE_DOWN = "\x1b[6~";

const cardSize = (demo: string): Size => {
  const { columns, rows } = cardJson(path.join(REPO_ROOT, "examples", demo)).screen.terminal;
  return { cols: columns, rows };
};

const painted = () => new Promise((resolve) => setTimeout(resolve));

/** The screen after the demo first paints, and again after each of `keys`. */
async function screens(demo: Demo, size: Size, keys: Keys): Promise<string[][]> {
  const host = scriptedHost(size);
  const term = new xterm.Terminal({ ...size, allowProposedApi: true });
  let fed = 0;
  const read = async (): Promise<string[]> => {
    await painted();
    const out = host.output();
    await new Promise<void>((resolve) => term.write(out.slice(fed), resolve));
    fed = out.length;
    const buffer = term.buffer.active;
    return Array.from({ length: size.rows }, (_, i) => buffer.getLine(buffer.viewportY + i)!.translateToString(true));
  };
  const stop = demo(host);
  const shown = [await read()];
  for (const key of keys(shown[0]!)) {
    host.type(key);
    shown.push(await read());
  }
  await stop();
  term.dispose();
  return shown;
}

const BOX_RUN = /[─-╿]+/;
// A box's top border, where its title sits, or a rule.
const TITLE_ROW = /^[╭┌┏╔─━═]/;

/** The rows of `screen` that a too-narrow terminal cuts rather than wraps. */
function unwrappedRows(screen: readonly string[]): string[] {
  return screen.map((line) => line.trimStart()).filter((row) => !BOX_RUN.test(row) || TITLE_ROW.test(row));
}

const wordRuns = (row: string): string[] => row.split(BOX_RUN).map((words) => words.trim()).filter((words) => words !== "");

/**
 * Every run of words on the roomy screens' unwrapped rows that no unwrapped
 * row at `size` shows whole. Only those rows are searched: the same words in a
 * panel body elsewhere on screen do not make a cut row whole.
 */
async function cut(demo: Demo, size: Size, keys: Keys): Promise<string[]> {
  const roomy = (await screens(demo, ROOMY, keys)).flatMap(unwrappedRows).flatMap(wordRuns);
  expect(roomy, "the demo painted no rows to compare").not.toEqual([]);
  const shown = (await screens(demo, size, keys)).flatMap(unwrappedRows);
  return [...new Set(roomy)].filter((words) => !shown.some((row) => row.includes(words)));
}

const templateBindings: Demo = (host) => {
  const demo = runTemplateBindings(host);
  return () => {
    demo.stop();
    return demo.done;
  };
};

// One page fewer than the header's §n/N count shows every section from
// wherever it starts: the section on show outlives a run, and paging wraps.
const EVERY_SECTION: Keys = (first) => {
  const header = /§\d+\/(\d+)/.exec(first.join("\n"));
  if (header === null) throw new Error("rich-template-bindings drew no §n/N section header");
  return Array.from({ length: Number(header[1]) - 1 }, () => PAGE_DOWN);
};

it("every row of rich-template-bindings reads whole in its card's terminal", async () => {
  expect(await cut(templateBindings, cardSize("rich-template-bindings"), EVERY_SECTION)).toEqual([]);
});

// `npm run template-bindings` runs in whatever terminal it is given, and
// eighty columns is the one most terminals open at.
it("every row of rich-template-bindings reads whole eighty columns wide", async () => {
  expect(await cut(templateBindings, { cols: 80, rows: ROOMY.rows }, EVERY_SECTION)).toEqual([]);
});

it("every row of dropdown-demo reads whole in its card's terminal", async () => {
  const dropdownDemo: Demo = (host) => {
    const done = runDropdownDemo(host);
    return () => {
      host.type("\x03");
      return done;
    };
  };
  // Two rows widen with the numbers they read out. Picking the long list's
  // last item makes the status row as wide as it gets; the key echo grows with
  // its claimed-space count, and backspace is the longest key name it echoes.
  const widest: Keys = () => [
    "\t", "\r", ...Array.from({ length: 17 }, () => "\x1b[B"), "\r",
    "\t", "\t", " ".repeat(100), "\x7f",
  ];
  expect(await cut(dropdownDemo, cardSize("dropdown-demo"), widest)).toEqual([]);
});
