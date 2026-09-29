/**
 * `asciiOnly` holds for every renderable a consumer can import.
 *
 * The switch is a property of the output device (`ConsoleOptions.asciiOnly`),
 * and each renderable honours it by resolving the glyphs it chooses through
 * `drawable` in `src/core/protocol.ts`. Nothing about a new renderable makes it
 * do that, so this suite asks each one: the classes with a `render` method are
 * read off every `package.json#exports` entry, and each must have a row in
 * `ROWS` — so a renderable added without one fails here, by name.
 *
 * A `glyphs` row is drawn twice. Without the switch it must spend a glyph
 * outside ASCII, which is what proves the fixture reaches the glyphs it is
 * standing in for; with the switch it must spend none. A container's fixture
 * holds a renderable that draws glyphs, which proves it passes the options on.
 * A `text` row draws only the text it is handed, so its fixture, handed ASCII,
 * is held to ASCII under the switch. An `unrendered` row is not drawn, and says
 * why.
 */

import path from "node:path";
import { describe, expect, it } from "vitest";
import { ENTRY_BY_SPECIFIER, REPO_ROOT } from "../coverage/extract.js";
import { renderToString } from "../../src/core/render.js";
import type { Renderable } from "../../src/core/protocol.js";
import {
  Align,
  BarColumn,
  CapsuleJoiner,
  Columns,
  Constrain,
  FlexStrip,
  GradientJoiner,
  Group,
  JSONRenderable,
  Layout,
  Markdown,
  MofNCompleteColumn,
  Padding,
  Panel,
  PlainJoiner,
  PowerlineJoiner,
  Pretty,
  Progress,
  ProgressBar,
  RichText,
  Rule,
  Spinner,
  SpinnerColumn,
  Strip,
  Syntax,
  Table,
  TaskProgressColumn,
  TextColumn,
  TimeElapsedColumn,
  TimeRemainingColumn,
  Traceback,
  Tree,
  Viewport,
  SCROLLBAR,
} from "../../src/index.js";
import {
  Button,
  Checkbox,
  Dropdown,
  Slider,
  StaticItem,
  TextInput,
  Toggle,
} from "../../src/widgets/index.js";

type Row =
  | { readonly draws: "glyphs"; readonly make: () => Renderable }
  | { readonly draws: "text"; readonly make: () => Renderable; readonly why: string }
  | { readonly draws: "unrendered"; readonly why: string };

const panel = (): Panel => new Panel("boxed");
const cell = (text: string, bg: string): RichText => new RichText(text, { style: `white on ${bg}` });
const cells = (): RichText[] => [cell("a", "red"), cell("b", "blue")];

const ROWS: Record<string, Row> = {
  // src/index.ts
  RichText: { draws: "text", make: () => new RichText("plain"), why: "draws the text it holds" },
  Strip: {
    draws: "glyphs",
    make: () => new Group(
      new Strip(cells(), new PowerlineJoiner()),
      new Strip(cells(), new CapsuleJoiner()),
      new Strip(cells(), new PlainJoiner({ separator: " · " })),
      new Strip(cells(), new GradientJoiner()),
    ),
  },
  Emoji: { draws: "unrendered", why: "draws the emoji its caller names — the caller's content, not a glyph the library chose" },
  Pretty: { draws: "text", make: () => new Pretty({ a: [1, "two"] }), why: "draws the value it is handed" },
  JSONRenderable: { draws: "text", make: () => JSONRenderable.fromData({ a: 1 }), why: "draws the value it is handed" },
  Constrain: { draws: "glyphs", make: () => new Constrain(panel(), 20) },
  Align: { draws: "glyphs", make: () => new Align(panel()) },
  Padding: { draws: "glyphs", make: () => new Padding(panel(), 1) },
  Viewport: { draws: "glyphs", make: () => new Viewport(new RichText("a\nb\nc\nd"), { rows: 2, scrollbar: SCROLLBAR }) },
  Rule: { draws: "glyphs", make: () => new Rule("title") },
  Panel: { draws: "glyphs", make: panel },
  Group: { draws: "glyphs", make: () => new Group(panel()) },
  ProgressBar: { draws: "glyphs", make: () => new ProgressBar({ total: 10, completed: 5 }) },
  Spinner: { draws: "glyphs", make: () => new Spinner() },
  Table: { draws: "glyphs", make: () => new Table().addColumn("head").addRow("cell") },
  Tree: {
    draws: "glyphs",
    make: () => {
      const tree = new Tree("root");
      tree.add("first");
      tree.add("last");
      return tree;
    },
  },
  Columns: { draws: "glyphs", make: () => new Columns([panel(), panel()]) },
  FlexStrip: { draws: "glyphs", make: () => new FlexStrip(cells(), { joiner: new PowerlineJoiner() }) },
  Progress: {
    draws: "glyphs",
    make: () => {
      const progress = new Progress(new SpinnerColumn(), new BarColumn(), { autoRefresh: false });
      progress.addTask("task", { total: 10 });
      return progress;
    },
  },
  TextColumn: { draws: "text", make: () => new TextColumn("text"), why: "draws its format string" },
  BarColumn: { draws: "glyphs", make: () => new BarColumn() },
  TaskProgressColumn: { draws: "text", make: () => new TaskProgressColumn(), why: "draws a percentage" },
  TimeRemainingColumn: { draws: "text", make: () => new TimeRemainingColumn(), why: "draws a time" },
  TimeElapsedColumn: { draws: "text", make: () => new TimeElapsedColumn(), why: "draws a time" },
  SpinnerColumn: { draws: "glyphs", make: () => new SpinnerColumn() },
  MofNCompleteColumn: { draws: "text", make: () => new MofNCompleteColumn(), why: "draws a count" },
  Traceback: { draws: "text", make: () => new Traceback(new Error("boom")), why: "draws the error's message and stack" },
  Syntax: { draws: "glyphs", make: () => new Syntax("const a = 1;", "typescript", { lineNumbers: true }) },
  Markdown: { draws: "glyphs", make: () => new Markdown("- item\n\n> quote") },
  Layout: { draws: "glyphs", make: () => new Layout(panel()) },

  // src/widgets/index.ts
  StaticItem: { draws: "glyphs", make: () => new StaticItem({ id: "static", render: panel() }) },
  WidgetBase: { draws: "unrendered", why: "abstract; each concrete widget has its own row" },
  Button: { draws: "text", make: () => new Button({ label: "press" }), why: "draws its label" },
  Checkbox: { draws: "glyphs", make: () => new Checkbox({ label: "check", checked: true }) },
  Toggle: { draws: "text", make: () => new Toggle({ label: "toggle", on: true }), why: "draws its label and state" },
  TextInput: {
    draws: "glyphs",
    make: () => {
      const wrapped = new TextInput({ multiline: true, value: "a line long enough to wrap\nand more\nand more", maxRows: 2 });
      return new Group(
        wrapped,
        new TextInput({ password: true, value: "secret" }),
        new TextInput({ value: "two\nlines" }),
      );
    },
  },
  Dropdown: {
    draws: "glyphs",
    make: () => {
      const dropdown = new Dropdown({ options: ["one", "two"] });
      dropdown.focused = true;
      return dropdown;
    },
  },
  Slider: { draws: "glyphs", make: () => new Slider({ value: 50 }) },
};

const NON_ASCII = /[^\x00-\x7F]/;
const draw = (make: () => Renderable, asciiOnly: boolean): string =>
  renderToString(make(), { width: 40, colorSystem: null, asciiOnly });

async function exportedRenderables(): Promise<string[]> {
  const names = new Set<string>();
  for (const source of new Set(ENTRY_BY_SPECIFIER.values())) {
    const entry: Record<string, unknown> = await import(path.resolve(REPO_ROOT, source));
    for (const [name, value] of Object.entries(entry)) {
      if (typeof value === "function" && typeof value.prototype?.render === "function") names.add(name);
    }
  }
  return [...names].sort();
}

describe("asciiOnly", () => {
  it("has a row for every exported renderable, and none for a name no entry exports", async () => {
    expect(Object.keys(ROWS).sort()).toEqual(await exportedRenderables());
  });

  for (const [name, row] of Object.entries(ROWS)) {
    if (row.draws === "unrendered") continue;
    const { make } = row;

    it(`${name} draws nothing outside ASCII when the output is ASCII-only`, () => {
      expect(draw(make, true)).not.toMatch(NON_ASCII);
    });

    if (row.draws === "glyphs") {
      it(`${name}'s fixture spends a glyph outside ASCII by default`, () => {
        expect(draw(make, false)).toMatch(NON_ASCII);
      });
    }
  }
});
