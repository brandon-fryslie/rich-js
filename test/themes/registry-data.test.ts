import { describe, it, expect, vi } from "vitest";
import { ANSI_SLOTS, type ThemePaletteData } from "../../src/themes/data/types.js";

// Authored theme data that is wrong in each way hydration must refuse, served
// in place of the bundled themes so the registry's error paths can be reached.
const theme = (name: string, ansi: Partial<Record<(typeof ANSI_SLOTS)[number], string>>, vars: Record<string, string>): ThemePaletteData => ({
  name,
  dark: true,
  ansi: { ...Object.fromEntries(ANSI_SLOTS.map((slot) => [slot, "#000000"])), ...ansi } as ThemePaletteData["ansi"],
  vars: {
    background: "#000000", foreground: "#ffffff", primary: "#ff0000", secondary: "#00ff00",
    accent: "#0000ff", success: "#00ff00", warning: "#ffff00", error: "#ff0000", ...vars,
  },
});

vi.mock("../../src/themes/data/index.js", () => ({
  THEMES: {
    "opaque-alpha": theme("opaque-alpha", { red: "#cc241dff" }, {}),
    "translucent-slot": theme("translucent-slot", { red: "#cc241d80" }, {}),
    "malformed-slot": theme("malformed-slot", { red: "#cc241" }, {}),
    "malformed-var": theme("malformed-var", {}, { muted: "#zzzzzz" }),
  },
}));

const { getThemeBaseColors, getThemePalette } = await import("../../src/themes/registry.js");
type Name = Parameters<typeof getThemeBaseColors>[0];

describe("theme data hydration refuses what a theme cannot hold", () => {
  it("takes a fully opaque #RRGGBBFF ANSI slot as the opaque colour it is", () => {
    expect(getThemeBaseColors("opaque-alpha" as Name).ansi.get(1).hex).toBe("#cc241d");
  });

  it("refuses a translucent ANSI slot, naming the theme and the slot", () => {
    expect(() => getThemeBaseColors("translucent-slot" as Name)).toThrow(
      'Theme translucent-slot: ansi.red has alpha in "#cc241d80" (expected #RRGGBB)',
    );
  });

  it("refuses a malformed ANSI slot with the hex grammar's own message", () => {
    expect(() => getThemeBaseColors("malformed-slot" as Name)).toThrow(
      'Theme malformed-slot: ansi.red: Invalid hex colour "#cc241" (expected #RRGGBB or #RRGGBBAA)',
    );
  });

  it("refuses a malformed palette var, naming the var", () => {
    expect(() => getThemePalette("malformed-var")).toThrow(
      'Theme malformed-var: var muted: Invalid hex colour "#zzzzzz" (expected #RRGGBB or #RRGGBBAA)',
    );
  });
});
