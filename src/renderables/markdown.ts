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

/** `text` inside each of `styles`, outermost first, as Rich stacks the styles of the constructs it sits in. */
function nested(text: RichText, styles: readonly (string | Style)[]): RichText {
  return styles.reduceRight((inner, style) => new RichText("", { style }).append(inner), text);
}

/** The styles Rich enters for a link with hyperlinks on, outermost first. */
function linkStyles(url: string): (string | Style)[] {
  return [new Style({ link: url }), "markdown.link_url"];
}

/** The style a quote lays under everything it holds. */
const QUOTE_STYLE = Style.parse("dim italic");

function headingStyle(options: RenderOptions, level: number): Style {
  return getStyle(options, `markdown.h${Math.min(level, 4)}`);
}

/**
 * `label` linked to `url`, appended to `result` as Rich draws a link: the
 * label is the link, or without hyperlinks nothing is, and the label's text
 * is written plain with the URL after it, for a reader who cannot click it.
 */
function appendLink(result: RichText, label: RichText, url: string, settings: InlineSettings): void {
  if (settings.hyperlinks) {
    result.append(nested(label, linkStyles(url)));
  } else {
    result.append(label.plain, "markdown.link").append(" (").append(url, "markdown.link_url").append(")");
  }
}

/**
 * `inlines` appended to `result` as Rich draws each: inline HTML as nothing,
 * an image as nothing where it sits — `imagesAhead` draws it — and text as it is.
 */
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
      case "image":
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
    }
  }
}

/**
 * What Rich's render loop meets in a block, in its order: an image, with the
 * styles of every construct it sits in and the link it sits in, if any; and
 * each element exiting, with its `new_line` — whether Rich puts a newline
 * ahead of whatever it draws next.
 */
type Step =
  | { kind: "image"; alt: string; src: string; styles: readonly (string | Style)[]; link: string | undefined }
  | { kind: "exit"; newLine: boolean };

interface Enclosing {
  readonly styles: readonly (string | Style)[];
  readonly link: string | undefined;
}

const EXIT: Step = { kind: "exit", newLine: true };

function* inlineSteps(inlines: readonly Inline[], within: Enclosing, settings: InlineSettings): Iterable<Step> {
  for (const inline of inlines) {
    switch (inline.kind) {
      case "image":
        yield { kind: "image", alt: inline.alt, src: inline.src, ...within };
        break;
      case "emphasis":
        yield* inlineSteps(inline.children, { ...within, styles: [...within.styles, inline.style] }, settings);
        break;
      case "link": {
        // Without hyperlinks Rich enters no style for a link, and an image in one is linked to nothing.
        const styles = settings.hyperlinks ? [...within.styles, ...linkStyles(inline.url)] : within.styles;
        yield* inlineSteps(inline.children, { styles, link: inline.url }, settings);
        break;
      }
      case "text":
      case "code":
      case "autolink":
      case "html":
        break;
    }
  }
}

/**
 * The step Rich takes exiting `token`'s element: every element sets
 * `new_line` but a rule, which draws its own blank row after it, and a blank
 * token is no element.
 */
function exitSteps(token: MdToken): readonly Step[] {
  return token.type === "blank" ? [] : [{ kind: "exit", newLine: token.type !== "hr" }];
}

/**
 * The steps inside `token`, up to and not including its own exit: Rich
 * checks `new_line` ahead of drawing a block before it exits it. A table's
 * cells are elements of their own, the header's first.
 */
function* stepsInside(token: MdToken, within: Enclosing, options: RenderOptions, settings: InlineSettings): Iterable<Step> {
  const children = function* (blocks: readonly MdToken[], inner: Enclosing): Iterable<Step> {
    for (const child of blocks) {
      yield* stepsInside(child, inner, options, settings);
      yield* exitSteps(child);
    }
  };
  switch (token.type) {
    case "paragraph":
      yield* inlineSteps(token.text, within, settings);
      break;
    case "heading":
      yield* inlineSteps(token.text, { ...within, styles: [...within.styles, headingStyle(options, token.level)] }, settings);
      break;
    case "list":
      for (const item of token.items) {
        yield* children(item.children, within);
        yield EXIT;
      }
      break;
    case "blockquote":
      yield* children(token.children, { ...within, styles: [...within.styles, QUOTE_STYLE] });
      break;
    case "table":
      for (const cell of [...token.columns.map(({ header }) => header), ...token.rows.flat()]) {
        yield* inlineSteps(cell, within, settings);
        yield EXIT;
      }
      break;
    case "code_block":
    case "html_block":
    case "hr":
    case "blank":
      break;
  }
}

/**
 * Every image in `token`, drawn ahead of it as Rich draws one: the moment its
 * render loop meets it, at the full width, ending no row — so the block's own
 * first row, or the next image, carries on after it. Rich checks `new_line`
 * before everything it draws; the blank tokens between blocks stand for the
 * check ahead of each block's first image, and every check after one is drawn
 * here, the last ahead of the block itself.
 */
function* imagesAhead(token: MdToken, options: RenderOptions, settings: InlineSettings): Iterable<Segment> {
  // Undefined until the first image: until then the check is the blank tokens'.
  let newLine: boolean | undefined;
  for (const step of stepsInside(token, { styles: [], link: undefined }, options, settings)) {
    if (step.kind === "exit") {
      if (newLine !== undefined) newLine = step.newLine;
      continue;
    }
    if (newLine) yield Segment.line();
    // Rich's ImageItem: a picture glyph, then the alt text in the styles it
    // sits in — or, with none, the image's file name, unstyled — linked to the
    // link it sits in or else to the image, then a space.
    const title = step.alt ? nested(new RichText(step.alt), step.styles) : new RichText(step.src.replace(/\/+$/, "").split("/").pop() ?? "");
    if (settings.hyperlinks) title.stylize(new Style({ link: step.link || step.src || undefined }));
    yield* new RichText("", { end: "" }).append(drawable(options, "🌆 ", "")).append(title).append(" ").render(options);
    newLine = false;
  }
  if (newLine) yield Segment.line();
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
  for (const token of tokens) yield* renderBlock(token, options, settings);
}

function* renderBlock(token: MdToken, options: RenderOptions, settings: BlockSettings): Iterable<Segment> {
  switch (token.type) {
    case "heading": {
      const style = headingStyle(options, token.level);
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

    case "list":
      for (const item of token.items) {
        yield* Array.from({ length: item.gap }, () => Segment.line());
        const marker = item.marker.kind === "number" ? `${item.marker.label} ` : drawable(options, "  • ", "  * ");
        const hang = new Segment(" ".repeat(cellLen(marker)));
        const body = (inner: RenderOptions) => renderTokens(item.children, inner, settings);
        yield* guttered(body, options, new Segment(marker), hang);
      }
      break;

    case "blockquote": {
      const bar = new Segment(drawable(options, "▎ ", "| "), getStyle(options, "markdown.hr"));
      const body = (inner: RenderOptions) => renderTokens(token.children, inner, settings);
      yield* guttered(body, options, bar, bar, QUOTE_STYLE);
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
    for (const token of this.parsed) {
      yield* imagesAhead(token, options, this);
      yield* renderBlock(token, options, this);
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
