import { describe, it, expect } from "vitest";
import { ColorDepth, type ColorSpec, ColorTable, contrastRatio, TerminalColors, TerminalTheme } from "../../src/core/color.js";
import { ink, type InkPlace } from "../../src/widgets/ink.js";
import { Button } from "../../src/widgets/button.js";
import { getThemePalette } from "../../src/themes/registry.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { slide, TEXT_FITS, textFloor } from "../../src/themes/text-on.js";

const { GRUVBOX } = terminalThemes;
const TRUECOLOR: InkPlace = { fit: slide, depth: ColorDepth.TRUECOLOR };
const BUNDLED = Object.values(terminalThemes).filter((value) => value instanceof TerminalTheme);

describe("ink", () => {
  it("refuses a fully transparent key: a widget drawn on it would sit on whatever the terminal shows", () => {
    // A TerminalTheme may carry a registry palette, whose link-background is #00000000.
    const theme = new TerminalTheme(GRUVBOX.backgroundColor, GRUVBOX.foregroundColor, GRUVBOX.ansiColors, getThemePalette("gruvbox"));
    expect(ink(theme, "foreground", "background", TRUECOLOR).bgcolor.getTruecolor().hex).toBe("#282828");
    expect(() => ink(theme, "foreground", "link-background", TRUECOLOR)).toThrow(/link-background.*fully transparent/);
  });

  it("draws the theme's stated color under asIs, where the fit would have moved it", () => {
    // Solarized's text on its raised ground misses body text's floor, so `slide` moves it.
    const { SOLARIZED_DARK } = terminalThemes;
    const stated = SOLARIZED_DARK.palette.get("foreground").hex;
    expect(ink(SOLARIZED_DARK, "foreground", "panel", { fit: TEXT_FITS.asIs, depth: ColorDepth.TRUECOLOR }).color.getTruecolor().hex).toBe(stated);
    expect(ink(SOLARIZED_DARK, "foreground", "panel", TRUECOLOR).color.getTruecolor().hex).not.toBe(stated);
  });

  it("is a widget's to turn off: contrast asIs draws the stated color, and setContrast turns it back on", () => {
    const { SOLARIZED_DARK } = terminalThemes;
    const label = (button: Button) => [...button.render({ maxWidth: 20 })].find((s) => s.text.includes("Save"))!.style!.color!.getTruecolor().hex;
    const stated = ink(SOLARIZED_DARK, "foreground", "surface", { fit: TEXT_FITS.asIs, depth: ColorDepth.TRUECOLOR }).color.getTruecolor().hex;
    const button = new Button({ label: "Save", theme: SOLARIZED_DARK, contrast: TEXT_FITS.asIs });
    expect(label(button)).toBe(stated);
    button.setContrast(slide);
    expect(label(button)).not.toBe(stated);
  });

  it("derives a grey slot apart from the text for a terminal that states no muted slot", () => {
    // Tokyo Night's white is its text exactly, so a slot rounded by name alone would look typed.
    const { TOKYO_NIGHT } = terminalThemes;
    const unstated = new TerminalTheme(TOKYO_NIGHT.backgroundColor, TOKYO_NIGHT.foregroundColor, TOKYO_NIGHT.ansiColors, TOKYO_NIGHT.palette);
    const at: InkPlace = { fit: slide, depth: ColorDepth.STANDARD, terminal: unstated };
    const muted = ink(unstated, "foreground-muted", "background", at).color;
    expect([undefined, 0, 7, 8, 15]).toContain(muted.number);
    expect(muted.getTruecolor(unstated).hex).not.toBe(ink(unstated, "foreground", "background", at).color.getTruecolor(unstated).hex);
  });

  it("reads the muted slot off the terminal that shows the frame, not the widget's theme", () => {
    const { CATPPUCCIN_MOCHA, SOLARIZED_DARK } = terminalThemes;
    const muted = ink(CATPPUCCIN_MOCHA, "foreground-muted", "background", { fit: TEXT_FITS.asIs, depth: ColorDepth.STANDARD, terminal: SOLARIZED_DARK }).color;
    expect(muted.number).toBe(SOLARIZED_DARK.mutedSlot);
  });

  it("paints a light theme's own ground at sixteen colors, never the terminal's default", () => {
    const { CATPPUCCIN_LATTE } = terminalThemes;
    const { bgcolor } = ink(CATPPUCCIN_LATTE, "foreground", "background", { fit: slide, depth: ColorDepth.STANDARD, terminal: CATPPUCCIN_LATTE });
    expect(bgcolor.isDefault).toBe(false);
  });

  describe("a terminal is refused", () => {
    const sixteen = GRUVBOX.ansiColors;
    it.each([-1, 16, 2.5, Number.NaN])("with a muted slot of %s, which names none of its sixteen", (slot) => {
      expect(() => new TerminalColors(GRUVBOX.backgroundColor, GRUVBOX.foregroundColor, sixteen, slot)).toThrow(new RegExp(`mutedSlot.*0–15; got ${slot}`));
    });
    it("whose sixteen are all its foreground, leaving no color for muted text", () => {
      const white = GRUVBOX.foregroundColor;
      const flat = new ColorTable(Array.from({ length: 16 }, () => white));
      expect(() => new TerminalColors(GRUVBOX.backgroundColor, white, flat)).toThrow(/all its foreground/);
    });
  });

  describe.each(BUNDLED.map((theme) => [theme.palette.name, theme] as const))("on %s", (_name, theme) => {
    it.each([
      ["sixteen colors", ColorDepth.STANDARD, "background"],
      ["sixteen colors", ColorDepth.STANDARD, "surface"],
      ["256 colors", ColorDepth.EIGHT_BIT, "background"],
      ["256 colors", ColorDepth.EIGHT_BIT, "surface"],
    ] as const)("at %s writes muted text on %s in a color apart from its text, at the muted floor", (_depth, depth, ground) => {
      const at: InkPlace = { fit: slide, depth, terminal: theme };
      const muted = ink(theme, "foreground-muted", ground, at);
      const body = ink(theme, "foreground", ground, at);
      const shown = (spec: ColorSpec, fg: boolean) => spec.getTruecolor(theme, fg);
      expect(shown(muted.color, true).hex).not.toBe(shown(body.color, true).hex);
      expect(contrastRatio(shown(muted.color, true), shown(muted.bgcolor, false))).toBeGreaterThanOrEqual(textFloor("foreground-muted"));
    });
  });
});
