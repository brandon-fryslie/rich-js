/**
 * A card's setup in its editor (docs/.vitepress/theme/setup-regions.ts): what
 * an edit can change, and what is drawn over the setup, read off the editor's
 * state, which needs no page.
 *
 * [LAW:behavior-not-structure] Edits in, the document out; the decorations as
 * the ranges and widgets an editor draws.
 */
import { describe, expect, it } from "vitest";
import { EditorState, type TransactionSpec } from "@codemirror/state";
import { EditorView, type DecorationSet } from "@codemirror/view";
import { blockOf, blockSpan, cardSource, type CardSetup } from "../../docs/.vitepress/example-card.js";
import { setupRegions, type SetupStart } from "../../docs/.vitepress/theme/setup-regions.js";

const SETUP: CardSetup = {
  before: [
    { origin: "imports", lines: ['import { Console, Table } from "@promptctl/rich-js";', ""] },
    { origin: "from 'Basic usage'", lines: ["const console = new Console();", "", "{"] },
  ],
  after: ["}"],
};
const BLOCK = "const scores = new Table();\nconsole.print(scores);";

const editor = (starts: SetupStart, setup = SETUP) => EditorState.create({ doc: cardSource(setup, BLOCK), extensions: setupRegions(setup, starts) });
const edited = (state: EditorState, spec: TransactionSpec) => state.update(spec).state.doc.toString();
const { before, after } = blockSpan(SETUP);

/** What the editor draws: each decoration's range, and the text a widget shows or the class a line takes. */
function drawn(state: EditorState): string[] {
  const sets = state.facet(EditorView.decorations).map((source) => (typeof source === "function" ? null : source)) as (DecorationSet | null)[];
  const out: string[] = [];
  for (const set of sets) {
    set?.between(0, state.doc.length, (from, to, deco) => {
      const widget = deco.spec.widget as { lines?: number; origin?: string } | undefined;
      const shows = widget === undefined ? (deco.spec.class ?? "hidden") : (widget.origin ?? `${widget.lines} lines of setup`);
      out.push(`${state.doc.lineAt(from).number}-${state.doc.lineAt(to).number} ${shows}`);
    });
  }
  return out;
}

const focus = (state: EditorState, on: boolean) => state.update({ effects: state.facet(EditorView.focusChangeEffect).map((f) => f(state, on)!) }).state;

describe("a card's setup", () => {
  it("changes nothing when an edit reaches into it, typed, pasted or deleted", () => {
    const state = editor("folded");
    const program = state.doc.toString();
    expect(edited(state, { changes: { from: 0, insert: "x" } })).toBe(program);
    expect(edited(state, { changes: { from: 10, insert: "pasted\nlines" } })).toBe(program);
    expect(edited(state, { changes: { from: before - 1, to: before } })).toBe(program);
    expect(edited(state, { changes: { from: state.doc.length - after, to: state.doc.length - after + 1 } })).toBe(program);
    expect(edited(state, { changes: { from: state.doc.length, insert: "x" } })).toBe(program);
    expect(edited(state, { changes: { from: 0, to: state.doc.length, insert: "" } })).toBe(program);
  });

  it("lets the block be edited from its first character to its last", () => {
    const state = editor("folded");
    expect(blockOf(SETUP, edited(state, { changes: { from: before, insert: "// " } }))).toBe(`// ${BLOCK}`);
    expect(blockOf(SETUP, edited(state, { changes: { from: state.doc.length - after, insert: " // end" } }))).toBe(`${BLOCK} // end`);
    expect(blockOf(SETUP, edited(state, { changes: { from: before, to: state.doc.length - after, insert: "" } }))).toBe("");
  });

  it("is hidden while folded and the editor does not have focus, and is one strip when it does", () => {
    const state = editor("folded");
    expect(drawn(state)).toEqual(["1-5 hidden", "8-8 hidden"]);
    expect(drawn(focus(state, true))).toEqual(["1-5 4 lines of setup", "8-8 hidden"]);
  });

  it("shows every group, labelled and locked, unfolded", () => {
    expect(drawn(editor("unfolded"))).toEqual([
      "1-1 imports",
      "1-1 rich-setup-line",
      "2-2 rich-setup-line",
      "3-3 from 'Basic usage'",
      "3-3 rich-setup-line",
      "4-4 rich-setup-line",
      "5-5 rich-setup-line",
      "8-8 rich-setup-line",
    ]);
  });

  it("draws nothing for a block with no setup", () => {
    const none = editor("folded", { before: [], after: [] });
    expect(drawn(focus(none, true))).toEqual([]);
    expect(edited(none, { changes: { from: 0, insert: "// " } })).toBe(`// ${BLOCK}`);
  });
});
