/**
 * ThemedWidget — a widget that draws every cell it owns from one theme's
 * palette: the interactive widgets, as against `StaticItem`, which shows
 * content it did not draw.
 *
 * [LAW:one-type-per-behavior] The theme, how it is swapped, what a disabled
 * widget looks like, and the ground a padded row stands on are the same for
 * every such widget, so they live here once.
 */

import { observableRef, action } from "mobx";
import { Style } from "../core/style.js";
import type { TerminalTheme } from "../core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import { WidgetBase } from "./widget-base.js";
import { ink } from "./ink.js";

export abstract class ThemedWidget extends WidgetBase {
  // [LAW:types-are-the-program] @observableRef so setTheme() triggers a
  // re-render: every draw reads its colours through this reference.
  @observableRef protected accessor theme: TerminalTheme;

  constructor(theme: TerminalTheme | undefined) {
    super();
    this.theme = theme ?? DEFAULT_TERMINAL_THEME;
  }

  @action
  setTheme(theme: TerminalTheme): void {
    this.theme = theme;
  }

  protected override get ground(): Style {
    return new Style(ink(this.theme, "foreground", "background"));
  }

  // [LAW:one-source-of-truth] How every widget looks while disabled: the
  // palette's de-emphasized text on its ground. WCAG sets no contrast floor for
  // an inactive control, and this sits under the one for text on purpose.
  protected get disabledInk(): ReturnType<typeof ink> {
    return ink(this.theme, "foreground-muted", "background");
  }
}
