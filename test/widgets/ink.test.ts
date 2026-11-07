import { describe, it, expect } from "vitest";
import { ColorDepth, ColorRgba, type ColorSpec, ColorTable, contrastRatio, TerminalColors, TerminalTheme } from "../../src/core/color.js";
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

  it("derives a slot that recedes from the text for a terminal that states no muted slot", () => {
    // Tokyo Night's white is its text exactly, so a slot rounded by name alone would look typed.
    const { TOKYO_NIGHT } = terminalThemes;
    const unstated = new TerminalTheme(TOKYO_NIGHT.backgroundColor, TOKYO_NIGHT.foregroundColor, TOKYO_NIGHT.ansiColors, TOKYO_NIGHT.palette);
    const at: InkPlace = { fit: slide, depth: ColorDepth.STANDARD, terminal: unstated };
    const { color, bgcolor } = ink(unstated, "foreground-muted", "background", at);
    const body = ink(unstated, "foreground", "background", at).color;
    const on = (spec: ColorSpec) => contrastRatio(spec.getTruecolor(unstated), bgcolor.getTruecolor(unstated, false));
    expect(color.isDefault).toBe(false);
    expect(on(color)).toBeLessThan(on(body));
    expect(on(color)).toBeGreaterThanOrEqual(textFloor("foreground-muted"));
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
  });

  it("draws muted text as its body text dimmed where the table has no color for it to recede in", () => {
    // A monochrome terminal: black and white, nothing between.
    const mono = new ColorTable(Array.from({ length: 16 }, (_, n) => (n === 0 ? new ColorRgba(0, 0, 0) : new ColorRgba(255, 255, 255))));
    const terminal = new TerminalColors(new ColorRgba(0, 0, 0), new ColorRgba(255, 255, 255), mono);
    const at: InkPlace = { fit: slide, depth: ColorDepth.STANDARD, terminal };
    const muted = ink(GRUVBOX, "foreground-muted", "background", at);
    expect(muted.dim).toBe(true);
    expect(muted.color.getTruecolor(terminal).hex).toBe(ink(GRUVBOX, "foreground", "background", at).color.getTruecolor(terminal).hex);
  });

  describe.each(BUNDLED.map((theme) => [theme.palette.name, theme] as const))("on %s", (_name, theme) => {
    it.each([
      ["sixteen colors", ColorDepth.STANDARD, "background"],
      ["sixteen colors", ColorDepth.STANDARD, "surface"],
      ["256 colors", ColorDepth.EIGHT_BIT, "background"],
      ["256 colors", ColorDepth.EIGHT_BIT, "surface"],
    ] as const)("at %s writes muted text on %s receding from its text, at the muted floor, or its text dimmed", (_depth, depth, ground) => {
      for (const terminal of [undefined, theme]) {
        const at: InkPlace = { fit: slide, depth, terminal };
        const muted = ink(theme, "foreground-muted", ground, at);
        const body = ink(theme, "foreground", ground, at);
        const shown = (spec: ColorSpec, fg: boolean) => spec.getTruecolor(terminal, fg);
        const on = (spec: ColorSpec) => contrastRatio(shown(spec, true), shown(muted.bgcolor, false));
        if (muted.dim) {
          expect(muted.color).toBe(body.color);
          continue;
        }
        expect(muted.color.isDefault).toBe(false);
        expect(shown(muted.color, true).hex).not.toBe(shown(body.color, true).hex);
        expect(on(muted.color)).toBeLessThan(on(body.color));
        expect(on(muted.color)).toBeGreaterThanOrEqual(textFloor("foreground-muted"));
      }
    });
  });
});
