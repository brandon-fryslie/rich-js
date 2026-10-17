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

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { RichText, resolveStyle } from "../core/text.js";
import { Rule } from "./rule.js";
import { Padding } from "./padding.js";
import { pyRstrip } from "./python-space.js";
import { Syntax } from "./syntax.js";
import { Table } from "./table.js";
import { parseMarkdown, type CellAlign, type Inline, type MdToken } from "./markdown-parse.js";
import { SIMPLE } from "../core/box.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, getStyle, groundedStyle, stackedHeight, withCellWidth } from "../core/protocol.js";

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

/** An inline holding inlines of its own. */
type Container = Extract<Inline, { readonly children: readonly Inline[] }>;

/** A step of `walk`: an inline holding none, met inside its innermost container's frame, or the end of the container whose frame that was. */
type WalkStep<Frame> =
  | { readonly kind: "leaf"; readonly inline: Exclude<Inline, Container>; readonly within: Frame }
  | { readonly kind: "leave"; readonly frame: Frame };

/**
 * Every inline in `inlines` holding none, in document order, inside the
 * frame `open` makes for each container it sits in as `walk` reaches it —
 * `root` outside them all — and each container's `leave` after its last. A
 * loop over a stack, not recursion: emphasis nests as deep as its source
 * does, and Rich, walking markdown-it's flat token stream, draws ten thousand
 * levels of it.
 */
function* walk<Frame>(inlines: readonly Inline[], root: Frame, open: (container: Container, within: Frame) => Frame): Iterable<WalkStep<Frame>> {
  const stack = [{ inlines, next: 0, frame: root }];
  while (stack.length > 0) {
    const top = stack[stack.length - 1]!;
    const inline = top.inlines[top.next++];
    if (inline === undefined) {
      stack.pop();
      if (stack.length > 0) yield { kind: "leave", frame: top.frame };
      continue;
    }
    if ("children" in inline) stack.push({ inlines: inline.children, next: 0, frame: open(inline, top.frame) });
    else yield { kind: "leaf", inline, within: top.frame };
  }
}

/** The styles Rich enters for a link with hyperlinks on, outermost first. */
function linkStyles(url: string): (string | Style)[] {
  return [new Style({ link: url }), "markdown.link_url"];
}

/** The style a quote draws its bar in and lays under everything it holds. */
const QUOTE_STYLE = "markdown.block_quote";

function headingStyle(options: RenderOptions, level: number): Style {
  return getStyle(options, `markdown.h${Math.min(level, 4)}`);
}

/**
 * `inlines` appended to `result` as Rich draws each: emphasis and code in
 * their styles, inline HTML as nothing, an image as nothing where it sits —
 * `drawImage` draws it, ahead of the block — and text as it is. A link's text
 * is the link; or, without hyperlinks, nothing is, and its text is written
 * plain with the URL after it, for a reader who cannot click it.
 */
function appendInline(result: RichText, inlines: readonly Inline[], settings: InlineSettings, options: RenderOptions): void {
  // Rich's style stack: each open construct's style laid over the styles it
  // sits in, so every piece of text takes one span, the style on top, and a
  // nest ten thousand deep costs one combination a level.
  const stack = [Style.null()];
  // Inside a link drawn without hyperlinks, whose text is styled whole as it closes, nothing is styled.
  let plain = false;
  // The style on top with `styles` laid over it.
  const over = (styles: readonly (string | Style)[]): Style =>
    styles.reduce<Style>((under, style) => under.add(resolveStyle(options, style)), stack[stack.length - 1]!);
  // The text from `start` to the end in the style on top, with `styles` over it.
  const paint = (start: number, styles: readonly (string | Style)[] = []): void => {
    if (!plain) result.stylize(over(styles), start);
  };
  const write = (text: string, styles?: readonly (string | Style)[]): void => {
    const start = result.length;
    result.append(text);
    paint(start, styles);
  };
  const enter = (styles: readonly (string | Style)[]): (() => void) => {
    stack.push(over(styles));
    return () => stack.pop();
  };
  // A link to `url` opened here: its text is the link, or without hyperlinks
  // is written plain, in `markdown.link`, with the URL after it when it closes.
  const openLink = (url: string): (() => void) => {
    if (settings.hyperlinks) return enter(linkStyles(url));
    const [start, outer] = [result.length, plain];
    plain = true;
    return () => {
      plain = outer;
      paint(start, ["markdown.link"]);
      write(" (");
      write(url, ["markdown.link_url"]);
      write(")");
    };
  };
  // Each construct's frame is what closing it does.
  const open = (container: Container): (() => void) => {
    switch (container.kind) {
      case "emphasis":
        return enter([`markdown.${container.tag}`]);
      case "link":
        return openLink(container.url);
    }
  };
  for (const step of walk(inlines, () => {}, open)) {
    if (step.kind === "leave") {
      step.frame();
      continue;
    }
    const inline = step.inline;
    switch (inline.kind) {
      case "text":
        write(inline.text);
        break;
      // Rich writes a soft break as a space and a hard one as a newline.
      case "softbreak":
        write(" ");
        break;
      case "hardbreak":
        write("\n");
        break;
      case "code":
        write(inline.code, [groundedStyle(options, resolveStyle(options, settings.inlineCodeStyle))]);
        break;
      case "html":
      case "image":
        break;
      case "autolink": {
        const close = openLink(inline.url);
        write(inline.text);
        close();
        break;
      }
    }
  }
}

/** An image, with the styles of every construct it sits in and the link it sits in, if any. */
interface Image {
  readonly alt: string;
  readonly src: string;
  readonly styles: readonly (string | Style)[];
  readonly link: string | undefined;
}

/**
 * What Rich's render loop meets, in its order: an image, drawn the moment it
 * is met; a block at the top of the document, drawn as it exits; and each
 * element exiting, with its `new_line` — whether Rich puts a blank row ahead
 * of whatever it draws next. That flag is the only source of blank rows
 * between blocks: Rich reads no blank line of the source.
 */
type Step =
  | { kind: "image"; image: Image }
  | { kind: "block"; token: MdToken }
  | { kind: "exit"; newLine: boolean };

interface Enclosing {
  readonly styles: readonly (string | Style)[];
  readonly link: string | undefined;
}

const EXIT: Step = { kind: "exit", newLine: true };

/**
 * The steps in a block's text. An image is an element, Rich's `ImageItem`,
 * which sets no `new_line`. Text with no inlines is one too: markdown-it
 * leaves an empty inline token unflattened, and Rich exits it as an element
 * it draws nothing for.
 */
function* inlineSteps(inlines: readonly Inline[], within: Enclosing, settings: InlineSettings): Iterable<Step> {
  if (inlines.length === 0) yield EXIT;
  // The styles of each open construct, innermost last, as Rich's style stack holds them.
  const styles = [...within.styles];
  // Each construct's frame is how many styles it entered, and the link it sits in.
  type Frame = { readonly entered: number; readonly link: string | undefined };
  const open = (container: Container, outer: Frame): Frame => {
    switch (container.kind) {
      case "emphasis":
        styles.push(`markdown.${container.tag}`);
        return { entered: 1, link: outer.link };
      case "link": {
        // Without hyperlinks Rich enters no style for a link, and an image in one is linked to nothing.
        const entered = settings.hyperlinks ? linkStyles(container.url) : [];
        styles.push(...entered);
        return { entered: entered.length, link: container.url };
      }
    }
  };
  for (const step of walk(inlines, { entered: 0, link: within.link }, open)) {
    if (step.kind === "leave") styles.length -= step.frame.entered;
    else if (step.inline.kind === "image") {
      yield { kind: "image", image: { alt: step.inline.alt, src: step.inline.src, styles: [...styles], link: step.within.link } };
      yield { kind: "exit", newLine: false };
    }
  }
}

/**
 * The step Rich takes exiting `token`'s element: every element sets
 * `new_line` but a rule, which draws its own blank row after it.
 */
function exitStep(token: MdToken): Step {
  return { kind: "exit", newLine: token.type !== "hr" };
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
      yield exitStep(child);
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
        yield* children(item, within);
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
      break;
  }
}

/**
 * The steps of the whole document. Rich draws a block at the top of it as it
 * exits, so a block is drawn where its exit is.
 */
function* documentSteps(tokens: readonly MdToken[], options: RenderOptions, settings: InlineSettings): Iterable<Step> {
  for (const token of tokens) {
    yield* stepsInside(token, { styles: [], link: undefined }, options, settings);
    yield { kind: "block", token };
    yield exitStep(token);
  }
}

/**
 * An image drawn as Rich's `ImageItem` draws one: a picture glyph, then the
 * alt text in the styles it sits in — or, with none, the image's file name,
 * unstyled — linked to the link it sits in or else to the image, then a
 * space, at the full width, ending no row — so whatever is drawn next carries
 * on after it.
 */
function drawImage(image: Image, options: RenderOptions, settings: InlineSettings): Iterable<Segment> {
  const title = image.alt ? image.styles.reduce((alt, style) => alt.stylize(style), new RichText(image.alt)) : new RichText(image.src.replace(/\/+$/, "").split("/").pop() ?? "");
  if (settings.hyperlinks) title.stylize(new Style({ link: image.link || image.src || undefined }));
  return new RichText("", { end: "" }).append(drawable(options, "🌆 ", "")).append(title).append(" ").render(options);
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
function* guttered(draw: (options: RenderOptions) => Iterable<Segment>, options: RenderOptions, first: Segment, rest: Segment): Iterable<Segment> {
  const width = Math.max(1, options.maxWidth - cellLen(first.text));
  const rows = Segment.splitLines(draw({ ...options, maxWidth: width }));
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

const NO_GUTTER = new Segment("");

/**
 * `tokens` drawn as Rich's `render_lines` draws a quote's or an item's
 * content: in `style`, every row padded to the width in it and ended.
 */
function* renderLines(tokens: readonly MdToken[], options: RenderOptions, settings: BlockSettings, style: Style): Iterable<Segment> {
  for (const line of Segment.splitLines(Segment.applyStyle(renderTokens(tokens, options, settings), style))) {
    yield* Segment.adjustLineLength(line, options.maxWidth, style);
    yield Segment.line();
  }
}

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
      // Rich's CodeBlock: the code, its trailing whitespace dropped, handed to
      // `Syntax` word-wrapped inside a padding of one cell all round — every
      // cell of the block, padding and all, in the code's style.
      const style = groundedStyle(options, getStyle(options, "markdown.code"));
      const syntax = new Syntax(pyRstrip(token.code), "text", { wordWrap: true });
      yield* new Padding(syntax, 1, { style }).render(options);
      break;
    }

    case "hr": {
      // Rich's HorizontalRule: the rule, drawn in `-` rather than Rule's own
      // glyph, then a blank row of its own.
      const rule = new Rule(undefined, { characters: "-", style: "markdown.hr" });
      yield* rule.render(options);
      yield Segment.line();
      break;
    }

    case "list": {
      // Rich's ListItem: a bullet, or the number without its `.` or `)`,
      // right-aligned in a column sized for the number one past the last
      // item's — Rich's `last_number` — and the hang under it in the marker's
      // style.
      const { start } = token;
      const markerStyle = getStyle(options, start === undefined ? "markdown.item.bullet" : "markdown.item.number");
      const width = start === undefined ? 3 : String(start + token.items.length).length + 2;
      const hang = new Segment(" ".repeat(width), markerStyle);
      for (const [n, item] of token.items.entries()) {
        const marker = start === undefined ? drawable(options, " • ", " * ") : `${String(start + n).padStart(width - 1)} `;
        const body = (inner: RenderOptions) => renderLines(item, inner, settings, getStyle(options, "markdown.item"));
        yield* guttered(body, options, new Segment(marker, markerStyle), hang);
      }
      break;
    }

    case "blockquote": {
      // Rich's BlockQuote: the bar and everything the quote holds in the one
      // style, the content laid out four cells short of the width beside a
      // bar of two, so every row of a quote ends two cells short.
      const style = getStyle(options, QUOTE_STYLE);
      const bar = new Segment(drawable(options, "▌ ", "| "), style);
      const body = (inner: RenderOptions) => renderLines(token.children, inner, settings, style);
      yield* guttered(body, { ...options, maxWidth: options.maxWidth - 2 }, bar, bar);
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
      // Rich draws nothing for it.
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
    // The width parsed once, for every block below, each one of a stack.
    const options = { ...withCellWidth(rawOptions), height: stackedHeight(rawOptions.height) };
    // Rich's `new_line`: set by each element as it exits, read before anything is drawn.
    let newLine = false;
    for (const step of documentSteps(this.parsed, options, this)) {
      if (step.kind === "exit") {
        newLine = step.newLine;
        continue;
      }
      if (newLine) yield Segment.line();
      yield* step.kind === "image" ? drawImage(step.image, options, this) : renderBlock(step.token, options, this);
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 1, maximum: options.maxWidth };
  }
}
