/*
 * Which renderables end their own last line.
 *
 * `Group` emits its children back to back with nothing between them, so a
 * child that leaves its last line open runs the next child onto it
 * (docs/group.md). That contract was held by a hand-written `Segment.line()`
 * in each renderable and by prose, and it had already failed twice unseen:
 * `Strip` (rich-flexstrip-5kf), then `Spinner`, whose output ran into whatever
 * followed it in a `Group`. Printed alone, neither showed it, because
 * `Console.print` closes whatever a renderable leaves open.
 *
 * So `LINE_ENDS` below names every exported renderable
 * (test/seam/exported-renderables.ts) and says which side of the line it sits
 * on, and the test renders each one to check, so a new renderable fails here
 * until it is given an entry.
 *
 * [LAW:types-are-the-program] Three kinds, and only the default carries no
 * `why`. A renderable that ends its own line needs no argument. One that does
 * not is a line *fragment*, meant to be composed inside a line some other
 * renderable owns, and that is a claim to make on purpose. A container that
 * renders its content and adds nothing after it ends where its content ends,
 * so it is built around a content and drawn around one of each kind. The
 * reference is the tiebreaker: Rich's `Spinner` ends its line (it is a
 * `Text`), its `ProgressBar` does not, and its `Group` and `Constrain` pass
 * their content through.
 */

import type { Renderable } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Emoji } from "../../src/core/emoji.js";
import { JSONRenderable } from "../../src/core/json.js";
import { Pretty } from "../../src/core/pretty.js";
import { PlainJoiner, Strip } from "../../src/core/strip.js";
import { Align } from "../../src/renderables/align.js";
import { Columns } from "../../src/renderables/columns.js";
import { Constrain } from "../../src/renderables/constrain.js";
import { FlexStrip } from "../../src/renderables/flexStrip.js";
import { Group } from "../../src/renderables/group.js";
import { Layout } from "../../src/renderables/layout.js";
import { Markdown } from "../../src/renderables/markdown.js";
import { Padding } from "../../src/renderables/padding.js";
import { Panel } from "../../src/renderables/panel.js";
import { Progress } from "../../src/renderables/progress.js";
import { ProgressBar } from "../../src/renderables/progressBar.js";
import { Rule } from "../../src/renderables/rule.js";
import { Spinner } from "../../src/renderables/spinner.js";
import { Syntax } from "../../src/renderables/syntax.js";
import { Table } from "../../src/renderables/table.js";
import { Traceback } from "../../src/renderables/traceback.js";
import { Tree } from "../../src/renderables/tree.js";
import { Viewport } from "../../src/renderables/viewport.js";
import { Button } from "../../src/widgets/button.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Dropdown } from "../../src/widgets/dropdown.js";
import { Slider } from "../../src/widgets/slider.js";
import { StaticItem } from "../../src/widgets/static-item.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { Toggle } from "../../src/widgets/toggle.js";

/** What one exported renderable promises about its last line. */
export type LineEnd =
  | { readonly ends: "own-line"; readonly build: () => Renderable }
  | { readonly ends: "open"; readonly build: () => Renderable; readonly why: string }
  | { readonly ends: "content"; readonly build: (content: Renderable) => Renderable; readonly why: string };

/**
 * Whether a renderable's output leaves nothing open after it: its last
 * segment that carries text ends in a line break. Control segments carry no
 * text and move no cursor to a new line, so they are passed over.
 */
export function endsOwnLine(renderable: Renderable, maxWidth: number): boolean {
  const texts = [...renderable.render({ maxWidth })]
    .filter((segment: Segment) => segment.control === undefined && segment.text !== "")
    .map((segment) => segment.text);
  const last = texts.at(-1);
  if (last === undefined) throw new Error("line-ends: the fixture drew nothing, so it proves nothing");
  return last.endsWith("\n");
}

// --- The list ---

const text = (content: string): RichText => new RichText(content);

export const LINE_ENDS: Readonly<Record<string, LineEnd>> = {
  Align: { ends: "own-line", build: () => new Align(text("x")) },
  Button: { ends: "own-line", build: () => new Button({ label: "Click" }) },
  Checkbox: { ends: "own-line", build: () => new Checkbox({ label: "Agree" }) },
  Columns: { ends: "own-line", build: () => new Columns(["a", "b"]) },
  Constrain: { ends: "content", build: (content) => new Constrain(content, 10), why: "renders its content and nothing after it, as the reference's does: its last line is its content's" },
  Dropdown: { ends: "own-line", build: () => new Dropdown({ options: ["a", "b"] }) },
  Emoji: {
    ends: "open",
    build: () => new Emoji("smile"),
    why: "one glyph, set inside a line of text as the reference's Emoji is: it yields the character and nothing after it",
  },
  FlexStrip: { ends: "own-line", build: () => new FlexStrip([text("a")]) },
  Group: { ends: "content", build: (content) => new Group(text("a"), content), why: "renders its content and nothing after it, as the reference's does: its last line is its content's" },
  JSONRenderable: { ends: "own-line", build: () => JSONRenderable.fromData({ a: 1 }) },
  Layout: { ends: "own-line", build: () => new Layout(text("x")) },
  Markdown: { ends: "own-line", build: () => new Markdown("# hi") },
  Padding: { ends: "own-line", build: () => new Padding(text("x"), 1) },
  Panel: { ends: "own-line", build: () => new Panel(text("x")) },
  Pretty: { ends: "own-line", build: () => new Pretty({ a: 1 }) },
  Progress: {
    ends: "own-line",
    build: () => {
      const progress = new Progress();
      progress.addTask("t");
      return progress;
    },
  },
  ProgressBar: {
    ends: "open",
    build: () => new ProgressBar({ total: 10, completed: 5, width: 10 }),
    why: "a bar drawn inside a line some other renderable owns, as the reference's ProgressBar is: Rich's Group(bar, text) runs the text onto the bar's line too",
  },
  RichText: { ends: "own-line", build: () => text("x") },
  Rule: { ends: "own-line", build: () => new Rule("t") },
  Slider: { ends: "own-line", build: () => new Slider() },
  Spinner: { ends: "own-line", build: () => new Spinner("dots", "hi") },
  StaticItem: { ends: "own-line", build: () => new StaticItem({ id: "s", render: text("x") }) },
  Strip: { ends: "own-line", build: () => new Strip([text("a")], new PlainJoiner()) },
  Syntax: { ends: "own-line", build: () => new Syntax("x = 1", "python") },
  Table: {
    ends: "own-line",
    build: () => {
      const table = new Table();
      table.addColumn("A");
      table.addRow("1");
      return table;
    },
  },
  TextInput: { ends: "own-line", build: () => new TextInput() },
  Toggle: { ends: "own-line", build: () => new Toggle({ label: "Sound", id: "tg" }) },
  Traceback: { ends: "own-line", build: () => new Traceback(new Error("boom")) },
  Tree: { ends: "own-line", build: () => new Tree("root") },
  Viewport: { ends: "own-line", build: () => new Viewport(text("x")) },
};
