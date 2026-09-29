/**
 * The one crossing where content a caller hands a renderable — a table cell, a
 * panel's body, title or subtitle, a tree label, a column item, a layout pane,
 * a rule's title — becomes something that renderable can lay out.
 * [LAW:single-enforcer]
 *
 * Each of those sites used to build its own `RichText` straight from the
 * constructor, which does not parse markup, so `[red]Solo[/red]` reached the
 * terminal with its tags intact. Table cells were fixed on their own first; the
 * rest kept the defect until the rule moved here.
 *
 * Markup is parsed because Rich parses it: every one of these positions
 * reaches the wire through Rich's `render_str`, and a console's markup is on by
 * default. Rich's `render_str` also honours `Console(markup=False)` and runs the
 * console's highlighter; this crossing does neither, because the console's
 * settings do not reach it (rich-markup-3sw).
 *
 * `end` is cleared because embedded text is a fragment rather than a printed
 * line; left at the default `"\n"` it draws a trailing blank row. A `RichText`
 * is copied first, since clearing in place would reach back into the caller's
 * object.
 */

import { renderMarkup } from "../core/markup.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import type { Style } from "../core/style.js";
import { RichText } from "../core/text.js";

/**
 * Caller content as the text an embedding site lays out, `end` cleared. A
 * string is the only kind of content that can contain markup, so it is the only
 * kind parsed; any other value is its `String` form as written, so an object's
 * `[object Object]` is not eaten as a tag.
 */
export function embeddedText(content: unknown): RichText {
  const text =
    content instanceof RichText
      ? content.copy()
      : typeof content === "string"
        ? renderMarkup(content)
        : new RichText(String(content ?? ""));
  text.end = "";
  return text;
}

/**
 * Caller content as something an embedding site can render. A non-text
 * `Renderable` (a nested `Panel` or `Table`) passes through: it carries no
 * `end` to clear and no markup to parse. Everything else is `embeddedText`.
 */
export function embed(content: unknown): Renderable & Partial<Measurable> {
  if (!(content instanceof RichText) && typeof content === "object" && content !== null && "render" in content) {
    return content as Renderable & Partial<Measurable>;
  }
  return embeddedText(content);
}

/**
 * Caller content set into a line it shares with other drawing — a panel's
 * title or subtitle in its border, a rule's title — as one line of segments:
 * a space either side, its own styles over `base`. The caller cuts it to the
 * room it has with `Segment.adjustLineLength`, which is cell-aware.
 *
 * Content with no text is no label at all, not two spaces: an absent title, an
 * empty string, an empty `RichText` and markup that styles nothing all draw
 * the plain line, as Rich's do (an empty `Text` is falsy there).
 */
export function inlineLabel(content: unknown, options: RenderOptions, base: Style | undefined): Segment[] {
  // The label leaves at its natural width, `"ignore"`, because the caller does
  // the cutting; the label's own overflow method would cut it first, and to a
  // width no one measured. `"ignore"` also leaves it unjustified, so its spaces
  // stay where `pad` put them.
  const bare = embeddedText(content);
  const text = bare.plain === "" ? bare : bare.pad(1);
  text.overflow = "ignore";
  return [...Segment.applyStyle(text.render(options), base)];
}
