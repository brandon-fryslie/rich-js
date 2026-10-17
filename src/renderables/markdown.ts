/**
 * Markdown — renders Markdown content to the terminal.
 *
 * `markdown-parse.ts` reads the source, once, when a `Markdown` is made; this
 * module draws what it read. A blockquote and a list item are drawn beside a
 * gutter — the quote's bar, the item's marker then its hang — and a table as
 * Rich draws one. Where CommonMark leaves the drawing open, Rich's is
 * followed: HTML, a block of it or a tag inline, is drawn as Rich draws it,
 * not at all.
 */

import { cellLen, expandTabs, parseTabSize } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { RichText, resolveStyle } from "../core/text.js";
import { Rule } from "./rule.js";
import { Table } from "./table.js";
import { parseMarkdown, type CellAlign, type Inline, type MdToken } from "./markdown-parse.js";
import { SIMPLE } from "../core/box.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle, groundedStyle, stackedHeight } from "../core/protocol.js";

export interface MarkdownOptions {
  /** The style of `inline code`: a theme name or a style definition. Default `markdown.code`. */
  inlineCodeStyle?: string | Style;
  /**
   * Whether a link's text is the link. `false` writes the URL after the text
   * in parentheses, for a reader who cannot click it. Default `true`.
   */
  hyperlinks?: boolean;
  /** How body text — paragraphs, list items, quotes — is placed in its width. Default `"left"`; headings keep their own. */
  justify?: Justify;
}

type Justify = NonNullable<RenderOptions["justify"]>;

/** What the options say about inline text, which every block's text is drawn with. */
interface InlineSettings {
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;
}

/** What the options say about every block: its inline text, and where body text sits. */
interface BlockSettings extends InlineSettings {
  readonly justify: Justify;
}

/**
 * `inlines` in `style`: a text of its own whose style sits under every style
 * inside it, so appended where it goes it draws as Rich draws a nested
 * construct — the inner style on top.
 */
function styled(inlines: readonly Inline[], style: string | Style, settings: InlineSettings, options: RenderOptions): RichText {
  const result = new RichText("", { style });
  appendInline(result, inlines, settings, options);
  return result;
}

/**
 * `label` linked to `url`, appended to `result` as Rich draws a link: the
 * label is the link, or without hyperlinks nothing is, and the label's text
 * is written plain with the URL after it, for a reader who cannot click it.
 */
function appendLink(result: RichText, label: RichText, url: string, settings: InlineSettings): void {
  if (settings.hyperlinks) {
    result.append(new RichText("", { style: new Style({ link: url }) }).append(new RichText("", { style: "markdown.link_url" }).append(label)));
  } else {
    result.append(label.plain, "markdown.link").append(" (").append(url, "markdown.link_url").append(")");
  }
}

/** `inlines` appended to `result` as Rich draws each: inline HTML as nothing, and text as it is. */
function appendInline(result: RichText, inlines: readonly Inline[], settings: InlineSettings, options: RenderOptions): void {
  for (const inline of inlines) {
    switch (inline.kind) {
      case "text":
        result.append(inline.text);
        break;
      case "code":
        result.append(inline.code, groundedStyle(options, resolveStyle(options, settings.inlineCodeStyle)));
        break;
      case "html":
        break;
      case "emphasis":
        result.append(styled(inline.children, inline.style, settings, options));
        break;
      case "link":
        appendLink(result, styled(inline.children, "", settings, options), inline.url, settings);
        break;
      case "autolink":
        appendLink(result, new RichText(inline.text), inline.url, settings);
        break;
      case "image": {
        // Rich's ImageItem: a picture glyph, then the alt text — or, with
        // none, the image's file name — linked to the image, then a space.
        const title = inline.alt || (inline.src.replace(/\/+$/, "").split("/").pop() ?? "");
        const link = settings.hyperlinks ? new Style({ link: inline.src }) : "";
        result.append(drawable(options, "🌆 ", "")).append(title, link).append(" ");
        break;
      }
    }
  }
}

/**
 * What `draw` renders in what is left of the width beside a gutter, each of
 * its rows ended. The first row's gutter is `first` and every later row's is
 * `rest`, so a list item's text hangs clear of its bullet and a quote's bar
 * runs its full height. A block with no gutter passes two empty segments:
 * every block is laid out the same way. What is drawn keeps at least one
 * column however wide the gutter, so a row may overrun its width but no gutter
 * swallows what it introduces.
 */
function* guttered(
  draw: (options: RenderOptions) => Iterable<Segment>,
  options: RenderOptions,
  first: Segment,
  rest: Segment,
  style?: Style,
): Iterable<Segment> {
  const width = Math.max(1, options.maxWidth - cellLen(first.text));
  const rows = Segment.splitLines(Segment.applyStyle([...draw({ ...options, maxWidth: width })], style));
  for (const [row, line] of rows.entries()) {
    yield row === 0 ? first : rest;
    yield* line;
    yield Segment.line();
  }
}

/**
 * `text` as inline Markdown, placed by `justify` in `style`, wrapped, with
 * every row ended. `style` is a span under the inline spans, as Rich's
 * element style is, not the text's base: placement pads in the base style,
 * and a heading's padding is not underlined.
 */
function inline(
  text: readonly Inline[],
  settings: InlineSettings,
  justify: Justify | undefined,
  style?: Style,
): (options: RenderOptions) => Iterable<Segment> {
  return function* (options) {
    const body = new RichText("", { end: "", style });
    appendInline(body, text, settings, options);
    // `append` lays the body's base style down as the first span.
    yield* new RichText("", { end: "", justify }).append(body).render(options);
    yield Segment.line();
  };
}

/** The tab stop code is drawn with, as Rich's `Syntax` draws it. */
const CODE_TAB_SIZE = parseTabSize(8);

const NO_GUTTER = new Segment("");

/**
 * Each block in `tokens`, every row it draws ended, body text placed by
 * `settings.justify`. A heading keeps its own placement whatever `settings`
 * or `options` say — Rich's: an h1 centred, every other level left — and its
 * style stops where its text does.
 */
function* renderTokens(tokens: readonly MdToken[], options: RenderOptions, settings: BlockSettings): Iterable<Segment> {
  for (const token of tokens) {
    switch (token.type) {
      case "heading": {
        const style = getStyle(options, `markdown.h${Math.min(token.level, 4)}`);
        const draw = inline(token.text, settings, token.level === 1 ? "center" : undefined, style);
        yield* guttered(draw, { ...options, justify: undefined }, NO_GUTTER, NO_GUTTER);
        break;
      }

      case "paragraph": {
        yield* guttered(inline(token.text, settings, settings.justify), options, NO_GUTTER, NO_GUTTER);
        break;
      }

      case "code_block": {
        const codeStyle = groundedStyle(options, getStyle(options, "markdown.code"));
        // Tabs expanded here, as `Syntax` expands them, since a terminal would
        // count a raw one from its own column 0 and not the code's.
        for (const line of expandTabs(token.code, CODE_TAB_SIZE).text.split("\n")) {
          yield new Segment(line, codeStyle);
          yield Segment.line();
        }
        break;
      }

      case "hr": {
        const rule = new Rule(undefined, { style: "markdown.hr" });
        yield* rule.render(options);
        break;
      }

      case "list_item": {
        const marker = token.marker.kind === "number" ? `${token.marker.label} ` : drawable(options, "  • ", "  * ");
        const hang = new Segment(" ".repeat(cellLen(marker)));
        const body = (inner: RenderOptions) => renderTokens(token.children, inner, settings);
        yield* guttered(body, options, new Segment(marker), hang);
        break;
      }

      case "blockquote": {
        const bar = new Segment(drawable(options, "▎ ", "| "), getStyle(options, "markdown.hr"));
        const body = (inner: RenderOptions) => renderTokens(token.children, inner, settings);
        yield* guttered(body, options, bar, bar, Style.parse("dim italic"));
        break;
      }

      case "table": {
        // Rich's TableElement: each cell inline Markdown placed by its
        // column's alignment, the header's in `markdown.table.header` on top.
        const cell = (text: readonly Inline[], justify: CellAlign): RichText => {
          const content = new RichText("", { justify });
          appendInline(content, text, settings, options);
          return content;
        };
        const table = new Table({ box: SIMPLE, padEdge: false, style: "markdown.table.border", showEdge: true, collapsePadding: true });
        for (const { header, align } of token.columns) table.addColumn(cell(header, align).stylize("markdown.table.header"));
        for (const row of token.rows) table.addRow(...row.map((text, n) => cell(text, token.columns[n]!.align)));
        yield* table.render(options);
        break;
      }

      case "html_block":
        // Rich draws nothing for one.
        break;

      case "blank":
        yield Segment.line();
        break;
    }
  }
}

export class Markdown implements Renderable, Measurable {
  readonly markdown: string;
  readonly inlineCodeStyle: string | Style;
  readonly hyperlinks: boolean;
  readonly justify: Justify;
  // Read once, as Rich's Markdown parses its markup when it is made: nothing a
  // render is asked for changes how the source reads, and a Live redraws it
  // every frame.
  private readonly parsed: readonly MdToken[];

  constructor(markdown: string, options?: MarkdownOptions) {
    this.markdown = markdown;
    this.parsed = parseMarkdown(markdown);
    this.inlineCodeStyle = options?.inlineCodeStyle ?? "markdown.code";
    this.hyperlinks = options?.hyperlinks !== false;
    this.justify = options?.justify ?? "left";
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    // Every block below is one of a stack.
    const options = { ...rawOptions, height: stackedHeight(rawOptions.height) };
    yield* renderTokens(this.parsed, options, this);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
