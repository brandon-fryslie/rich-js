/**
 * Panel — a bordered box that wraps content, with optional title and subtitle.
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Box, ROUNDED } from "../core/box.js";
import { Measurement } from "../core/measure.js";
import { RichText } from "../core/text.js";
import type { PaddingDimensions } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import { isMeasurable } from "../core/protocol.js";

/**
 * A lazily-resolved border accessory. Strings render inline in the
 * border style; `RichText` carries its own styling. A function form is
 * evaluated at render time, *after* content has been rendered for the
 * current frame — use this when the accessory mirrors state that the
 * wrapped renderable populates during its own `render()` (e.g. a
 * widget's post-render scroll position).
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
  width?: number;
  padding?: PaddingDimensions;
}

function normalizePadding(
  padding: PaddingDimensions | undefined,
): [number, number, number, number] {
  if (padding === undefined) return [0, 1, 0, 1];
  if (typeof padding === "number") return [padding, padding, padding, padding];
  if (padding.length === 2) return [padding[0], padding[1], padding[0], padding[1]];
  return padding;
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
    this.width = options?.width;
    this.padding = normalizePadding(options?.padding);
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const box = options.asciiOnly ? this.box.substitute({ asciiOnly: true }) : this.box;
    const border = this.borderStyle.isNull ? undefined : this.borderStyle;
    const contentStyle = this.style.isNull ? undefined : this.style;

    // Determine panel width
    const panelWidth = this._getPanelWidth(options);
    const [padTop, padRight, padBottom, padLeft] = this.padding;
    const innerWidth = Math.max(1, panelWidth - 2 - padLeft - padRight); // 2 for border chars

    // Render content
    const innerOptions: RenderOptions = {
      ...options,
      maxWidth: innerWidth,
    };
    const contentSegments = [...this.renderable.render(innerOptions)];
    const contentLines = Segment.splitLines(contentSegments);

    // Top border (with optional title)
    yield* this._renderTopBorder(box, panelWidth, border);

    // Top padding
    for (let i = 0; i < padTop; i++) {
      yield* this._renderBlankLine(box, panelWidth, padLeft, padRight, innerWidth, border, contentStyle);
    }

    // Content lines
    for (const line of contentLines) {
      yield new Segment(box.left, border);
      if (padLeft > 0) yield new Segment(" ".repeat(padLeft), contentStyle);

      yield* line;

      // Pad to fill inner width
      const lineWidth = Segment.getLineLength(line);
      const rightPad = innerWidth - lineWidth + padRight;
      if (rightPad > 0) yield new Segment(" ".repeat(rightPad), contentStyle);

      yield new Segment(box.right, border);
      yield Segment.line();
    }

    // Bottom padding
    for (let i = 0; i < padBottom; i++) {
      yield* this._renderBlankLine(box, panelWidth, padLeft, padRight, innerWidth, border, contentStyle);
    }

    // Bottom border (with optional subtitle)
    yield* this._renderBottomBorder(box, panelWidth, border);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const [_padTop, padRight, _padBottom, padLeft] = this.padding;
    const borderWidth = 2; // left + right border chars
    const horizontalPad = padLeft + padRight;

    if (isMeasurable(this.renderable)) {
      const innerOptions: RenderOptions = {
        ...options,
        maxWidth: Math.max(1, options.maxWidth - borderWidth - horizontalPad),
      };
      const measurement = Measurement.get(innerOptions, this.renderable);
      return {
        minimum: Math.max(
          borderWidth + horizontalPad,
          measurement.minimum + borderWidth + horizontalPad,
        ),
        maximum: Math.min(
          options.maxWidth,
          measurement.maximum + borderWidth + horizontalPad,
        ),
      };
    }
    return { minimum: borderWidth + horizontalPad, maximum: options.maxWidth };
  }

  private _getPanelWidth(options: RenderOptions): number {
    if (this.width !== undefined) return Math.min(this.width, options.maxWidth);
    if (this.expand) return options.maxWidth;

    // Fit mode: measure content
    const [_padTop, padRight, _padBottom, padLeft] = this.padding;
    const borderWidth = 2;
    const horizontalPad = padLeft + padRight;

    if (isMeasurable(this.renderable)) {
      const innerOptions: RenderOptions = {
        ...options,
        maxWidth: Math.max(1, options.maxWidth - borderWidth - horizontalPad),
      };
      const measurement = Measurement.get(innerOptions, this.renderable);
      return Math.min(
        options.maxWidth,
        measurement.maximum + borderWidth + horizontalPad,
      );
    }

    return options.maxWidth;
  }

  private *_renderTopBorder(
    box: Box,
    panelWidth: number,
    border: Style | undefined,
  ): Iterable<Segment> {
    const innerBorderWidth = panelWidth - 2; // minus left/right corner

    if (!this.title) {
      yield new Segment(box.topLeft, border);
      yield new Segment(box.top.repeat(innerBorderWidth), border);
      yield new Segment(box.topRight, border);
      yield Segment.line();
      return;
    }

    const titleText = typeof this.title === "string" ? this.title : this.title.plain;
    const titleDisplay = ` ${titleText} `;
    const titleWidth = cellLen(titleDisplay);

    yield new Segment(box.topLeft, border);

    if (titleWidth >= innerBorderWidth) {
      // Title fills the border
      yield new Segment(titleDisplay.slice(0, innerBorderWidth), border);
    } else {
      // Center the title in the top border
      const leftRuleWidth = Math.floor((innerBorderWidth - titleWidth) / 2);
      const rightRuleWidth = innerBorderWidth - titleWidth - leftRuleWidth;

      if (leftRuleWidth > 0) yield new Segment(box.top.repeat(leftRuleWidth), border);
      yield new Segment(titleDisplay, border);
      if (rightRuleWidth > 0) yield new Segment(box.top.repeat(rightRuleWidth), border);
    }

    yield new Segment(box.topRight, border);
    yield Segment.line();
  }

  private *_renderBottomBorder(
    box: Box,
    panelWidth: number,
    border: Style | undefined,
  ): Iterable<Segment> {
    const innerBorderWidth = panelWidth - 2;

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

    yield new Segment(box.bottomLeft, border);

    // Space available for the centered subtitle / rule fill — the accessory
    // (if any) hugs the right edge and the subtitle treats the remainder
    // as its centering canvas.
    const centerWidth = Math.max(0, innerBorderWidth - accessoryWidth);

    if (!this.subtitle) {
      if (centerWidth > 0) yield new Segment(box.bottom.repeat(centerWidth), border);
    } else {
      const subtitleText =
        typeof this.subtitle === "string" ? this.subtitle : this.subtitle.plain;
      const subtitleDisplay = ` ${subtitleText} `;
      const subtitleWidth = cellLen(subtitleDisplay);

      if (subtitleWidth >= centerWidth) {
        yield new Segment(subtitleDisplay.slice(0, centerWidth), border);
      } else {
        const leftRuleWidth = Math.floor((centerWidth - subtitleWidth) / 2);
        const rightRuleWidth = centerWidth - subtitleWidth - leftRuleWidth;
        if (leftRuleWidth > 0) yield new Segment(box.bottom.repeat(leftRuleWidth), border);
        yield new Segment(subtitleDisplay, border);
        if (rightRuleWidth > 0) yield new Segment(box.bottom.repeat(rightRuleWidth), border);
      }
    }

    if (accessoryWidth > 0) {
      const fit = accessoryWidth > innerBorderWidth
        ? accessoryDisplay.slice(0, innerBorderWidth)
        : accessoryDisplay;
      yield new Segment(fit, accessoryStyle);
    }

    yield new Segment(box.bottomRight, border);
    yield Segment.line();
  }

  private _resolveAccessory(
    a: BorderAccessory | undefined,
  ): string | RichText | undefined {
    if (a === undefined) return undefined;
    if (typeof a === "function") return a();
    return a;
  }

  private *_renderBlankLine(
    box: Box,
    _panelWidth: number,
    padLeft: number,
    padRight: number,
    innerWidth: number,
    border: Style | undefined,
    contentStyle: Style | undefined,
  ): Iterable<Segment> {
    yield new Segment(box.left, border);
    yield new Segment(" ".repeat(padLeft + innerWidth + padRight), contentStyle);
    yield new Segment(box.right, border);
    yield Segment.line();
  }

  // --- Static factory ---

  static fit(
    content: string | RichText | Renderable,
    options?: Omit<PanelOptions, "expand">,
  ): Panel {
    return new Panel(content, { ...options, expand: false });
  }
}
