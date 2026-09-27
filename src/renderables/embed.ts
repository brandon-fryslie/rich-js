/**
 * The one crossing where content a caller hands a renderable — a table cell, a
 * panel's body, a tree label, a column item, a layout pane — becomes something
 * that renderable can lay out. [LAW:single-enforcer]
 *
 * Each of those sites used to build its own `RichText` straight from the
 * constructor, which does not parse markup, so `[red]Solo[/red]` reached the
 * terminal with its tags intact. Table cells were fixed on their own first; the
 * other four kept the defect until the rule moved here.
 *
 * Parsing is unconditional because that is what the reference does rather than
 * because it is the simpler branch: Rich's `Console.__init__` declares
 * `markup: bool = True`, and every one of these positions reaches the wire
 * through Rich's own `render_str`. A per-renderable opt-out would be a mode
 * with no reference behaviour to define. [LAW:no-mode-explosion]
 *
 * `end` is cleared because embedded text is a fragment rather than a printed
 * line; left at the default `"\n"` it draws a trailing blank row. A `RichText`
 * is copied first, since clearing in place would reach back into the caller's
 * object.
 */

import { renderMarkup } from "../core/markup.js";
import type { Measurable, Renderable } from "../core/protocol.js";
import { RichText } from "../core/text.js";

/** Caller content as the text an embedding site lays out: markup parsed, `end` cleared. */
export function embeddedText(content: unknown): RichText {
  const text = content instanceof RichText ? content.copy() : renderMarkup(String(content ?? ""));
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
