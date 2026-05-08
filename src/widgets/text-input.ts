/**
 * TextInput widget — single-line editable text field with cursor.
 * [LAW:dataflow-not-control-flow] cursor is a data position; when focused,
 * exactly one cell is rendered with reverse-video styling on every frame.
 * [LAW:one-type-per-behavior] shared infrastructure inherited from WidgetBase.
 *
 * Visual states:
 *   normal      — "[value______]" with brackets bracketing fixed-width content
 *   focused     — same width with cursor cell (reverse video) at cursorPosition
 *   placeholder — focused + empty value: dimmed placeholder text shown,
 *                 cursor at position 0
 *   password    — every value char rendered as "•"
 *   disabled    — entire segment dimmed
 */

import { observable, action } from "mobx";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../core/color.js";
import type { RenderOptions } from "../core/protocol.js";
import type { TerminalTheme } from "../core/color.js";
import { WidgetBase } from "./widget-base.js";
import type { KeyEvent, WidgetMouseEvent } from "./types.js";

export interface TextInputOptions {
  value?: string;
  placeholder?: string;
  id?: string;
  disabled?: boolean;
  theme?: TerminalTheme;
  maxLength?: number;
  password?: boolean;
}

const MIN_CONTENT_WIDTH = 8;

export class TextInput extends WidgetBase {
  readonly id: string;
  readonly focusable = true;

  @observable accessor value: string;
  @observable accessor cursorPosition: number;
  @observable.ref accessor placeholder: string;

  // [LAW:dataflow-not-control-flow] theme is observable.ref so render() reads
  // it as a reactive dependency; setTheme triggers the screen's autorun.
  @observable.ref private accessor _theme: TerminalTheme;
  private readonly _maxLength: number | undefined;
  private readonly _password: boolean;

  constructor(options: TextInputOptions = {}) {
    super();
    this.id = options.id ?? `text-input-${Math.random().toString(36).slice(2, 8)}`;
    this.value = options.value ?? "";
    this.placeholder = options.placeholder ?? "";
    this.cursorPosition = this.value.length;
    this.disabled = options.disabled ?? false;
    this._theme = options.theme ?? DEFAULT_TERMINAL_THEME;
    this._maxLength = options.maxLength;
    this._password = options.password ?? false;
  }

  @action
  setTheme(theme: TerminalTheme): void { this._theme = theme; }

  // --- Event handlers ---

  @action
  handleKey(event: KeyEvent): void {
    if (this.disabled) return;

    switch (event.key) {
      case "left":
        this.cursorPosition = Math.max(0, this.cursorPosition - 1);
        return;
      case "right":
        this.cursorPosition = Math.min(this.value.length, this.cursorPosition + 1);
        return;
      case "home":
        this.cursorPosition = 0;
        return;
      case "end":
        this.cursorPosition = this.value.length;
        return;
      case "backspace":
        if (this.cursorPosition > 0) {
          this.value = this.value.slice(0, this.cursorPosition - 1) + this.value.slice(this.cursorPosition);
          this.cursorPosition -= 1;
          this.emitChange();
        }
        return;
      case "delete":
        if (this.cursorPosition < this.value.length) {
          this.value = this.value.slice(0, this.cursorPosition) + this.value.slice(this.cursorPosition + 1);
          this.emitChange();
        }
        return;
      case "enter":
        this.emitSubmit();
        return;
    }

    // Printable insertion: single-character event.character with no modifier.
    if (
      event.character.length === 1 &&
      !event.ctrl &&
      !event.meta &&
      event.character >= " " &&
      event.character !== "\x7f"
    ) {
      if (this._maxLength !== undefined && this.value.length >= this._maxLength) return;
      this.value =
        this.value.slice(0, this.cursorPosition) +
        event.character +
        this.value.slice(this.cursorPosition);
      this.cursorPosition += 1;
      this.emitChange();
    }
  }

  @action
  override handleMouse(event: WidgetMouseEvent): void {
    if (this.disabled) return;
    if (event.type !== "mouse_down") return;

    const b = this.bounds;
    if (!b) return;
    // Click position relative to the content area (skip the leading "[" bracket).
    const relX = event.x - b.x - 1;
    this.cursorPosition = Math.max(0, Math.min(this.value.length, relX));
  }

  // --- Rendering ---

  render(options: RenderOptions): Iterable<Segment> {
    const showPlaceholder = this.focused && this.value.length === 0 && this.placeholder.length > 0;

    const rawDisplay = showPlaceholder
      ? this.placeholder
      : this._password
        ? "•".repeat(this.value.length)
        : this.value;

    // [LAW:dataflow-not-control-flow] content width is data — derived from
    // value/placeholder length, MIN_CONTENT_WIDTH floor, maxWidth ceiling.
    const maxAvailable = Math.max(MIN_CONTENT_WIDTH, options.maxWidth - 2);
    const desiredWidth = Math.max(MIN_CONTENT_WIDTH, rawDisplay.length, this.cursorPosition + 1);
    const contentWidth = Math.min(maxAvailable, desiredWidth);

    // Slide window to keep cursor visible when content overflows.
    const startIdx = Math.max(0, Math.min(rawDisplay.length - contentWidth, this.cursorPosition - contentWidth + 1));
    const sliced = rawDisplay.slice(Math.max(0, startIdx), Math.max(0, startIdx) + contentWidth);
    const display = sliced.padEnd(contentWidth, " ");
    const cursorDisplayIdx = this.cursorPosition - Math.max(0, startIdx);

    const bracketStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : new Style({ color: this.resolvePalette("foreground") });

    const contentStyle = this.disabled
      ? new Style({ color: "#666666", bgcolor: "#333333", dim: true })
      : showPlaceholder
        ? new Style({ color: this.resolvePalette("foreground"), dim: true })
        : new Style({ color: this.resolvePalette("foreground") });

    // Cursor cell paints on a full primary bg → use on-primary for fg so
    // contrast is WCAG-correct across all themes, not theme-bg-dependent.
    const cursorStyle = new Style({
      color: this.resolvePalette("on-primary"),
      bgcolor: this.resolvePalette("primary"),
    });

    const segments: Segment[] = [new Segment("[", bracketStyle)];

    if (this.focused && !this.disabled && cursorDisplayIdx >= 0 && cursorDisplayIdx < contentWidth) {
      const before = display.slice(0, cursorDisplayIdx);
      const at = display.slice(cursorDisplayIdx, cursorDisplayIdx + 1);
      const after = display.slice(cursorDisplayIdx + 1);
      if (before.length > 0) segments.push(new Segment(before, contentStyle));
      segments.push(new Segment(at.length > 0 ? at : " ", cursorStyle));
      if (after.length > 0) segments.push(new Segment(after, contentStyle));
    } else {
      segments.push(new Segment(display, contentStyle));
    }

    segments.push(new Segment("]", bracketStyle));
    return segments;
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const minimum = MIN_CONTENT_WIDTH + 2;
    const maximum = Math.max(minimum, Math.max(this.value.length, this.placeholder.length) + 2);
    return { minimum, maximum };
  }

  // --- Palette resolution ---

  private resolvePalette(key: string): ColorSpec {
    const rgba = this._theme.palette.get(key);
    // [LAW:no-defensive-null-guards] palette must contain all keys.
    return ColorSpec.fromRgba(rgba!);
  }
}
