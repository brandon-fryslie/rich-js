/// <reference lib="dom" />
/**
 * The playground's editor: CodeMirror 6 editing TypeScript, and nothing an IDE
 * adds. CodeMirror was chosen over Monaco for its weight on the page. The
 * playground needs highlighting, undo and indentation; a type error shows up
 * when the code runs, so it needs no completion and no checker.
 *
 * Every colour is a custom property custom.css sets for each colour mode, so
 * the editor follows the site's mode with nothing to reconfigure when it
 * changes.
 */
import { EditorState } from "@codemirror/state";
import { EditorView, drawSelection, highlightActiveLine, keymap, lineNumbers } from "@codemirror/view";
import { defaultKeymap, history, historyKeymap, indentWithTab } from "@codemirror/commands";
import { HighlightStyle, bracketMatching, indentOnInput, syntaxHighlighting } from "@codemirror/language";
import { javascript } from "@codemirror/lang-javascript";
import { tags } from "@lezer/highlight";

const HIGHLIGHT = HighlightStyle.define([
  { tag: [tags.keyword, tags.modifier, tags.controlKeyword, tags.operatorKeyword], color: "var(--rich-code-keyword)" },
  { tag: [tags.string, tags.special(tags.string), tags.regexp], color: "var(--rich-code-string)" },
  { tag: [tags.number, tags.bool, tags.null, tags.atom], color: "var(--rich-code-number)" },
  { tag: tags.comment, color: "var(--rich-code-comment)", fontStyle: "italic" },
  { tag: [tags.function(tags.variableName), tags.function(tags.propertyName)], color: "var(--rich-code-function)" },
  { tag: [tags.typeName, tags.className, tags.namespace], color: "var(--rich-code-type)" },
  { tag: tags.propertyName, color: "var(--rich-code-property)" },
  { tag: tags.operator, color: "var(--rich-code-operator)" },
]);

const THEME = EditorView.theme({
  "&": { color: "var(--vp-c-text-1)", backgroundColor: "var(--vp-code-block-bg)" },
  "&.cm-focused": { outline: "none" },
  ".cm-scroller": { fontFamily: "var(--vp-font-family-mono)", fontSize: "var(--vp-code-font-size)", lineHeight: "1.7" },
  ".cm-content": { caretColor: "var(--vp-c-brand-1)" },
  ".cm-cursor, .cm-dropCursor": { borderLeftColor: "var(--vp-c-brand-1)" },
  ".cm-gutters": { color: "var(--vp-c-text-3)", backgroundColor: "var(--vp-code-block-bg)", border: "none" },
  ".cm-activeLine, .cm-activeLineGutter": { backgroundColor: "var(--vp-c-default-soft)" },
  "&.cm-focused > .cm-scroller > .cm-selectionLayer .cm-selectionBackground, .cm-selectionBackground": {
    backgroundColor: "var(--vp-c-brand-soft)",
  },
  ".cm-matchingBracket": { backgroundColor: "var(--vp-c-default-soft)", outline: "1px solid var(--vp-c-divider)" },
});

/** What the editor tells its page: the program changed, or the reader asked to run it. */
export interface EditorEvents {
  change(source: string): void;
  run(): void;
}

/**
 * An editor in `parent` holding `source`. Mod-Enter (Ctrl, or Cmd on a Mac)
 * runs; Tab indents, and Escape then Tab leaves the editor, as CodeMirror
 * documents for a keyboard user.
 */
export function createEditor(parent: HTMLElement, source: string, events: EditorEvents): EditorView {
  return new EditorView({
    parent,
    state: EditorState.create({
      doc: source,
      extensions: [
        lineNumbers(),
        highlightActiveLine(),
        drawSelection(),
        history(),
        indentOnInput(),
        bracketMatching(),
        // Long lines wrap, so a phone shows a whole line without scrolling sideways.
        EditorView.lineWrapping,
        javascript({ typescript: true }),
        syntaxHighlighting(HIGHLIGHT),
        THEME,
        EditorView.contentAttributes.of({ "aria-label": "Program" }),
        // Ahead of the default keymap, which binds Mod-Enter to a blank line.
        keymap.of([{ key: "Mod-Enter", run: () => (events.run(), true) }, indentWithTab, ...defaultKeymap, ...historyKeymap]),
        EditorView.updateListener.of((update) => update.docChanged && events.change(update.state.doc.toString())),
      ],
    }),
  });
}
