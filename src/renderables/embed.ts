/**
 * The one crossing where content a caller hands a renderable — a table cell, a
 * panel's body, title or subtitle, a tree label, a column item, a layout pane,
 * a rule's title — becomes something that renderable can lay out.
 * [LAW:single-enforcer]
 *
 * A string is kept as written and read when it is drawn, through `readStr`,
 * under the options it is drawn with. That is where a console's settings
 * arrive: its `markup` decides whether the string is markup, and its
 * highlighter highlights it, exactly as they do for a string handed to `print`.
 * Parsed when the renderable was built, a string was markup under a console
 * that had turned markup off, never met the console's highlighter, and an
 * unmatched closing tag threw from a constructor rather than from the render
 * that would draw it, where Rich's does (rich-markup-3sw).
 *
 * `end` is cleared because embedded text is a fragment rather than a printed
 * line; left at the default `"\n"` it draws a trailing blank row. A `RichText`
 * is copied when it is handed over, since the caller still holds it, and every
 * text drawn from it is a copy again, since the drawing site may change it.
 */

import { readStr } from "../core/markup.js";
import type { Measurable, Renderable, RenderOptions } from "../core/protocol.js";
import { Segment } from "../core/segment.js";
import type { Style } from "../core/style.js";
import { RichText } from "../core/text.js";

/**
 * Caller content as text an embedding site lays out. A string is the only kind
 * of content that can contain markup, so it is the only kind whose reading
 * waits for the options; any other value is its `String` form as written, so an
 * object's `[object Object]` is not eaten as a tag.
 */
export class EmbeddedText implements Renderable, Measurable {
  // [LAW:types-are-the-program] Two kinds, and the kind is the discriminator: a
  // string still to be read, or text whose reading is already fixed.
  private readonly _source: string | RichText;
  // A string's reading under each markup setting, made the first time one is
  // asked for. Parsing is the costly half of drawing a string, and a table
  // measures every cell more than once per print; read on every call, a
  // 500-row table of markup printed 75% slower.
  private readonly _readings = new Map<boolean, RichText>();

  constructor(content: unknown) {
    if (typeof content === "string") {
      this._source = content;
    } else {
      const text = content instanceof RichText ? content.copy() : new RichText(String(content ?? ""));
      text.end = "";
      this._source = text;
    }
  }

  /** The text this content draws under `options`, `end` cleared. */
  text(options: RenderOptions): RichText {
    if (typeof this._source !== "string") return this._source.copy();
    const markup = options.markup !== false;
    const reading = this._readings.get(markup) ?? readStr(this._source, markup);
    this._readings.set(markup, reading);
    const text = reading.copy();
    options.highlighter?.highlight(text);
    return text;
  }

  render(options: RenderOptions): Iterable<Segment> {
    return this.text(options).render(options);
  }

  /**
   * Measured unhighlighted, as Rich's `Measurement.get` reads a string with
   * `highlight=False`: so a container that clears the highlighter for what it
   * draws measures what it draws, whether or not it clears it for what it
   * measures, and no highlighter runs just to be thrown away.
   */
  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.text({ ...options, highlighter: undefined }).measure(options);
  }
}

/**
 * Caller content as something an embedding site can render. A non-text
 * `Renderable` (a nested `Panel` or `Table`) passes through: it carries no
 * `end` to clear and no markup to parse. Everything else is `EmbeddedText`.
 */
export function embed(content: unknown): Renderable & Partial<Measurable> {
  if (!(content instanceof RichText) && typeof content === "object" && content !== null && "render" in content) {
    return content as Renderable & Partial<Measurable>;
  }
  return new EmbeddedText(content);
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
  const bare = new EmbeddedText(content).text(options);
  const text = bare.plain === "" ? bare : bare.pad(1);
  text.overflow = "ignore";
  return [...Segment.applyStyle(text.render(options), base)];
}
