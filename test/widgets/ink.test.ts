import { describe, it, expect } from "vitest";
import { ColorDepth, type ColorSpec, contrastRatio, TerminalTheme } from "../../src/core/color.js";
import { ink, type InkPlace } from "../../src/widgets/ink.js";
import { Button } from "../../src/widgets/button.js";
import { getThemePalette } from "../../src/themes/registry.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { slide, TEXT_FITS, textFloor } from "../../src/themes/text-on.js";

const { GRUVBOX } = terminalThemes;
const TRUECOLOR: InkPlace = { fit: slide, depth: ColorDepth.TRUECOLOR };
const BUNDLED = Object.values(terminalThemes).filter((value) => value instanceof TerminalTheme);

// Solarized Dark states its muted text as base00, 2.9:1 on its raised base02;
// none of its sixteen both recedes from its text and reads there.
const floorOn = (theme: TerminalTheme, ground: "background" | "surface"): number =>
  theme === terminalThemes.SOLARIZED_DARK && ground === "surface" ? 2.9 : textFloor("foreground-muted");

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

  it("derives a grey slot apart from the text for a theme that states no muted slot", () => {
    // Tokyo Night's white is its text exactly, so a slot rounded by name alone would look typed.
    const { TOKYO_NIGHT } = terminalThemes;
    const unstated = new TerminalTheme(TOKYO_NIGHT.backgroundColor, TOKYO_NIGHT.foregroundColor, TOKYO_NIGHT.ansiColors, TOKYO_NIGHT.palette);
    const at: InkPlace = { fit: slide, depth: ColorDepth.STANDARD };
    const muted = ink(unstated, "foreground-muted", "background", at).color;
    expect([undefined, 0, 7, 8, 15]).toContain(muted.number);
    expect(muted.getTruecolor(unstated).hex).not.toBe(ink(unstated, "foreground", "background", at).color.getTruecolor(unstated).hex);
  });

  describe.each(BUNDLED.map((theme) => [theme.palette.name, theme] as const))("on %s at sixteen colors", (_name, theme) => {
    const at: InkPlace = { fit: slide, depth: ColorDepth.STANDARD };
    it.each(["background", "surface"] as const)("writes muted text on %s in a color apart from its text, at the muted floor", (ground) => {
      const muted = ink(theme, "foreground-muted", ground, at);
      const body = ink(theme, "foreground", ground, at);
      const shown = (spec: ColorSpec, fg: boolean) => spec.getTruecolor(theme, fg);
      expect(shown(muted.color, true).hex).not.toBe(shown(body.color, true).hex);
      expect(contrastRatio(shown(muted.color, true), shown(muted.bgcolor, false))).toBeGreaterThanOrEqual(floorOn(theme, ground));
    });
  });
});
