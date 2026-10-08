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
 * hidden; a click on the strip unfolds both. A docs card starts folded and the
 * playground unfolded: where it starts is the caller's, so this is the one
 * piece both use.
 *
 * [LAW:dataflow-not-control-flow] What is drawn is a function of the setup,
 * whether it is folded, and whether the editor has focus. A block with no setup
 * has no groups and no locked lines, so nothing is drawn.
 */
import { EditorState, StateEffect, StateField, type Extension, type Range } from "@codemirror/state";
import { Decoration, EditorView, WidgetType, type DecorationSet } from "@codemirror/view";
import { blockSpan, type CardSetup } from "../example-card.js";

/** Where a card's setup starts: folded into its strip, or every group shown. */
export type SetupStart = "folded" | "unfolded";

const unfold = StateEffect.define<null>();
const focused = StateEffect.define<boolean>();

/** The strip a folded setup is drawn as; a click on it unfolds the setup. */
class Strip extends WidgetType {
  constructor(readonly lines: number) {
    super();
  }
  override eq(other: Strip): boolean {
    return other.lines === this.lines;
  }
  toDOM(view: EditorView): HTMLElement {
    const strip = document.createElement("button");
    strip.type = "button";
    strip.className = "rich-setup-strip";
    strip.textContent = `▸ ${this.lines} line${this.lines === 1 ? "" : "s"} of setup`;
    // A press keeps the editor's focus, so the setup unfolds in a card still being edited.
    strip.addEventListener("mousedown", (event) => event.preventDefault());
    strip.addEventListener("click", () => view.dispatch({ effects: unfold.of(null) }));
    return strip;
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
  ".rich-setup-strip": {
    display: "block",
    opacity: "0.6",
    font: "inherit",
    color: "inherit",
    background: "none",
    border: "none",
    padding: "0",
    cursor: "pointer",
  },
});

/**
 * `setup` around the block of an editor holding `cardSource(setup, block)`:
 * locked, labelled, and folded or not as it `starts`.
 */
export function setupRegions(setup: CardSetup, starts: SetupStart): Extension {
  const span = blockSpan(setup);
  const count = [...setup.before.flatMap((group) => group.lines), ...setup.after].filter((line) => line.trim() !== "").length;

  // [LAW:single-enforcer] The one rule that keeps the setup as the page wrote
  // it: a change reaching into it, typed, pasted or deleted, changes nothing.
  const locked = EditorState.changeFilter.of((tr) => {
    let inside = true;
    tr.changes.iterChangedRanges((from, to) => {
      inside &&= from >= span.before && to <= tr.startState.doc.length - span.after;
    });
    return inside;
  });

  const shown = StateField.define<{ readonly folded: boolean; readonly focused: boolean }>({
    create: () => ({ folded: starts === "folded", focused: false }),
    update: (value, tr) =>
      tr.effects.reduce(
        (now, effect) => (effect.is(unfold) ? { ...now, folded: false } : effect.is(focused) ? { ...now, focused: effect.value } : now),
        value,
      ),
  });

  /** The decorations for the document and how the setup is shown. */
  const drawn = (state: EditorState): DecorationSet => {
    const { folded, focused: hasFocus } = state.field(shown);
    const end = state.doc.length;
    // Whole lines: the setup's last line ends before the newline the block starts after.
    const above = span.before === 0 ? [] : [{ from: 0, to: span.before - 1 }];
    const below = span.after === 0 ? [] : [{ from: end - span.after + 1, to: end }];
    if (folded) {
      return Decoration.set([
        ...above.map(({ from, to }) => Decoration.replace({ block: true, widget: hasFocus ? new Strip(count) : undefined }).range(from, to)),
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
    update: (value, tr) => (tr.docChanged || tr.startState.field(shown) !== tr.state.field(shown) ? drawn(tr.state) : value),
    provide: (field) => [EditorView.decorations.from(field), EditorView.atomicRanges.of((v) => (v.state.field(shown).folded ? v.state.field(field) : Decoration.none))],
  });

  return [locked, shown, decorations, EditorView.focusChangeEffect.of((_, focusing) => focused.of(focusing)), THEME];
}
