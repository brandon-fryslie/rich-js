/**
 * ink — the colour pair a widget cell is drawn in: a foreground and the ground
 * it stands on, both from one theme's palette.
 *
 * A palette's colours are chosen against that palette's own background. A
 * foreground drawn over whatever the terminal shows is readable only when the
 * terminal happens to match the theme — the default theme's white text
 * vanished into a light terminal. With both halves taken from the palette, a
 * widget looks the same on every terminal, so it is readable on all of them
 * exactly when its theme is readable against itself.
 *
 * [LAW:types-are-the-program] There is no call that takes a foreground alone,
 * so a widget cannot draw half a pair.
 * [LAW:single-enforcer] Every widget resolves palette keys here, and this is
 * where a key the palette lacks is reported.
 */

import { ColorSpec, type TerminalTheme } from "../core/color.js";

export function ink(
  theme: TerminalTheme,
  fg: string,
  bg: string,
): { color: ColorSpec; bgcolor: ColorSpec } {
  return { color: paletteColor(theme, fg), bgcolor: paletteColor(theme, bg) };
}

function paletteColor(theme: TerminalTheme, key: string): ColorSpec {
  const rgba = theme.palette.get(key);
  if (rgba === undefined) {
    throw new RangeError(`palette ${JSON.stringify(theme.palette.name)} has no ${JSON.stringify(key)}`);
  }
  return ColorSpec.fromRgba(rgba);
}
