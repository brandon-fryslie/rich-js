/// <reference lib="dom" />
/**
 * The setup a card's block runs on, in the card's own editor: the editor holds
 * the whole program (example-card.ts's `cardSource`), and everything but the
 * block is locked, dimmed and labelled by where it came from. One document, not
 * an editor per region, so a thrown error's line is the reader's line and a
 * selection runs across the whole program.
 *
 * Folded, the setup above the block is one strip, "▸ N lines of setup", shown
 * only while the editor has focus, and the lines closing its scopes below are
 * hidden. A click on the strip unfolds both, and so does a selection reaching
 * into the setup, by arrow keys, Ctrl+Home or select-all, so the keyboard
 * reaches it and the cursor is never in a line that is not drawn. The strip
 * takes no line: it stands in the space above the code, so the code does not
 * move when the editor gains or loses focus. A docs card starts folded and the
 * playground unfolded, so where it starts is the caller's.
 *
 * [LAW:dataflow-not-control-flow] What is drawn is a function of the setup and
 * whether it is folded; focus only shows or hides the strip, in style. A block
 * with no setup has no groups and no locked lines, so nothing is drawn.
 */
import { ChangeSet, EditorSelection, EditorState, StateEffect, StateField, type Extension, type Range, type Text } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { blockSpan, type CardSetup } from "../example-card.js";

/** Where a card's setup starts: folded into its strip, or every group shown. */
export type SetupStart = "folded" | "unfolded";

const unfold = StateEffect.define<null>();

/** Show the setup of the card in `view`, as a click on its strip does. */
export const unfoldSetup = (view: EditorView): void => view.dispatch({ effects: unfold.of(null) });

/** The strip a folded setup is drawn as; a click on it unfolds the setup. */
class Strip extends WidgetType {
  constructor(readonly lines: number) {
    super();
  }
  override eq(other: Strip): boolean {
    return other.lines === this.lines;
  }
  toDOM(view: EditorView): HTMLElement {
    // A block of no height, so the editor's lines sit where they would without it;
    // the strip in it is drawn above, in the space over the code.
    const fold = document.createElement("div");
    fold.className = "rich-setup-fold";
    const strip = fold.appendChild(document.createElement("button"));
    strip.type = "button";
    strip.className = "rich-setup-strip";
    strip.textContent = `▸ ${this.lines} line${this.lines === 1 ? "" : "s"} of setup`;
    // A press keeps the editor's focus, so the setup unfolds in a card still being edited.
    strip.addEventListener("mousedown", (event) => event.preventDefault());
    strip.addEventListener("click", () => unfoldSetup(view));
    return fold;
  }
  override ignoreEvent(): boolean {
    return true;
  }
}

/** A group's label, above its first line. */
class Label extends WidgetType {
  constructor(readonly origin: string) {
    super();
  }
  override eq(other: Label): boolean {
    return other.origin === this.origin;
  }
  toDOM(): HTMLElement {
    const label = document.createElement("div");
    label.className = "rich-setup-label";
    label.textContent = `🔒︎ ${this.origin}`;
    return label;
  }
}

const THEME = EditorView.baseTheme({
  ".rich-setup-line": { opacity: "0.5" },
  ".rich-setup-label": { opacity: "0.6", fontSize: "0.85em", fontStyle: "italic", userSelect: "none" },
  ".rich-setup-fold": { position: "relative", height: "0" },
  ".rich-setup-strip": {
    position: "absolute",
    bottom: "0",
    left: "0",
    visibility: "hidden",
    opacity: "0.6",
    font: "inherit",
    color: "inherit",
    background: "none",
    border: "none",
    padding: "0",
    cursor: "pointer",
  },
  "&.cm-focused .rich-setup-strip": { visibility: "visible" },
});

/**
 * `setup` around the block of an editor holding `cardSource(setup, block)`:
 * locked, labelled, and folded or not as it `starts`.
 */
export function setupRegions(setup: CardSetup, starts: SetupStart): Extension {
  const span = blockSpan(setup);
  const count = [...setup.before.flatMap((group) => group.lines), ...setup.after].filter((line) => line.trim() !== "").length;
  const block = (state: EditorState) => ({ from: span.before, to: state.doc.length - span.after });

  // [LAW:single-enforcer] The one rule that keeps the setup as the page wrote
  // it: each change, typed, pasted or deleted, is cut to the block. One wholly
  // in the setup is dropped; one reaching across it keeps its block part and
  // its text, so a paste over select-all replaces the block.
  const locked = EditorState.transactionFilter.of((tr) => {
    const { from: start, to: end } = block(tr.startState);
    const cut: { from: number; to: number; insert: Text }[] = [];
    let reaches = false;
    tr.changes.iterChanges((from, to, _fromB, _toB, insert) => {
      reaches ||= from < start || to > end;
      if (to >= start && from <= end) cut.push({ from: Math.max(from, start), to: Math.min(to, end), insert });
    });
    if (!reaches) return tr;
    const kept = ChangeSet.of(cut, tr.startState.doc.length);
    const last = cut.at(-1);
    return {
      changes: kept,
      selection: last === undefined ? undefined : EditorSelection.cursor(kept.mapPos(last.to, 1)),
      effects: tr.effects,
      scrollIntoView: tr.scrollIntoView,
    };
  });

  const folded = StateField.define<boolean>({
    create: () => starts === "folded",
    update: (value, tr) => {
      const { from, to } = block(tr.state);
      const reaches = tr.selection !== undefined && tr.state.selection.ranges.some((range) => range.from < from || range.to > to);
      return value && !reaches && !tr.effects.some((effect) => effect.is(unfold));
    },
  });

  /** The decorations for the document and how the setup is shown. */
  const drawn = (state: EditorState): DecorationSet => {
    const end = state.doc.length;
    // Whole lines: the setup's last line ends before the newline the block starts after.
    const above = span.before === 0 ? [] : [{ from: 0, to: span.before - 1 }];
    const below = span.after === 0 ? [] : [{ from: end - span.after + 1, to: end }];
    if (state.field(folded)) {
      return Decoration.set([
        ...above.map(({ from, to }) => Decoration.replace({ block: true, widget: new Strip(count) }).range(from, to)),
        ...below.map(({ from, to }) => Decoration.replace({ block: true }).range(from, to)),
      ]);
    }
    const lines: Range<Decoration>[] = [...above, ...below].flatMap(({ from, to }) => {
      const first = state.doc.lineAt(from).number;
      const last = state.doc.lineAt(to).number;
      return Array.from({ length: last - first + 1 }, (_, i) => Decoration.line({ class: "rich-setup-line" }).range(state.doc.line(first + i).from));
    });
    let at = 0;
    const labels = setup.before.map((group) => {
      const label = Decoration.widget({ block: true, side: -1, widget: new Label(group.origin) }).range(at);
      at += group.lines.reduce((sum, line) => sum + line.length + 1, 0);
      return label;
    });
    return Decoration.set([...lines, ...labels], true);
  };

  const decorations = StateField.define<DecorationSet>({
    create: drawn,
    update: (value, tr) => (tr.docChanged || tr.startState.field(folded) !== tr.state.field(folded) ? drawn(tr.state) : value),
    provide: (field) => EditorView.decorations.from(field),
  });

  return [locked, folded, decorations, THEME];
}
