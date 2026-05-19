/**
 * rich-themes — visual fixture for the theming foundation.
 *
 * Walks all bundled Textual theme palettes and prints, for each:
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
  ColorRgba,
  Console,
  Palette,
  PaletteResolver,
  RichText,
  Style,
  getThemePalette,
  listThemePalettes,
} from "../../src/index.js";

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

function bgFgStyle(bg: ColorRgba, fg: ColorRgba, substrate: ColorRgba): Style {
  // Terminals don't render alpha; both colors must be opaque before Style
  // emits them. compositeOver short-circuits when alpha=1 (the common case)
  // and RGB-blends otherwise — same call every time, data decides.
  // [LAW:dataflow-not-control-flow]
  const flatBg = bg.compositeOver(substrate);
  const flatFg = fg.compositeOver(flatBg);
  return Style.parse(`${flatFg.hex} on ${flatBg.hex}`);
}

function header(palette: Palette): RichText {
  const bg = palette.get("background");
  const fg = palette.get("foreground");
  if (!bg || !fg) throw new Error(`${palette.name}: missing background/foreground`);
  const tag = palette.dark ? "dark " : "light";
  // [LAW:types-are-the-program] use append(text, style) so the style is
  // carried as a span — constructor-style only applies to a *standalone*
  // RichText and is dropped when this is appended into another.
  return new RichText("").append(
    `  ${palette.name.padEnd(20)} [${tag}]  `,
    bgFgStyle(bg, fg, bg),
  );
}

function swatchRow(palette: Palette): RichText {
  const out = new RichText("");
  const bg = palette.get("background");
  const fg = palette.get("foreground");
  if (!bg || !fg) return out;
  for (const name of SWATCH_VARS) {
    const c = palette.get(name);
    if (!c) {
      out.append(` ${name}=∅ `, "dim");
      continue;
    }
    out.append(` ${name} ${c.hex} `, bgFgStyle(c, fg, bg));
  }
  return out;
}

function resolverRow(palette: Palette): RichText {
  const resolver = new PaletteResolver(palette);
  const out = new RichText("");
  const bg = palette.get("background");
  const fg = palette.get("foreground");
  if (!bg || !fg) return out;
  for (const spec of RESOLVER_SPECS) {
    const resolved = resolver.resolve(spec, { against: bg });
    if (!resolved) {
      out.append(` ${spec}=∅ `, "dim");
      continue;
    }
    out.append(` "${spec}" `, bgFgStyle(resolved, fg, bg));
  }
  return out;
}

function main(): void {
  const names = listThemePalettes();
  consoleOut.print(
    new RichText("rich-themes — Textual theme palettes", { style: "bold" }),
  );
  consoleOut.print(
    new RichText(
      `${names.length} themes registered. Each row: header / swatches / resolver specs.`,
      { style: "dim" },
    ),
  );
  consoleOut.print(new RichText(""));

  for (const name of names) {
    const palette = getThemePalette(name);
    if (!palette) {
      consoleOut.print(new RichText(`${name}: failed to load`, { style: "bold red" }));
      continue;
    }
    consoleOut.print(header(palette));
    consoleOut.print(swatchRow(palette));
    consoleOut.print(resolverRow(palette));
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
