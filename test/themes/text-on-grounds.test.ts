/**
 * The grounds Textual promises a theme's fixed text reads on: `background`,
 * `surface` and `panel`, and for `text-*` its own `*-muted` too. Every bundled
 * theme holds `text-*` there at WCAG AA (4.5:1) and `foreground-muted` at
 * AA-large (3:1), and past the disabled text drawn there — both the authored palette and what `buildPalette` derives
 * from that palette's eight base colors.
 *
 * `foreground` is authored and Textual does not move it, so it is not held
 * here; on any ground, `textOn` is what draws it legibly.
 */
import { describe, it, expect } from "vitest";
import { ColorDepth, ColorSpec, contrastRatio, dimShown, resolveTerminal, TerminalTheme } from "../../src/core/color.js";
import { PALETTE_ROLES } from "../../src/themes/buildPalette.js";
import type { Palette } from "../../src/themes/palette.js";
import { getThemePalette, listThemePalettes } from "../../src/themes/registry.js";
import * as terminalThemes from "../../src/themes/terminalThemes.js";
import { asIs, textOn, writeText, type WrittenText } from "../../src/themes/text-on.js";
import { derivedFrom } from "./derived-palette.js";

const BUNDLED = Object.values(terminalThemes).filter((value) => value instanceof TerminalTheme);

const ACCENTS = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
const GROUNDS = ["background", "surface", "panel"] as const;

const palettes: ReadonlyArray<readonly [string, Palette]> = listThemePalettes().flatMap((name) => [
  [`${name} (registry)`, getThemePalette(name)] as const,
  [`${name} (buildPalette)`, derivedFrom(getThemePalette(name))] as const,
]);

describe("text-* on the grounds Textual promises it", () => {
  const cases = palettes.flatMap(([source, palette]) =>
    ACCENTS.flatMap((accent) => [...GROUNDS, `${accent}-muted` as const].map((ground) => ({ source, palette, accent, ground }))),
  );
  it.each(cases)("text-$accent reads on $ground in $source", ({ palette, accent, ground }) => {
    expect(contrastRatio(palette.get(`text-${accent}`), palette.get(ground))).toBeGreaterThanOrEqual(4.5);
  });
});

describe("foreground-muted on the three grounds", () => {
  const cases = palettes.flatMap(([source, palette]) => GROUNDS.map((ground) => ({ source, palette, ground })));
  it.each(cases)("foreground-muted recedes no further than 3:1 on $ground in $source", ({ palette, ground }) => {
    expect(contrastRatio(palette.get("foreground-muted"), palette.get(ground))).toBeGreaterThanOrEqual(3);
  });
  // Muted is secondary text and disabled is text that cannot be used, so muted
  // reads the stronger, by the margin `buildPalette` holds it to.
  it.each(cases)("foreground-muted reads 0.25 past the disabled text drawn on $ground in $source", ({ palette, ground }) => {
    const on = (intent: "foreground-muted" | "foreground-disabled"): number => contrastRatio(textOn(palette, intent, palette.get(ground)), palette.get(ground));
    expect(on("foreground-muted")).toBeGreaterThanOrEqual(on("foreground-disabled") + 0.25);
  });
});

// `textOn` draws muted and disabled text on any ground — a button, a cursor, a
// ladder rung — so the ordering holds on every color a palette names, not the three alone.
describe("foreground-muted past foreground-disabled on every ground", () => {
  const cases = palettes.map(([source, palette]) => ({ source, palette }));
  it.each(cases)("in $source", ({ palette }) => {
    const misses = PALETTE_ROLES.flatMap((role) => {
      const ground = palette.get(role).compositeOver(palette.get("background"));
      const on = (intent: "foreground-muted" | "foreground-disabled"): number => contrastRatio(textOn(palette, intent, ground), ground);
      return on("foreground-muted") >= on("foreground-disabled") + 0.25 - 1e-9 ? [] : [`${role}: ${on("foreground-muted").toFixed(3)} vs ${on("foreground-disabled").toFixed(3)}`];
    });
    expect(misses).toEqual([]);
  });
});

// A depth that writes colors by index draws a table's slots, and there the
// ordering is held between what each shows — a dimmed slot as an export draws
// it — on the VGA defaults the depth assumes, and on the theme's own terminal.
describe.each([["256 colors", ColorDepth.EIGHT_BIT], ["sixteen colors", ColorDepth.STANDARD]] as const)("foreground-muted past foreground-disabled at %s", (_depth, depth) => {
  const cases = BUNDLED.flatMap((theme) => [
    { source: `${theme.palette.name}, no terminal named`, palette: theme.palette, terminal: undefined },
    { source: `${theme.palette.name} on its own terminal`, palette: theme.palette, terminal: theme },
  ]);
  it.each(cases)("in $source", ({ palette, terminal }) => {
    const shown = resolveTerminal(terminal, depth);
    const on = ({ color, bgcolor, dim }: WrittenText): number => {
      const ground = bgcolor.getTruecolor(shown, false);
      const ink = color.getTruecolor(shown, true);
      return contrastRatio(dim ? dimShown(ink, ground) : ink, ground);
    };
    const misses = PALETTE_ROLES.flatMap((role) => {
      const ground = palette.get(role).compositeOver(palette.get("background"));
      const muted = writeText(palette, "foreground-muted", ground, { drawnAt: { depth, terminal } });
      const disabled = writeText(palette, "foreground-disabled", ground, { drawnAt: { depth, terminal } });
      return on(muted) >= on(disabled) + 0.25 - 1e-9 && on(disabled) > 1 ? [] : [`${role}: muted ${on(muted).toFixed(3)} vs disabled ${on(disabled).toFixed(3)}`];
    });
    expect(misses).toEqual([]);
  });
});

// The ordering is a floor, and asIs keeps every floor off: at an indexed depth
// disabled text is then the slot its stated color rounds to, as it is kept as
// stated at truecolor.
it("asIs leaves foreground-disabled on the slot its stated color rounds to", () => {
  const palette = getThemePalette("dracula");
  const ground = palette.get("background");
  const depth = ColorDepth.EIGHT_BIT;
  const shown = resolveTerminal(undefined, depth);
  const stated = textOn(palette, "foreground-disabled", ground, { fit: asIs });
  const written = writeText(palette, "foreground-disabled", ground, { fit: asIs, drawnAt: { depth } });
  expect(written.color.getTruecolor(shown, true).hex).toBe(ColorSpec.fromRgba(stated).downgrade(depth).getTruecolor(shown, true).hex);
});
