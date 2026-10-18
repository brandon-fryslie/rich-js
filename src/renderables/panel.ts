/**
 * Panel — a bordered box that wraps content, with optional title and subtitle.
 */

import { cellLen, setCellSize, asCellCol, cellCount } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, ROUNDED } from "../core/box.js";
import type { EdgeChars } from "../core/box.js";
import { Measurement } from "../core/measure.js";
import { RichText } from "../core/text.js";
import { cutLabel, drawLabel, embed, inlineLabel, type InlineLabel } from "./embed.js";
import type { PaddingDimensions } from "./padding.js";
import { Padding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, drawsNothing, fitHeight, getStyle, insetHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";

/**
 * A lazily-resolved border accessory. Strings render inline in the
 * border style; a `RichText` accessory lays ONLY its wrapping `style` over
 * the border's (per-range spans within the RichText are not preserved — the
 * accessory is a small status indicator, not an arbitrary span carrier).
 * A function form is evaluated at render time, *after* content has been
 * rendered for the current frame — use this when the accessory mirrors
 * state that the wrapped renderable populates during its own `render()`
 * (e.g. a widget's post-render scroll position). A width that leaves the
 * content no column does not render it, as Rich's does not, and the thunk
 * then reads the state of the last frame that did.
 */
export type BorderAccessory =
  | string
  | RichText
  | (() => string | RichText | undefined);

export interface PanelOptions {
  box?: Box;
  title?: string | RichText;
  subtitle?: string | RichText;
  /**
   * Right-aligned accessory in the bottom border, just left of the
   * `bottomRight` corner. Coexists with `subtitle` — the subtitle
   * remains centered in the remaining space. Padded with a leading/
   * trailing space like `title`/`subtitle`, so passing `"[14/102]"`
   * renders as `─ [14/102] ┘`.
   */
  bottomRightAccessory?: BorderAccessory;
  expand?: boolean;
  style?: string | Style;
  borderStyle?: string | Style;
  /**
   * Style for the title text in the top border, laid over `borderStyle`:
   * what it sets wins, and what it leaves unset the border's supplies.
   */
  titleStyle?: string | Style;
  /**
   * Style for the subtitle text in the bottom border, laid over
   * `borderStyle` as `titleStyle` is.
   */
  subtitleStyle?: string | Style;
  width?: number;
  padding?: PaddingDimensions;
}

/**
 * How one requested outer width divides into the two frame columns and the
 * span between them, where the body — the content inside its padding — is
 * drawn.
 *
 * [LAW:one-source-of-truth] Every row a panel emits — both borders and every
 * body row — is measured from this one division, so they cannot disagree
 * about where the frame sits. The fields are cell counts that sum to exactly
 * the requested width, which is what makes "no emitted line exceeds the width
 * we were given" true by construction rather than by a clamp at each site,
 * and why the width-1 crash cannot come back: each frame column takes at most
 * the cells left to it, so no subtraction can go negative. That is also the one place this departs from Rich,
 * whose panel at width 1 draws both corners anyway, two cells wide.
 *
 * Padding is not divided here. The body is a `Padding`, as Rich's is, so the
 * padding is paid however `Padding` pays it — in full, with content left no
 * column drawn as nothing.
 */
interface PanelGeometry {
  /** Width of the left frame column: 1, or 0 below the width to afford it. */
  readonly left: number;
  /** Width of the right frame column: 1, or 0 below the width to afford it. */
  readonly right: number;
  /** The cells between the frame columns, which the body is drawn across. */
  readonly spanWidth: number;
}

function layoutPanel(outerWidth: number): PanelGeometry {
  // Panel's one division point, and the width reaching it is not always one
  // this file produced: `_getPanelWidth` derives the fit-mode width from
  // `Measurement.get` on an arbitrary `Measurable`, so a renderable reporting a
  // negative maximum arrives here unparsed and reaches `repeat` as a negative
  // count.
  const width = cellCount(outerWidth);
  const left = Math.min(1, width);
  const right = Math.min(1, width - left);
  return { left, right, spanWidth: width - left - right };
}

/** The cells a panel's frame takes from the width it is given. */
function frameWidth(geometry: PanelGeometry): number {
  return geometry.left + geometry.right;
}

/**
 * How a title or subtitle string is read: always as markup and never
 * highlighted, whatever the console says, because Rich's `Panel` reads its
 * title with `Text.from_markup` rather than through the console.
 */
function borderLabel(options: RenderOptions): RenderOptions {
  return { ...options, markup: true, highlight: false };
}

/** A title or subtitle as Rich's `Panel._title` sets it: read as a border reads it, a space either side. */
function borderTitle(label: InlineLabel, options: RenderOptions): RichText {
  return label.text(borderLabel(options)).pad(1);
}

/**
 * The style of text set into a border — title, subtitle and accessory alike:
 * its own laid over the border's, the one rule for "what colour is the title
 * text in". Laid over rather than in place of it, as Rich's `stylize_before`
 * does, because the border's style carries the panel's own: a title that
 * replaced it cut a hole in the panel's background on the top row.
 */
function borderTextStyle(border: Style | undefined, own: Style): Style | undefined {
  return own.isNull ? border : (border ?? NULL_STYLE).add(own);
}

/**
 * A border row: the opening corner, the rule across `span` cells with `label`
 * centred in it, and `close` — the closing corner, or nothing when the caller
 * sets something between the rule and its corner.
 *
 * Cut as Rich cuts it. An unlabelled rule is one run, corners included. A
 * label is set into the `span - 2` cells between one rule cell either side,
 * truncated to them as Rich's `align_text` truncates it — marked only when the
 * label's own overflow is `"ellipsis"` — and centred with the rule filling the
 * rest, so the row leaves as corner-and-rule, rule, label, rule,
 * rule-and-corner. Rich draws no label in a span of two cells or fewer
 * (`width <= 4`), where it would sit on the corners.
 */
function borderRow(
  options: RenderOptions,
  edge: EdgeChars,
  geometry: PanelGeometry,
  span: number,
  label: InlineLabel | undefined,
  labelStyle: Style | undefined,
  border: Style | undefined,
  close: string,
): Segment[] {
  const corner = edge.left.repeat(geometry.left);
  if (label === undefined || span <= 2) {
    return [new Segment(corner + edge.horizontal.repeat(span) + close, border)];
  }
  const canvas = span - 2;
  const text = borderTitle(label, options);
  cutLabel(text, canvas, text.overflow === "ellipsis" ? drawable(options, "\u2026", ".") : "");
  const fitted = drawLabel(text, borderLabel(options), labelStyle);
  const excess = canvas - Segment.getLineLength(fitted);
  const before = Math.floor(excess / 2);
  return [
    new Segment(corner + edge.horizontal, border),
    new Segment(edge.horizontal.repeat(before), border),
    ...fitted,
    new Segment(edge.horizontal.repeat(excess - before), border),
    new Segment(edge.horizontal + close, border),
  ];
}

export class Panel implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly box: Box;
  readonly title: string | RichText | undefined;
  readonly subtitle: string | RichText | undefined;
  readonly bottomRightAccessory: BorderAccessory | undefined;
  readonly expand: boolean;
  readonly style: string | Style;
  readonly borderStyle: string | Style;
  readonly titleStyle: string | Style | undefined;
  readonly subtitleStyle: string | Style | undefined;
  readonly width: number | undefined;
  private readonly _titleLabel: InlineLabel | undefined;
  private readonly _subtitleLabel: InlineLabel | undefined;
  /**
   * What the frame is drawn around: the content inside its padding, on the
   * panel's ground. Rich's `Panel` draws its body as this same `Padding`, so
   * how a squeezed width divides between padding and content is answered once,
   * by `Padding`, for both.
   */
  private readonly _body: Padding;

  /** The padding inside the frame, top, right, bottom, left — the body's, read back. */
  get padding(): readonly [number, number, number, number] {
    const body = this._body;
    return [body.top, body.right, body.bottom, body.left];
  }

  constructor(
    content: string | RichText | Renderable,
    options?: PanelOptions,
  ) {
    this.renderable = embed(content);
    this.box = options?.box ?? ROUNDED;
    this.title = options?.title;
    this.subtitle = options?.subtitle;
    this._titleLabel = inlineLabel(this.title);
    this._subtitleLabel = inlineLabel(this.subtitle);
    this.bottomRightAccessory = options?.bottomRightAccessory;
    this.expand = options?.expand !== false;
    this.style = options?.style ?? NULL_STYLE;
    this.borderStyle = options?.borderStyle ?? NULL_STYLE;
    this.titleStyle = options?.titleStyle;
    this.subtitleStyle = options?.subtitleStyle;
    this.width = options?.width;
    this._body = new Padding(this.renderable, options?.padding ?? [0, 1, 0, 1], { style: this.style });
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    const box = this.box.substitute(options);
    // [LAW:one-source-of-truth] `style` is the ground the whole panel is drawn
    // on, as Rich's is: the frame's style is the border style laid over it,
    // and the content is rendered on top of it. Applied to the padding alone,
    // "white on dark_blue" drew a blue ring with a hole where the text was.
    const borderStyle = getStyle(options, this.style).add(getStyle(options, this.borderStyle));
    const border = borderStyle.isNull ? undefined : borderStyle;

    const geometry = layoutPanel(this._getPanelWidth(options));
    const bodyLines = this._renderBody(options, geometry.spanWidth);

    yield* this._renderTopBorder(options, box, geometry, border);
    const frame = box.getContentChars("row");
    for (const line of bodyLines) {
      yield new Segment(frame.left.repeat(geometry.left), border);
      yield* line;
      yield new Segment(frame.right.repeat(geometry.right), border);
      yield Segment.line();
    }
    yield* this._renderBottomBorder(options, box, geometry, border);
  }

  /**
   * The body's rows, held to the region as Rich's `render_lines` holds them —
   * padded below, cropped from the bottom — and each exactly `spanWidth`
   * cells: `Padding` makes every row its block's width, cropping content that
   * ignored its canvas. A span of no cells renders nothing, as Rich's
   * `Console.render` renders nothing under one column, so outside a region it
   * draws no rows, padding rows included, and inside one the frame stands
   * around empty rows. The render happens before either border is drawn,
   * because a `bottomRightAccessory` thunk reads state the content's render
   * populates.
   */
  private _renderBody(options: RenderOptions, spanWidth: number): Segment[][] {
    // Two border rows are the panel's own, and the vertical padding is the
    // body's. Handed on as a region, the rest is the panel's to shape, which
    // is what stretches its frame down a pane and keeps its bottom border
    // inside one. No highlighter: what the panel holds is drawn plain, as
    // Rich's `Panel` hands its body `highlight=False`.
    const bodyOptions: RenderOptions = {
      ...options,
      highlight: false,
      maxWidth: spanWidth,
      height: insetHeight(options.height, 2),
    };
    const lines = drawsNothing(bodyOptions) ? [] : Segment.splitLines(this._body.render(bodyOptions));
    return fitHeight(lines, bodyOptions.height);
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    const options = withCellWidth(rawOptions);

    // Rich's `__rich_measure__`, which is not its render's arithmetic: a
    // declared width is the measurement whatever the panel then draws inside
    // it, and a title counts as content beside the body, with the padding and
    // frame around it, where the render holds it between one rule cell either
    // side. A parent sizing from it sizes as Rich's parent does.
    const declared = this._declaredWidth;
    if (declared !== undefined) {
      const width = Math.min(options.maxWidth, declared);
      return { minimum: width, maximum: width };
    }
    const content = this._contentRange(options);
    const overhead = frameWidth(layoutPanel(options.maxWidth)) + this._body.left + this._body.right;
    const maximum = Math.min(options.maxWidth, Math.max(content.maximum, this._labelWidth(options) + overhead));
    return { minimum: Math.min(content.minimum, maximum), maximum };
  }

  /** The body plus the frame around it, both read off the division it will render against. */
  private _contentRange(options: RenderOptions): { minimum: number; maximum: number } {
    const geometry = layoutPanel(options.maxWidth);
    const measurement = Measurement.get({ ...options, maxWidth: geometry.spanWidth }, this._body);
    return {
      minimum: measurement.minimum + frameWidth(geometry),
      maximum: measurement.maximum + frameWidth(geometry),
    };
  }

  /** The cells the title's label takes, its padding included; none without a title. */
  private _labelWidth(options: RenderOptions): number {
    return this._titleLabel === undefined ? 0 : borderTitle(this._titleLabel, options).cellLength;
  }

  /**
   * The width this panel was told to be, as a count of cells.
   *
   * [LAW:one-source-of-truth] `measure` and `_getPanelWidth` read the field
   * from here, so neither can count it differently from the other.
   */
  private get _declaredWidth(): number | undefined {
    return this.width === undefined ? undefined : cellCount(this.width);
  }

  /**
   * As Rich's `__rich_console__` sizes it: a declared width is a ceiling that
   * `expand` fills and a fitted panel fits its content inside, and the title
   * widens either.
   */
  private _getPanelWidth(options: RenderOptions): number {
    const ceiling = Math.min(options.maxWidth, this._declaredWidth ?? options.maxWidth);
    const body = this.expand ? ceiling : this._contentRange({ ...options, maxWidth: ceiling }).maximum;
    // The title holds its label whole between one rule cell either side —
    // past a declared width too, up to the width the panel was offered.
    const floor = this._titleLabel === undefined ? 0 : this._labelWidth(options) + 4;
    return Math.min(options.maxWidth, Math.max(body, floor));
  }

  private *_renderTopBorder(
    options: RenderOptions,
    box: Box,
    geometry: PanelGeometry,
    border: Style | undefined,
  ): Iterable<Segment> {
    const titleStyle = borderTextStyle(border, getStyle(options, this.titleStyle ?? NULL_STYLE));
    yield* borderRow(options, box.top, geometry, geometry.spanWidth, this._titleLabel, titleStyle, border, box.top.right.repeat(geometry.right));
    yield Segment.line();
  }

  private *_renderBottomBorder(
    options: RenderOptions,
    box: Box,
    geometry: PanelGeometry,
    border: Style | undefined,
  ): Iterable<Segment> {
    // Resolve the right accessory *now*, after the body has rendered —
    // `BorderAccessory` owns what a thunk sees.
    const accessory = this._resolveAccessory(this.bottomRightAccessory);
    const accessoryDisplay = accessory === undefined
      ? ""
      : typeof accessory === "string"
        ? ` ${accessory} `
        : ` ${accessory.plain} `;
    // Cell-aware clip: the accessory never claims more than the span.
    const accessoryText = setCellSize(accessoryDisplay, asCellCol(Math.min(cellLen(accessoryDisplay), geometry.spanWidth)));
    const accessoryOwn = accessory instanceof RichText ? accessory.resolvedStyle(options) : NULL_STYLE;

    const subtitleStyle = borderTextStyle(border, getStyle(options, this.subtitleStyle ?? NULL_STYLE));
    // The accessory hugs the bottom-right corner; the rule and subtitle are
    // laid out, as Rich lays them, across the span it leaves. With no
    // accessory the corner closes the rule's last run, as Rich's does.
    const corner = box.bottom.right.repeat(geometry.right);
    const [close, afterAccessory] = accessoryText === "" ? [corner, ""] : ["", corner];
    yield* borderRow(options, box.bottom, geometry, geometry.spanWidth - cellLen(accessoryText), this._subtitleLabel, subtitleStyle, border, close);
    yield new Segment(accessoryText, borderTextStyle(border, accessoryOwn));
    yield new Segment(afterAccessory, border);
    yield Segment.line();
  }

  private _resolveAccessory(
    a: BorderAccessory | undefined,
  ): string | RichText | undefined {
    if (a === undefined) return undefined;
    if (typeof a === "function") return a();
    return a;
  }

  // --- Static factory ---

  static fit(
    content: string | RichText | Renderable,
    options?: Omit<PanelOptions, "expand">,
  ): Panel {
    return new Panel(content, { ...options, expand: false });
  }
}
