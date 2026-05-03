/**
 * rich-themes — visual fixture for the theming foundation.
 *
 * Walks all 18 bundled Textual theme palettes and prints, for each:
 *   1. A header row in the theme's `background` + `foreground`.
 *   2. A swatch strip of semantic vars (primary / accent / error / warning /
 *      success / secondary) with their hex values.
 *   3. A PaletteResolver demo row exercising the four spec forms:
 *      bare, modifier (`-darken-2`), alpha (`50%`), auto-contrast (`auto 80%`).
 *
 * Non-interactive — `npm run themes`. Catches data-fidelity regressions
 * (missing vars, alpha clobbering) by simply running and rendering.
 */

import {
  Console,
  PaletteResolver,
  RichText,
  Style,
  getThemePalette,
  listThemePalettes,
} from "../../src/index.js";
import type { ColorQuad, Palette } from "../../src/index.js";
// alphaBlend is internal to the themes module; the demo reaches in to flatten
// translucent ColorQuads against the theme bg before passing them to the
// ANSI-only Style (terminals don't render alpha).
import { alphaBlend } from "../../src/themes/colorMath.js";

const consoleOut = new Console({ forceTerminal: true });

const SWATCH_VARS = [
  "primary",
  "accent",
  "error",
  "warning",
  "success",
  "secondary",
] as const;

const RESOLVER_SPECS = [
  "primary",
  "primary-darken-2",
  "accent 50%",
  "auto 80%",
] as const;

function quadToBgFg(bg: ColorQuad, fg: ColorQuad): Style {
  // Alpha-bearing colors must be flattened against an opaque surface before
  // ANSI emits them — terminals don't render alpha. We composite onto the
  // theme bg (which is itself fully opaque by Textual convention).
  // [LAW:dataflow-not-control-flow] always blend; if alpha=1 the blend is a
  // no-op, so the same operation runs every time and the data decides.
  const flatBg = alphaBlend(bg, bg, bg.alpha);
  const flatFg = alphaBlend(fg, bg, fg.alpha);
  return Style.parse(`${flatFg.rgb.hex} on ${flatBg.rgb.hex}`);
}

function swatch(label: string, fg: ColorQuad, bg: ColorQuad): RichText {
  const style = quadToBgFg(bg, fg);
  return new RichText(label, { style });
}

function header(palette: Palette): RichText {
  const bg = palette.get("background");
  const fg = palette.get("foreground");
  if (!bg || !fg) throw new Error(`${palette.name}: missing background/foreground`);
  const tag = palette.dark ? "dark " : "light";
  return swatch(`  ${palette.name.padEnd(20)} [${tag}]  `, fg, bg);
}

function swatchRow(palette: Palette): RichText[] {
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;
  const out: RichText[] = [];
  for (const name of SWATCH_VARS) {
    const c = palette.get(name);
    if (!c) {
      out.push(new RichText(` ${name}=∅ `, { style: "dim" }));
      continue;
    }
    out.push(swatch(` ${name} ${c.rgb.hex} `, fg, c));
  }
  return out;
}

function resolverRow(palette: Palette): RichText[] {
  const resolver = new PaletteResolver(palette);
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;
  const out: RichText[] = [];
  for (const spec of RESOLVER_SPECS) {
    const resolved = resolver.resolve(spec, { against: bg });
    if (!resolved) {
      out.push(new RichText(` ${spec}=∅ `, { style: "dim" }));
      continue;
    }
    out.push(swatch(` "${spec}" `, fg, resolved));
  }
  return out;
}

function joinRow(parts: RichText[]): RichText {
  // Concatenate by reducing into a single RichText. Each swatch carries its
  // own style, so the gap text just inherits the previous one — we use
  // separate empty RichTexts to break runs.
  const out = new RichText("");
  for (const p of parts) {
    out.append(p);
  }
  return out;
}

function main(): void {
  consoleOut.print(
    new RichText("rich-themes — 18 Textual theme palettes", { style: "bold" }),
  );
  consoleOut.print(
    new RichText(
      `${listThemePalettes().length} themes registered. Each row: header / swatches / resolver specs.`,
      { style: "dim" },
    ),
  );
  consoleOut.print(new RichText(""));

  for (const name of listThemePalettes()) {
    const palette = getThemePalette(name);
    if (!palette) {
      consoleOut.print(new RichText(`${name}: failed to load`, { style: "bold red" }));
      continue;
    }
    consoleOut.print(header(palette));
    consoleOut.print(joinRow(swatchRow(palette)));
    consoleOut.print(joinRow(resolverRow(palette)));
    consoleOut.print(new RichText(""));
  }

  // Sanity check: a name not in the registry returns null (fixture for the
  // null path — easy to miss when only happy paths get visualized).
  const missing = getThemePalette("not-a-real-theme");
  consoleOut.print(
    new RichText(
      `getThemePalette("not-a-real-theme") → ${missing === null ? "null ✓" : "UNEXPECTED"}`,
      { style: missing === null ? "green" : "bold red" },
    ),
  );
}

try {
  main();
} catch (err) {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
}
