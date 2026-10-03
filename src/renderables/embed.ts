/**
 * The one crossing where content a caller hands a renderable — a table cell, a
 * panel's body, title or subtitle, a padding's body, a tree label, a column
 * item, a layout pane, a rule's title — becomes something that renderable can
 * lay out.
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
 * Text keeps its own `end`, as a body does in Rich: `RichText("foo\n")` draws
 * the blank row its default `"\n"` end makes, and a string reads with that
 * default end as `render_str` gives it. Only a label, set into a line it
 * shares, clears it. A `RichText` is copied when it is handed over, since the
 * caller still holds it, and every text drawn from it is a copy again, since
 * the drawing site may change it.
 */

import { cellLen } from "../core/cells.js";
import { activeHighlighter, readStr } from "../core/markup.js";
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
      this._source = content instanceof RichText ? content.copy() : new RichText(String(content ?? ""));
    }
  }

  /** The text this content draws under `options`. */
  text(options: RenderOptions): RichText {
    if (typeof this._source !== "string") return this._source.copy();
    const markup = options.markup !== false;
    const reading = this._readings.get(markup) ?? readStr(this._source, markup);
    this._readings.set(markup, reading);
    const text = reading.copy();
    activeHighlighter(options)?.highlight(text);
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
    return this.text({ ...options, highlight: false }).measure(options);
  }
}

/**
 * Caller content as something an embedding site can render. A non-text
 * `Renderable` (a nested `Panel` or `Table`) passes through: it has no markup
 * to parse. Everything else is `EmbeddedText`.
 */
export function embed(content: unknown): Renderable & Partial<Measurable> {
  if (!(content instanceof RichText) && typeof content === "object" && content !== null && "render" in content) {
    return content as Renderable & Partial<Measurable>;
  }
  return new EmbeddedText(content);
}

/**
 * Caller content set into a line it shares with other drawing — a panel's
 * title or subtitle in its border, a rule's title — read as Rich's `_title`
 * reads it: newlines become spaces, so the label stays on its line, and tabs
 * are widened to their stops. Whatever sets it off from the line around it —
 * a panel's space either side, a rule's gaps — is the embedding site's.
 *
 * Held once by the renderable that owns it, so a string's markup is read once
 * and every measure and render after reuses that reading.
 */
export class InlineLabel {
  private readonly _content: EmbeddedText;

  constructor(content: string | RichText) {
    this._content = new EmbeddedText(content);
  }

  /** The label drawn under `options`: one line, its own overflow kept for the caller's cut. */
  text(options: RenderOptions): RichText {
    const text = this._content.text(options);
    // A fragment of the line, so its own end is not drawn, as Rich's `_title` clears it.
    text.end = "";
    text.plain = text.plain.replaceAll("\n", " ");
    // Tabs widened before anything measures it, so a cut to the border and
    // the width a title asks for count the cells the label will draw.
    return text.expandTabs();
  }
}

/**
 * A label cut to `width` cells as Rich's `Text.truncate` cuts one: to the width
 * less `marker`, padded back to it, so a wide character the cut splits leaves a
 * space in its cell rather than a cell of the line around it, then the marker.
 * A label that fits is left as it is.
 */
export function cutLabel(text: RichText, width: number, marker: string): void {
  if (text.cellLength <= width) return;
  const room = width - cellLen(marker);
  text.truncate(room, { marker: "" });
  text.padRight(room - text.cellLength);
  text.append(marker);
}

/**
 * Whether caller content is there at all, decided on the content as given, as
 * Rich's `if self.title` decides it: absent, an empty string and an empty
 * `Text` are not, and markup that styles nothing is — it reads as empty text,
 * but the string that holds it is not empty.
 */
export function present(content: string | RichText | undefined): content is string | RichText {
  // Asked of what the content is rather than of what it is not, so a `null`
  // from untyped JS is no content, as Rich's `None` is.
  return typeof content === "string" ? content !== "" : content instanceof RichText && content.plain !== "";
}

/**
 * A label's text as one line of segments at its natural width, its own styles
 * laid over `base`. The caller has already cut it to its room, so it leaves as
 * it stands: `"ignore"` also leaves it unjustified, its spaces where `pad` put
 * them.
 */
export function drawLabel(text: RichText, options: RenderOptions, base: Style | undefined): Segment[] {
  text.overflow = "ignore";
  return [...Segment.applyStyle(text.render(options), base)];
}

/**
 * Caller content as a label, or no label at all: content that is not
 * `present` draws the plain rule, and markup that styles nothing is an empty
 * label, which still opens a gap in the rule, as Rich's does.
 */
export function inlineLabel(content: string | RichText | undefined): InlineLabel | undefined {
  return present(content) ? new InlineLabel(content) : undefined;
}
