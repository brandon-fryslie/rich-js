import { describe, it, expect } from "vitest";
import { TerminalTheme } from "../../src/core/color.js";
import { ink } from "../../src/widgets/ink.js";
import { getThemePalette } from "../../src/themes/registry.js";
import { GRUVBOX } from "../../src/themes/terminalThemes.js";

describe("ink", () => {
  it("refuses a fully transparent key: a widget drawn on it would sit on whatever the terminal shows", () => {
    // A TerminalTheme may carry a registry palette, whose link-background is #00000000.
    const theme = new TerminalTheme(GRUVBOX.backgroundColor, GRUVBOX.foregroundColor, GRUVBOX.ansiColors, getThemePalette("gruvbox"));
    expect(ink(theme, "foreground", "background").bgcolor.getTruecolor().hex).toBe("#282828");
    expect(() => ink(theme, "foreground", "link-background")).toThrow(/link-background.*fully transparent/);
  });
});
