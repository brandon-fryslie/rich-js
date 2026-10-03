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
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { drawable, fitHeight, getStyle, insetHeight, withBoundedWidth, withCellWidth } from "../core/protocol.js";

/**
 * A lazily-resolved border accessory. Strings render inline in the
 * border style; a `RichText` accessory lays ONLY its wrapping `style` over
 * the border's (per-range spans within the RichText are not preserved — the
 * accessory is a small status indicator, not an arbitrary span carrier).
 * A function form is evaluated at render time, *after* content has been
 * rendered for the current frame — use this when the accessory mirrors
 * state that the wrapped renderable populates during its own `render()`
 * (e.g. a widget's post-render scroll position).
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
 * How one requested outer width divides into frame columns, padding and
 * content canvas.
 *
 * [LAW:one-source-of-truth] Every row a panel emits — both borders, the
 * padding rows, the content rows — is measured from this one division, so
 * they cannot disagree about where the frame sits. The fields are cell counts
 * that sum to exactly the requested width, which is what makes "no emitted
 * line exceeds the width we were given" true by construction rather than by
 * a clamp at each site. It is also why the width-1 crash cannot come back:
 * there is no subtraction left that can go negative.
 *
 * Cells are handed out in priority order — the two frame columns, then a
 * first cell of content, then the configured padding, then the remainder
 * back to content. Content outranking padding is the reason a squeezed panel
 * keeps showing something down to width 3, instead of spending its last
 * cells on blank padding with nothing left to pad.
 */
interface PanelGeometry {
  /** Width of the left frame column: 1, or 0 below the width to afford it. */
  readonly left: number;
  /** Width of the right frame column: 1, or 0 below the width to afford it. */
  readonly right: number;
  readonly padLeft: number;
  readonly contentWidth: number;
  readonly padRight: number;
  /** padLeft + contentWidth + padRight — the span between the frame columns. */
  readonly spanWidth: number;
}

function layoutPanel(
  outerWidth: number,
  padding: readonly [number, number, number, number],
): PanelGeometry {
  const [, padRightWanted, , padLeftWanted] = padding;
  // Panel's one division point, and the width reaching it is not always one
  // this file produced: `_getPanelWidth` derives the fit-mode width from
  // `Measurement.get` on an arbitrary `Measurable`, so a renderable reporting a
  // negative maximum arrives here unparsed and reaches `repeat` as a negative
  // count.
  let budget: number = cellCount(outerWidth);
  const take = (want: number): number => {
    const got = Math.min(want, budget);
    budget -= got;
    return got;
  };

  const left = take(1);
  const right = take(1);
  const firstContentCell = take(1);
  const padLeft = take(padLeftWanted);
  const padRight = take(padRightWanted);
  const contentWidth = firstContentCell + budget;

  return {
    left,
    right,
    padLeft,
    contentWidth,
    padRight,
    spanWidth: padLeft + contentWidth + padRight,
  };
}

/**
 * Every cell of a panel that is not content canvas. Read off the geometry
 * rather than recomputed as `2 + padLeft + padRight`, because the two differ
 * exactly where this panel is squeezed: a width that cannot afford its right
 * frame column or its padding does not spend cells on them, and a measurement
 * that assumed it did would report a minimum larger than its own maximum.
 */
function frameOverhead(geometry: PanelGeometry): number {
  return geometry.left + geometry.right + geometry.padLeft + geometry.padRight;
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
  readonly padding: [number, number, number, number];
  private readonly _titleLabel: InlineLabel | undefined;
  private readonly _subtitleLabel: InlineLabel | undefined;

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
    this.padding = normalizePadding(options?.padding ?? [0, 1, 0, 1]);
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    const box = this.box.substitute(options);
    // [LAW:one-source-of-truth] `style` is the ground the whole panel is drawn
    // on, as Rich's is: the frame's style is the border style laid over it,
    // and the content is rendered on top of it. Applied to the padding alone,
    // "white on dark_blue" drew a blue ring with a hole where the text was.
    const style = getStyle(options, this.style);
    const borderStyle = style.add(getStyle(options, this.borderStyle));
    const border = borderStyle.isNull ? undefined : borderStyle;
    const contentStyle = style.isNull ? undefined : style;

    const geometry = layoutPanel(this._getPanelWidth(options), this.padding);
    const [padTop, , padBottom] = this.padding;

    const contentLines = this._renderContent(options, geometry.contentWidth, contentStyle);

    yield* this._renderTopBorder(options, box, geometry, border);

    for (let i = 0; i < padTop; i++) {
      yield* this._renderPaddingRow(box, geometry, border, contentStyle);
    }

    for (const line of contentLines) {
      yield* this._renderRow(box, geometry, line, border, contentStyle);
    }

    for (let i = 0; i < padBottom; i++) {
      yield* this._renderPaddingRow(box, geometry, border, contentStyle);
    }

    yield* this._renderBottomBorder(options, box, geometry, border);
  }

  /**
   * The wrapped renderable's lines, laid out on a canvas `contentWidth` cells
   * wide. Below width 3 a panel is all frame and the canvas holds no lines —
   * but the render still happens, because a `bottomRightAccessory` thunk
   * fires at every width and reads state this render populates.
   */
  private _renderContent(
    options: RenderOptions,
    contentWidth: number,
    style: Style | undefined,
  ): Segment[][] {
    // Two border rows and the vertical padding are the panel's own. Handed on
    // as a region, the rest is the panel's to shape, which is what stretches
    // its frame down a pane and keeps its bottom border inside one.
    const [padTop, , padBottom] = this.padding;
    const height = insetHeight(options.height, 2 + padTop + padBottom);
    // No highlighter: what the panel holds is drawn plain, as Rich's `Panel`
    // hands its body `highlight=False`.
    const innerOptions: RenderOptions = { ...options, highlight: false, maxWidth: contentWidth, height };
    const lines = fitHeight(
      Segment.splitLines([...Segment.applyStyle(this.renderable.render(innerOptions), style)]),
      height,
    );
    return contentWidth === 0 ? [] : lines;
  }

  /**
   * One row of the panel body, cut where Rich cuts it: frame column, left
   * padding, the content line made exactly `contentWidth` wide, right padding,
   * frame column — each its own segment, so each its own SGR run.
   *
   * [LAW:single-enforcer] `adjustLineLength` is the one place the content's
   * width is decided: content that rendered wider than its canvas (a `Table`
   * at its natural width, say) is cropped back to it, and a short line is
   * filled out to it, so the right padding always starts at the same column.
   */
  private *_renderRow(
    box: Box,
    geometry: PanelGeometry,
    line: Segment[],
    border: Style | undefined,
    contentStyle: Style | undefined,
  ): Iterable<Segment> {
    const frame = box.getContentChars("row");
    yield new Segment(frame.left.repeat(geometry.left), border);
    yield new Segment(" ".repeat(geometry.padLeft), contentStyle);
    yield* Segment.adjustLineLength(line, geometry.contentWidth, contentStyle);
    yield new Segment(" ".repeat(geometry.padRight), contentStyle);
    yield new Segment(frame.right.repeat(geometry.right), border);
    yield Segment.line();
  }

  /**
   * A row of vertical padding: one blank run across the whole span, as Rich's
   * `Padding` draws its blank lines, not a content row with nothing in it.
   */
  private *_renderPaddingRow(
    box: Box,
    geometry: PanelGeometry,
    border: Style | undefined,
    contentStyle: Style | undefined,
  ): Iterable<Segment> {
    const frame = box.getContentChars("row");
    yield new Segment(frame.left.repeat(geometry.left), border);
    yield new Segment(" ".repeat(geometry.spanWidth), contentStyle);
    yield new Segment(frame.right.repeat(geometry.right), border);
    yield Segment.line();
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
    const overhead = frameOverhead(layoutPanel(options.maxWidth, this.padding));
    const maximum = Math.min(options.maxWidth, Math.max(content.maximum, this._labelWidth(options) + overhead));
    return { minimum: Math.min(content.minimum, maximum), maximum };
  }

  /** The content plus its own frame, both read off the division it will render against. */
  private _contentRange(options: RenderOptions): { minimum: number; maximum: number } {
    const geometry = layoutPanel(options.maxWidth, this.padding);
    const overhead = frameOverhead(geometry);
    const measurement = Measurement.get(
      { ...options, maxWidth: geometry.contentWidth },
      this.renderable,
    );
    return {
      minimum: measurement.minimum + overhead,
      maximum: Math.min(options.maxWidth, measurement.maximum + overhead),
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
    // Resolve the right accessory *now*. Function form evaluates after
    // content has been rendered (Panel.render collects content segments
    // before yielding any borders), so the thunk sees fresh widget state.
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
