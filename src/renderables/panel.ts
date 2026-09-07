/**
 * Panel — a bordered box that wraps content, with optional title and subtitle.
 */

import { cellLen, setCellSize, asCellCol, cellCount } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, ROUNDED } from "../core/box.js";
import { Measurement } from "../core/measure.js";
import { RichText } from "../core/text.js";
import type { PaddingDimensions } from "./padding.js";
import { normalizePadding } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable, withBoundedWidth, withCellWidth } from "../core/protocol.js";

/**
 * A lazily-resolved border accessory. Strings render inline in the
 * border style; a `RichText` accessory contributes ONLY its wrapping
 * `style` (per-range spans within the RichText are not preserved — the
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
   * Style for the title text in the top border. Defaults to `borderStyle`
   * (i.e. title inherits the border color). Set independently when the
   * title should pop relative to the border.
   */
  titleStyle?: string | Style;
  /**
   * Style for the subtitle text in the bottom border. Defaults to
   * `borderStyle`.
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

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

function toRenderable(content: string | RichText | Renderable): Renderable {
  if (typeof content === "string") return new RichText(content);
  if (content instanceof RichText) return content;
  return content;
}

export class Panel implements Renderable, Measurable {
  readonly renderable: Renderable;
  readonly box: Box;
  readonly title: string | RichText | undefined;
  readonly subtitle: string | RichText | undefined;
  readonly bottomRightAccessory: BorderAccessory | undefined;
  readonly expand: boolean;
  readonly style: Style;
  readonly borderStyle: Style;
  readonly titleStyle: Style | undefined;
  readonly subtitleStyle: Style | undefined;
  readonly width: number | undefined;
  readonly padding: [number, number, number, number];

  constructor(
    content: string | RichText | Renderable,
    options?: PanelOptions,
  ) {
    this.renderable = toRenderable(content);
    this.box = options?.box ?? ROUNDED;
    this.title = options?.title;
    this.subtitle = options?.subtitle;
    this.bottomRightAccessory = options?.bottomRightAccessory;
    this.expand = options?.expand !== false;
    this.style = resolveStyle(options?.style);
    this.borderStyle = resolveStyle(options?.borderStyle);
    this.titleStyle = options?.titleStyle === undefined ? undefined : resolveStyle(options.titleStyle);
    this.subtitleStyle = options?.subtitleStyle === undefined ? undefined : resolveStyle(options.subtitleStyle);
    this.width = options?.width;
    this.padding = normalizePadding(options?.padding ?? [0, 1, 0, 1]);
  }

  *render(rawOptions: RenderOptions): Iterable<Segment> {
    const options = withBoundedWidth(rawOptions, this);
    const box = options.asciiOnly ? this.box.substitute({ asciiOnly: true }) : this.box;
    const border = this.borderStyle.isNull ? undefined : this.borderStyle;
    const contentStyle = this.style.isNull ? undefined : this.style;

    const geometry = layoutPanel(this._getPanelWidth(options), this.padding);
    const [padTop, , padBottom] = this.padding;

    const contentLines = this._renderContent(options, geometry.contentWidth);

    // Top border (with optional title)
    yield* this._renderTopBorder(box, geometry, border);

    // Top padding — a padding row is a content row whose content is nothing.
    for (let i = 0; i < padTop; i++) {
      yield* this._renderRow(box, geometry, [], border, contentStyle);
    }

    for (const line of contentLines) {
      yield* this._renderRow(box, geometry, line, border, contentStyle);
    }

    for (let i = 0; i < padBottom; i++) {
      yield* this._renderRow(box, geometry, [], border, contentStyle);
    }

    // Bottom border (with optional subtitle)
    yield* this._renderBottomBorder(box, geometry, border);
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
  ): Segment[][] {
    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: contentWidth,
    };
    const lines = Segment.splitLines([...this.renderable.render(innerOptions)]);
    return contentWidth === 0 ? [] : lines;
  }

  /**
   * One row of the panel body: frame column, span, frame column.
   *
   * [LAW:single-enforcer] `adjustLineLength` is the one place a width is
   * decided here, and it runs twice against two different widths. The first
   * pass crops content that rendered wider than the canvas it was handed (a
   * `Table` at its natural width, say) back to the canvas, so an oversized
   * child is trimmed rather than allowed to eat the right-hand padding. The
   * second fills the rest of the span, which is the trailing padding and any
   * shortfall in one stroke.
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
    const content = Segment.adjustLineLength(line, geometry.contentWidth, contentStyle, false);
    const span = [new Segment(" ".repeat(geometry.padLeft), contentStyle), ...content];
    yield* Segment.adjustLineLength(span, geometry.spanWidth, contentStyle);
    yield new Segment(frame.right.repeat(geometry.right), border);
    yield Segment.line();
  }

  measure(rawOptions: RenderOptions): { minimum: number; maximum: number } {
    const options = withCellWidth(rawOptions);

    const declared = this._declaredWidth;
    if (declared !== undefined) {
      // A declared width is not a ceiling on the content, it is the answer:
      // `_getPanelWidth` returns it before measuring anything, so the panel
      // draws at this width whatever the content wants. Reported with a
      // content-derived floor instead, `{width: 20}` around "hi" offered 100
      // cells answered 6..20 and then drew 20 every time, and a parent
      // dividing space from the floor under-provisioned it.
      const width = Math.min(options.maxWidth, declared);
      return { minimum: width, maximum: width };
    }

    return this._fitRange(options);
  }

  /**
   * The width this panel wants when nothing declared one for it: its content
   * plus its own frame, both read off the division it will render against.
   *
   * [LAW:one-source-of-truth] `measure` and `_getPanelWidth` ask this same
   * question, and each used to work it out itself — the same `layoutPanel`, the
   * same `frameOverhead`, the same `Math.min(maxWidth, maximum + overhead)`,
   * written twice. That is the pattern `_declaredWidth` below was extracted to
   * stop, left standing for the fit case; changing how overhead is derived in
   * one copy is all it would take to put `measure` and `render` back into the
   * disagreement this epic spent itself closing.
   */
  private _fitRange(options: RenderOptions): { minimum: number; maximum: number } {
    const geometry = layoutPanel(options.maxWidth, this.padding);
    const overhead = frameOverhead(geometry);

    if (isMeasurable(this.renderable)) {
      const innerOptions: RenderOptions = {
        ...options,
        maxWidth: geometry.contentWidth,
      };
      const measurement = Measurement.get(innerOptions, this.renderable);
      const maximum = Math.min(options.maxWidth, measurement.maximum + overhead);
      return {
        minimum: Math.min(measurement.minimum + overhead, maximum),
        maximum,
      };
    }

    // Content that cannot measure itself leaves the panel with nothing to want,
    // so it wants the offer — unbounded included, which `withBoundedWidth`
    // reports rather than turning into a number nobody can defend.
    return { minimum: Math.min(overhead, options.maxWidth), maximum: options.maxWidth };
  }

  /**
   * The width this panel was told to be, as a count of cells.
   *
   * [LAW:one-source-of-truth] `measure` and `_getPanelWidth` answer the same
   * question about the same field, so they read it from here. Answered
   * separately, `measure` reported nine cells of content while `render` drew the
   * declared twelve, and the parent that divided space from the range got a
   * panel three cells wider than the share it granted.
   */
  private get _declaredWidth(): number | undefined {
    return this.width === undefined ? undefined : cellCount(this.width);
  }

  private _getPanelWidth(options: RenderOptions): number {
    const declared = this._declaredWidth;
    if (declared !== undefined) return Math.min(declared, options.maxWidth);
    if (this.expand) return options.maxWidth;
    return this._fitRange(options).maximum;
  }

  private *_renderTopBorder(
    box: Box,
    geometry: PanelGeometry,
    border: Style | undefined,
  ): Iterable<Segment> {
    const innerBorderWidth = geometry.spanWidth;

    if (!this.title) {
      yield new Segment(box.top.left.repeat(geometry.left), border);
      yield new Segment(box.top.horizontal.repeat(innerBorderWidth), border);
      yield new Segment(box.top.right.repeat(geometry.right), border);
      yield Segment.line();
      return;
    }

    const titleText = typeof this.title === "string" ? this.title : this.title.plain;
    const titleDisplay = ` ${titleText} `;
    const titleWidth = cellLen(titleDisplay);
    // Title gets its own style when set, else inherits the border style —
    // single source of truth for "what color is the title text in".
    const titleSeg = this.titleStyle ?? border;

    yield new Segment(box.top.left.repeat(geometry.left), border);

    if (titleWidth >= innerBorderWidth) {
      // Title fills the border. [LAW:one-source-of-truth] cellLen / setCellSize
      // are the cell-width authority — plain .slice would miscount wide chars
      // and break border alignment.
      yield new Segment(setCellSize(titleDisplay, asCellCol(innerBorderWidth)), titleSeg);
    } else {
      // Center the title in the top border
      const leftRuleWidth = Math.floor((innerBorderWidth - titleWidth) / 2);
      const rightRuleWidth = innerBorderWidth - titleWidth - leftRuleWidth;

      if (leftRuleWidth > 0) yield new Segment(box.top.horizontal.repeat(leftRuleWidth), border);
      yield new Segment(titleDisplay, titleSeg);
      if (rightRuleWidth > 0) yield new Segment(box.top.horizontal.repeat(rightRuleWidth), border);
    }

    yield new Segment(box.top.right.repeat(geometry.right), border);
    yield Segment.line();
  }

  private *_renderBottomBorder(
    box: Box,
    geometry: PanelGeometry,
    border: Style | undefined,
  ): Iterable<Segment> {
    const innerBorderWidth = geometry.spanWidth;

    // Resolve the right accessory *now*. Function form evaluates after
    // content has been rendered (Panel.render collects content segments
    // before yielding any borders), so the thunk sees fresh widget state.
    const accessory = this._resolveAccessory(this.bottomRightAccessory);
    const accessoryDisplay = accessory === undefined
      ? ""
      : typeof accessory === "string"
        ? ` ${accessory} `
        : ` ${accessory.plain} `;
    const accessoryWidth = cellLen(accessoryDisplay);
    const accessoryStyle =
      accessory instanceof RichText && !accessory.style.isNull
        ? accessory.style
        : border;

    yield new Segment(box.bottom.left.repeat(geometry.left), border);

    // Space available for the centered subtitle / rule fill — the accessory
    // (if any) hugs the right edge and the subtitle treats the remainder
    // as its centering canvas.
    const centerWidth = Math.max(0, innerBorderWidth - accessoryWidth);

    if (!this.subtitle) {
      if (centerWidth > 0) yield new Segment(box.bottom.horizontal.repeat(centerWidth), border);
    } else {
      const subtitleText =
        typeof this.subtitle === "string" ? this.subtitle : this.subtitle.plain;
      const subtitleDisplay = ` ${subtitleText} `;
      const subtitleWidth = cellLen(subtitleDisplay);
      const subtitleSeg = this.subtitleStyle ?? border;

      if (subtitleWidth >= centerWidth) {
        // Cell-aware clip — see _renderTopBorder.
        yield new Segment(setCellSize(subtitleDisplay, asCellCol(centerWidth)), subtitleSeg);
      } else {
        const leftRuleWidth = Math.floor((centerWidth - subtitleWidth) / 2);
        const rightRuleWidth = centerWidth - subtitleWidth - leftRuleWidth;
        if (leftRuleWidth > 0) yield new Segment(box.bottom.horizontal.repeat(leftRuleWidth), border);
        yield new Segment(subtitleDisplay, subtitleSeg);
        if (rightRuleWidth > 0) yield new Segment(box.bottom.horizontal.repeat(rightRuleWidth), border);
      }
    }

    if (accessoryWidth > 0) {
      // Cell-aware clip — see _renderTopBorder.
      const fit = accessoryWidth > innerBorderWidth
        ? setCellSize(accessoryDisplay, asCellCol(innerBorderWidth))
        : accessoryDisplay;
      yield new Segment(fit, accessoryStyle);
    }

    yield new Segment(box.bottom.right.repeat(geometry.right), border);
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
