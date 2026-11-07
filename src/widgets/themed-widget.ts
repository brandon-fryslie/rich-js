/**
 * ThemedWidget — a widget that draws every cell it owns from one theme's
 * palette: the interactive widgets, as against `StaticItem`, which shows
 * content it did not draw.
 *
 * [LAW:one-type-per-behavior] The theme, how its text is held to contrast, how
 * either is swapped, what a disabled or muted widget looks like, and the ground
 * a padded row stands on are the same for every such widget, so they live here
 * once.
 */

import { action } from "mobx";
import { observableRef } from "./observable.js";
import { Style } from "../core/style.js";
import { ColorDepth, type TerminalTheme } from "../core/color.js";
import { DEFAULT_TERMINAL_THEME } from "../themes/terminalThemes.js";
import { slide, type TextFit, type TextIntent } from "../themes/text-on.js";
import type { PaletteRole } from "../themes/palette.js";
import { WidgetBase, type Depth } from "./widget-base.js";
import { ink, type Inked } from "./ink.js";

/** What every themed widget's options carry: the theme it is drawn in, and how its text meets a contrast floor. */
export interface ThemedWidgetOptions {
  theme?: TerminalTheme;
  /**
   * What text that misses its contrast floor becomes: `slide` unless stated.
   * `TEXT_FITS.asIs` turns contrast checking off, drawing the theme's colors as stated.
   */
  contrast?: TextFit;
}

export abstract class ThemedWidget extends WidgetBase {
  // [LAW:types-are-the-program] @observableRef so setTheme() and setContrast()
  // trigger a re-render: every draw reads its colors through these references.
  @observableRef protected accessor theme: TerminalTheme;
  @observableRef protected accessor contrast: TextFit;

  constructor(options: ThemedWidgetOptions) {
    super();
    this.theme = options.theme ?? DEFAULT_TERMINAL_THEME;
    this.contrast = options.contrast ?? slide;
  }

  @action
  setTheme(theme: TerminalTheme): void {
    this.theme = theme;
  }

  @action
  setContrast(fit: TextFit): void {
    this.contrast = fit;
  }

  // [LAW:single-enforcer] The one road from a widget to `ink`: the theme and
  // the fit are the widget's, the depth the frame's.
  protected ink(at: Depth, text: TextIntent, ground: PaletteRole): Inked {
    return ink(this.theme, text, ground, { fit: this.contrast, depth: at.colorSystem ?? ColorDepth.TRUECOLOR });
  }

  protected override ground(at: Depth): Style {
    return new Style(this.ink(at, "foreground", "background"));
  }

  // [LAW:one-source-of-truth] How every widget looks while disabled: the
  // palette's disabled text on its ground. WCAG sets no contrast floor for an
  // inactive control, and this sits under the one for text on purpose.
  protected disabledInk(at: Depth): Inked {
    return this.ink(at, "foreground-disabled", "background");
  }

  // [LAW:one-source-of-truth] How every widget draws what recedes — a
  // placeholder, a continuation marker, a slider's empty track — on the ground
  // it stands on.
  protected mutedInk(at: Depth, ground: "background" | "surface"): Inked {
    return this.ink(at, "foreground-muted", ground);
  }
}
