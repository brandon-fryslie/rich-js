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

const ROOMY: Size = { cols: 240, rows: 200 };
const PAGE_DOWN = "\x1b[6~";

const cardSize = (demo: string): Size => {
  const { columns, rows } = cardJson(path.join(REPO_ROOT, "examples", demo)).screen.terminal;
  return { cols: columns, rows };
};

const painted = () => new Promise((resolve) => setTimeout(resolve));

/** The screen after the demo first paints, and again after each of `keys`. */
async function screens(demo: Demo, size: Size, keys: readonly string[]): Promise<string[][]> {
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
  for (const key of keys) {
    host.type(key);
    shown.push(await read());
  }
  await stop();
  return shown;
}

const BOX_RUN = /[─-╿]+/;

/** The runs of words on the rows of `screen` that a too-narrow terminal cuts rather than wraps. */
function unwrappedWords(screen: readonly string[]): string[] {
  return screen.flatMap((line) => {
    const row = line.trimStart();
    const boxed = BOX_RUN.test(row);
    if (boxed && !row.startsWith("╭") && !row.startsWith("─")) return [];
    return row.split(BOX_RUN).map((words) => words.trim()).filter((words) => words !== "");
  });
}

/** Every run of words the roomy screens show that no screen at `size` shows whole. */
async function cut(demo: Demo, size: Size, keys: readonly string[]): Promise<string[]> {
  const roomy = (await screens(demo, ROOMY, keys)).flatMap(unwrappedWords);
  const shown = (await screens(demo, size, keys)).flat();
  return [...new Set(roomy)].filter((words) => !shown.some((line) => line.includes(words)));
}

const templateBindings: Demo = (host) => {
  const demo = runTemplateBindings(host);
  return () => {
    demo.stop();
    return demo.done;
  };
};

// Four pages down from wherever it starts shows all five sections: the
// section on show outlives a run, and paging wraps.
const EVERY_SECTION = [PAGE_DOWN, PAGE_DOWN, PAGE_DOWN, PAGE_DOWN];

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
  expect(await cut(dropdownDemo, cardSize("dropdown-demo"), [])).toEqual([]);
});
