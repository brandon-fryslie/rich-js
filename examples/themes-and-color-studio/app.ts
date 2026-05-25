/**
 * themes-and-color-studio — the flagship Themes & Color demo.
 *
 * One non-interactive tour through every public surface of the color /
 * palette / theme / contrast subsystem. Eight sections, each a deterministic
 * pipeline of `print(renderable)` calls; section order is data (`SECTIONS`
 * below), not control flow. The same render path drives terminal output and
 * the optional HTML export — only the boundary varies.
 *   [LAW:dataflow-not-control-flow]
 *
 * This demo replaces four earlier demos that grew separately and overlapped
 * (rich-themes, rich-themes-transposed, rich-theme-designer, rich-colors).
 * The consolidated ownership map is `spec/demos.md` — every export this
 * file references is one that map assigns to this flagship.
 *   [LAW:one-source-of-truth]
 *
 * Run:    npm run themes-and-color-studio
 * Export: EXPORT_HTML=out.html npm run themes-and-color-studio
 */

// ---- Owned exports from the main barrel -----------------------------------
import {
  // Section 1 — ColorRgba values and pixel math
  ColorRgba,
  ColorParseError,
  parseRgbHex,
  parseRgbaHex,
  blendRgb,
  // Section 2 — ColorSpec, downgrade tables, named colors
  ColorSpec,
  ColorTable,
  ColorDepth,
  STANDARD_TABLE,
  EIGHT_BIT_TABLE,
  WINDOWS_TABLE,
  ANSI_COLOR_NAMES,
  // Section 3 — color-system detection
  detectColorSystem,
  resolveColorSystem,
  // Section 4 — theme registry (also via subpath, see below)
  getThemePalette,
  listThemePalettes,
  // Section 5 — Palettes, resolver, build
  Palette,
  PaletteResolver,
  buildPalette,
  // Section 6 — Pre-built TerminalTheme constants
  TerminalTheme,
  DEFAULT_TERMINAL_THEME,
  SVG_EXPORT_THEME,
  MONOKAI,
  NORD,
  GRUVBOX,
  DRACULA,
  TOKYO_NIGHT,
  FLEXOKI,
  CYBERPUNK,
  CATPPUCCIN_MOCHA,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_FRAPPE,
  CATPPUCCIN_MACCHIATO,
  SOLARIZED_DARK,
  SOLARIZED_LIGHT,
  ROSE_PINE,
  ROSE_PINE_MOON,
  ROSE_PINE_DAWN,
  ATOM_ONE_DARK,
  ATOM_ONE_LIGHT,
  TEXTUAL_DARK,
  TEXTUAL_LIGHT,
  TEXTUAL_ANSI,
  // Section 7 — OKLCH + transposition
  Oklch,
  IDENTITY,
  INVERT_LIGHTNESS,
  isIdentityKey,
  transposePalette,
  themeKeyForRoot,
  isAnchored,
  ANCHORED_ROOTS,
  // Section 8 — WCAG contrast toolkit
  relativeLuminance,
  contrastRatio,
  contrastFor,
  ensureContrast,
  // Infrastructure (owned by other flagships; we only consume)
  Console,
  RichText,
  Style,
  hostStream,
  type TerminalHost,
} from "../../src/index.js";

import type {
  DetectColorOptions,
  ThemeName,
  ResolveContext,
  BaseColors,
  ThemeKey,
} from "../../src/index.js";

// ---- Subpath-only exports (themes/data, themes/registry) ------------------
import { THEMES } from "../../src/themes/data/index.js";
import type { ThemePaletteData } from "../../src/themes/data/index.js";
import {
  getThemeBaseColors,
  type ThemeBaseColors,
} from "../../src/themes/registry.js";

// ---------------------------------------------------------------------------
// Demo entry — runDemo(host) wires the same section tour against any
// TerminalHost. Recording is opt-in via the `record` option (node bootstrap
// sets it from EXPORT_HTML; the browser bootstrap doesn't pass it).
// [LAW:dataflow-not-control-flow] Same render pipeline runs either way;
// recording only diverts the byte stream into a buffer for `saveHtml`.
// ---------------------------------------------------------------------------

export interface DemoHandle {
  stop(): void;
  readonly out: Console;
}

export function runDemo(
  host: TerminalHost,
  options?: { record?: boolean },
): DemoHandle {
  const out = new Console({
    forceTerminal: true,
    file: hostStream(host),
    record: options?.record ?? false,
    width: 120,
  });

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/**
 * Build a `Style` that paints `fg` text on `bg`, flattening alpha against
 * `substrate` first and routing the foreground through `ensureContrast` so
 * an inverted/darkened palette can't render dark-on-dark.
 *
 * [LAW:single-enforcer] The only place the demo flattens alpha + enforces
 * the readability floor; every styled cell goes through here. `ensureContrast`
 * keeps the foreground's hue and just slides its OKLCH lightness until the
 * 4.5:1 ratio is met, so themed text still looks themed.
 *
 * [LAW:dataflow-not-control-flow] `ColorRgba.compositeOver` is a no-op when
 * alpha=1 (the typical case for opaque palette colors), so the same call
 * site is correct for both translucent and opaque inputs.
 */
function bgFgStyle(bg: ColorRgba, fg: ColorRgba, substrate: ColorRgba): Style {
  const flatBg = bg.compositeOver(substrate);
  const flatFg = ensureContrast(fg.compositeOver(flatBg), flatBg, 4.5);
  return Style.parse(`${flatFg.hex} on ${flatBg.hex}`);
}

function sectionHeader(num: number, title: string): RichText {
  return new RichText(`${num}. ${title}`, { style: "bold underline" });
}

function blurb(text: string): RichText {
  return new RichText(`    ${text}`, { style: "dim" });
}

function blank(): RichText {
  return new RichText("");
}

function bold(text: string): RichText {
  return new RichText(text, { style: "bold" });
}

function dim(text: string): RichText {
  return new RichText(text, { style: "dim" });
}

// The semantic vars we sample across the demo. Ordered roughly by role:
// brand → highlight → state. Sized to fit on one line of the configured
// console width.
const SEMANTIC_VARS = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "error",
] as const;

// ===========================================================================
// SECTION 1 — Color values, parsing, blending, alpha compositing
// ===========================================================================

function section1ColorValues(): void {
  out.print(sectionHeader(1, "Color values — ColorRgba, parsing, alpha"));
  out.print(
    blurb(
      "ColorRgba is the pixel-level value type. Two parsers (no-alpha and " +
        "with-alpha), one blender, alpha compositing as a no-op fast path.",
    ),
  );
  out.print(blank());

  // parseRgbHex accepts 6-char hex (no leading #).
  const sky = parseRgbHex("3b82f6");
  // parseRgbaHex accepts 8-char hex; the trailing two are the alpha channel.
  const skyHalf = parseRgbaHex("3b82f680");
  // Direct construction — the canonical path when channels are already known.
  const ink = new ColorRgba(15, 23, 42);
  const paper = new ColorRgba(248, 250, 252);

  out.print(new RichText("    parseRgbHex(\"3b82f6\")     → ").append(`  ${sky.hex}  `, bgFgStyle(sky, paper, paper)));
  out.print(new RichText("    parseRgbaHex(\"3b82f680\")  → ").append(`  ${skyHalf.hex}  `, bgFgStyle(skyHalf, paper, paper)).append(dim(`   alpha=${skyHalf.alpha}`)));
  out.print(new RichText("    new ColorRgba(15, 23, 42)  → ").append(`  ${ink.hex}  `, bgFgStyle(ink, paper, ink)));
  out.print(blank());

  // blendRgb interpolates two ColorRgba values; ratio 0 → first, 1 → second.
  out.print(dim("    blendRgb(sky, ink, t) — steps across the gradient:"));
  const gradient = new RichText("    ");
  for (const t of [0, 0.25, 0.5, 0.75, 1]) {
    const blended = blendRgb(sky, ink, t);
    gradient.append(`  t=${t.toFixed(2)}  `, bgFgStyle(blended, paper, paper));
  }
  out.print(gradient);
  out.print(blank());

  // compositeOver: flatten a translucent color onto a substrate. Alpha=1
  // (sky) short-circuits to the same instance; alpha<1 (skyHalf) interpolates.
  // This is the law-cited fast path on which `bgFgStyle` above relies.
  const flatOverPaper = skyHalf.compositeOver(paper);
  const flatOverInk = skyHalf.compositeOver(ink);
  out.print(dim("    skyHalf.compositeOver(paper) vs (ink) — same alpha, different substrate:"));
  out.print(
    new RichText("      ")
      .append(`  on paper → ${flatOverPaper.hex}  `, bgFgStyle(flatOverPaper, paper, paper))
      .append("   ")
      .append(`  on ink   → ${flatOverInk.hex}  `, bgFgStyle(flatOverInk, ink, paper)),
  );
  out.print(blank());

  // ColorParseError is raised by ColorSpec.parse on unknown specs. The pixel
  // parsers above are intentionally permissive (they trust their callers);
  // see section 2 for the parse-time loud-failure boundary.
  //
  // The assertion runs the parse, catches the thrown value, and prints
  // exactly one diagnostic line for every possible outcome — thrown the
  // right type, thrown the wrong type, didn't throw at all. The "didn't
  // throw" branch matters: without it, a regression that made parse
  // silently return some default would emit nothing here and the demo
  // would pass for the wrong reason. [LAW:no-silent-fallbacks]
  type ParseOutcome =
    | { kind: "correct" }
    | { kind: "wrong-type"; got: string }
    | { kind: "no-throw" };

  let outcome: ParseOutcome;
  try {
    ColorSpec.parse("not-a-color");
    outcome = { kind: "no-throw" };
  } catch (err) {
    outcome =
      err instanceof ColorParseError
        ? { kind: "correct" }
        : { kind: "wrong-type", got: err instanceof Error ? err.name : typeof err };
  }
  const diag: { text: string; style: string } =
    outcome.kind === "correct"
      ? {
          text: '    ColorSpec.parse("not-a-color") → ColorParseError thrown ✓',
          style: "green",
        }
      : outcome.kind === "wrong-type"
      ? {
          text: `    ColorSpec.parse("not-a-color") raised the WRONG error type (${outcome.got})`,
          style: "bold red",
        }
      : {
          text: '    ColorSpec.parse("not-a-color") DID NOT THROW — parse-time loud-failure regressed',
          style: "bold red",
        };
  out.print(new RichText(diag.text, { style: diag.style }));
  out.print(blank());
}

// ===========================================================================
// SECTION 2 — ColorSpec, downgrade tables, named colors
// ===========================================================================

function section2ColorSpec(): void {
  out.print(sectionHeader(2, "ColorSpec — the styled-output color type"));
  out.print(
    blurb(
      "ColorSpec wraps a value at a given ColorDepth (TRUECOLOR / EIGHT_BIT / " +
        "STANDARD / DEFAULT / WINDOWS) and emits ANSI SGR codes. " +
        "`ColorSpec.downgrade` quantizes truecolor into STANDARD_TABLE and " +
        "EIGHT_BIT_TABLE; WINDOWS_TABLE is a public LUT for the Windows " +
        "console palette but is a detection target, not a downgrade target.",
    ),
  );
  out.print(blank());

  // Every ColorSpec factory exercised in one pass.
  const fromHex = ColorSpec.parse("#3b82f6");
  const fromNamed = ColorSpec.parse("magenta");
  const fromAnsi = ColorSpec.fromAnsi(202);
  const fromRgba = ColorSpec.fromRgba(new ColorRgba(120, 200, 80));
  const fromRgb = ColorSpec.fromRgb(220, 60, 90);
  const defaultColor = ColorSpec.default();

  out.print(dim("    Factory results (type — name):"));
  for (const [label, spec] of [
    ["ColorSpec.parse(\"#3b82f6\")", fromHex],
    ["ColorSpec.parse(\"magenta\")", fromNamed],
    ["ColorSpec.fromAnsi(202)     ", fromAnsi],
    ["ColorSpec.fromRgba(120,200,80)", fromRgba],
    ["ColorSpec.fromRgb(220,60,90) ", fromRgb],
    ["ColorSpec.default()         ", defaultColor],
  ] as const) {
    out.print(
      new RichText(`      ${label}  →  ${ColorDepth[spec.type]} / "${spec.name}"`),
    );
  }
  out.print(blank());

  // Downgrade walk — same TRUECOLOR input, rendered at TRUECOLOR plus the
  // two quantization targets `ColorSpec.downgrade` accepts (EIGHT_BIT via
  // EIGHT_BIT_TABLE.match, STANDARD via STANDARD_TABLE.match).
  const ribbon = ColorSpec.parse("#ff7e2a");
  const eightBit = ribbon.downgrade(ColorDepth.EIGHT_BIT);
  const standard = ribbon.downgrade(ColorDepth.STANDARD);
  out.print(dim("    Downgrade #ff7e2a across systems:"));
  out.print(
    new RichText("      truecolor   → ").append(
      "  #ff7e2a  ",
      Style.parse(`#000000 on ${ribbon.value!.hex}`),
    ),
  );
  out.print(
    new RichText(`      8-bit (256) → color(${eightBit.number}) ≈ `).append(
      "  ◼ ",
      Style.parse(`color(${eightBit.number}) on default`),
    ),
  );
  out.print(
    new RichText(`      standard 16 → color(${standard.number}) ≈ `).append(
      "  ◼ ",
      Style.parse(`color(${standard.number}) on default`),
    ),
  );
  out.print(blank());

  // ColorTable & WINDOWS_TABLE — both palettes are public; show their sizes.
  const standardCT: ColorTable = STANDARD_TABLE;
  out.print(
    dim(
      `    Tables: STANDARD_TABLE size=${standardCT.size}, ` +
        `EIGHT_BIT_TABLE size=${EIGHT_BIT_TABLE.size}, ` +
        `WINDOWS_TABLE size=${WINDOWS_TABLE.size}`,
    ),
  );
  // Show a strip of the first 16 colors from EIGHT_BIT_TABLE (which mirrors
  // STANDARD_TABLE for indices 0–15 but exposes the wider catalog).
  const strip = new RichText("    ");
  for (let i = 0; i < 16; i++) {
    const c = EIGHT_BIT_TABLE.get(i);
    strip.append("  ", Style.parse(`default on ${c.hex}`));
  }
  out.print(strip.append("   ").append(dim("(indices 0–15 of EIGHT_BIT_TABLE)")));
  out.print(blank());

  // ANSI_COLOR_NAMES — the canonical name → index map. Show a few entries
  // and the reverse derivation: parse the name, then read back its number.
  const samples = ["red", "bright_blue", "yellow", "bright_green"];
  out.print(dim("    ANSI_COLOR_NAMES lookups:"));
  for (const name of samples) {
    const index = ANSI_COLOR_NAMES[name];
    const spec = ColorSpec.parse(name);
    out.print(
      new RichText(`      ${name.padEnd(14)} → index ${index}, `).append(
        "  ◼  ",
        Style.parse(`${name} on default`),
      ).append(dim(` ColorSpec.parse name="${spec.name}"`)),
    );
  }
  out.print(blank());
}

// ===========================================================================
// SECTION 3 — Color-system detection (env-driven)
// ===========================================================================

function section3ColorSystem(): void {
  out.print(sectionHeader(3, "Color-system detection"));
  out.print(
    blurb(
      "detectColorSystem reads the environment (NO_COLOR, FORCE_COLOR, TERM, " +
        "COLORTERM, TERM_PROGRAM, isTTY); resolveColorSystem maps a string " +
        "spec into the same enum, with \"auto\" delegating to detection.",
    ),
  );
  out.print(blank());

  // Deterministic env fixtures — DetectColorOptions lets us bypass
  // process.env so the demo's output is reproducible regardless of where
  // it runs. Each case targets a specific detection branch (COLORTERM
  // promotion, TERM fall-through, NO_COLOR opt-out, no-TTY null result).
  // [LAW:single-enforcer] — same authority, different inputs.
  const cases: Array<{ label: string; opts: DetectColorOptions }> = [
    {
      label: "TTY + COLORTERM=truecolor",
      opts: { env: { TERM: "xterm-256color", COLORTERM: "truecolor" }, isTTY: true },
    },
    {
      label: "TTY + TERM=xterm-256color  ",
      opts: { env: { TERM: "xterm-256color" }, isTTY: true },
    },
    {
      label: "NO_COLOR=1                 ",
      opts: { env: { NO_COLOR: "1", TERM: "xterm-256color" }, isTTY: true },
    },
    {
      label: "no TTY                     ",
      opts: { env: { TERM: "xterm-256color" }, isTTY: false },
    },
  ];

  out.print(dim("    detectColorSystem(opts):"));
  for (const c of cases) {
    const depth = detectColorSystem(c.opts);
    const label = depth === null ? "null (color disabled)" : ColorDepth[depth];
    out.print(new RichText(`      ${c.label}  →  ${label}`));
  }
  out.print(blank());

  // resolveColorSystem: same enum from a spec string. "auto" falls through
  // to detection; everything else is a direct table lookup.
  out.print(dim("    resolveColorSystem(spec):"));
  for (const spec of ["truecolor", "256", "ansi", "none", "auto"]) {
    const depth = resolveColorSystem(spec, cases[1]!.opts);
    const label = depth === null ? "null" : ColorDepth[depth];
    out.print(new RichText(`      "${spec.padEnd(9)}"  →  ${label}`));
  }
  out.print(blank());
}

// ===========================================================================
// SECTION 4 — Theme registry (every bundled theme as a swatch row)
// ===========================================================================

function section4ThemeRegistry(): void {
  out.print(sectionHeader(4, "Theme registry — every bundled palette"));
  out.print(
    blurb(
      "listThemePalettes / getThemePalette / getThemeBaseColors walk the " +
        "bundled themes. THEMES (subpath ./themes/data) is the raw " +
        "ThemePaletteData; the registry hydrates it into a Palette of " +
        "ColorRgba on demand.",
    ),
  );
  out.print(blank());

  const names: readonly ThemeName[] = listThemePalettes();
  out.print(
    dim(
      `    ${names.length} themes registered. ` +
        `Raw THEMES data carries ${Object.keys(THEMES).length} entries.`,
    ),
  );
  out.print(blank());

  // For each theme: header in (bg, fg), then a 6-var swatch strip. The
  // header colors come from `getThemeBaseColors` (the cheap 8-color path
  // that doesn't hydrate the full ~150-var palette); the swatches come
  // from `getThemePalette` (which does).
  for (const name of names) {
    const base: ThemeBaseColors = getThemeBaseColors(name);
    const palette = getThemePalette(name);
    const tag = base.dark ? "dark " : "light";
    const header = new RichText("").append(
      `  ${base.name.padEnd(22)} [${tag}]  `,
      bgFgStyle(base.bg, base.fg, base.bg),
    );
    const row = new RichText("");
    for (const v of SEMANTIC_VARS) {
      const c = palette.get(v);
      if (c === undefined) {
        row.append(`  ${v} ∅`, "dim");
        continue;
      }
      row.append(` ${v.padEnd(9)} `, bgFgStyle(c, base.fg, base.bg));
    }
    out.print(header.append("  ").append(row));
  }
  out.print(blank());

  // Sanity: missing-theme path. Using the `string` overload of
  // getThemePalette returns null instead of throwing; the demo prints the
  // result so a regression that turned it into a throw would be obvious.
  const missing = getThemePalette("not-a-real-theme" as string);
  out.print(
    new RichText(
      `    getThemePalette("not-a-real-theme") → ${missing === null ? "null ✓" : "UNEXPECTED non-null"}`,
      { style: missing === null ? "green" : "bold red" },
    ),
  );
  // ThemePaletteData type-only reference — the subpath exports the raw
  // data shape too, mainly for downstream tools that want to introspect
  // a theme's vars without hydrating to ColorRgba.
  const sample: ThemePaletteData = THEMES["gruvbox"]!;
  out.print(
    dim(`    THEMES["gruvbox"] (ThemePaletteData) carries ${Object.keys(sample.vars).length} authored vars.`),
  );
  out.print(blank());
}

// ===========================================================================
// SECTION 5 — Palette, PaletteResolver, buildPalette
// ===========================================================================

function section5PaletteResolver(): void {
  out.print(sectionHeader(5, "Palette resolution — bare / modifier / alpha / auto"));
  out.print(
    blurb(
      "PaletteResolver parses Textual-style spec strings against a Palette. " +
        "Four spec forms — a bare name, a -darken-N/-lighten-N modifier, " +
        "a trailing alpha percent, and the synthetic \"auto\" name that " +
        "picks black-or-white against the target.",
    ),
  );
  out.print(blank());

  // Use gruvbox as the substrate. ResolveContext.against is required for
  // the alpha and auto forms; bare names and modifiers don't need it.
  const palette: Palette = getThemePalette("gruvbox");
  const resolver = new PaletteResolver(palette);
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;
  const ctx: ResolveContext = { against: bg };

  const specs: Array<{ spec: string; note: string }> = [
    { spec: "primary",                note: "bare palette var" },
    { spec: "primary-darken-2",       note: "modifier: 2 levels darker" },
    { spec: "primary-lighten-1",      note: "modifier: 1 level lighter" },
    { spec: "accent 50%",             note: "alpha: 50% over background" },
    { spec: "auto",                   note: "synthetic: contrastFor(against)" },
    { spec: "auto 80%",               note: "auto + alpha together" },
    { spec: "error-darken-3 30%",     note: "modifier + alpha" },
  ];

  for (const { spec, note } of specs) {
    const resolved = resolver.resolve(spec, ctx);
    if (resolved === null) {
      out.print(new RichText(`    "${spec.padEnd(22)}" → null (${note})`, { style: "bold red" }));
      continue;
    }
    out.print(
      new RichText(`    "${spec.padEnd(22)}" → `)
        .append(`  ${resolved.hex}  `, bgFgStyle(resolved, fg, bg))
        .append("  ")
        .append(dim(note)),
    );
  }
  out.print(blank());

  // buildPalette directly — construct a BaseColors bundle and watch the
  // derived vars appear. Useful for ports that ship their own palette
  // outside the registry. Shows the *-muted, text-*, on-* derivations.
  const base: BaseColors = {
    primary:   parseRgbHex("4f46e5"),
    secondary: parseRgbHex("0ea5e9"),
    accent:    parseRgbHex("eab308"),
    success:   parseRgbHex("16a34a"),
    warning:   parseRgbHex("d97706"),
    error:     parseRgbHex("dc2626"),
    background: parseRgbHex("0f172a"),
    foreground: parseRgbHex("e2e8f0"),
  };
  const built: Palette = buildPalette("indigo-night", true, base);
  out.print(
    bold("    buildPalette(\"indigo-night\", dark=true, base) — derived vars:"),
  );
  for (const role of ["primary", "primary-muted", "text-primary", "on-primary"]) {
    const c = built.get(role)!;
    out.print(
      new RichText(`      ${role.padEnd(18)} → `).append(
        `  ${c.hex}  `,
        bgFgStyle(c, built.get("foreground")!, built.get("background")!),
      ),
    );
  }
  out.print(blank());
}

// ===========================================================================
// SECTION 6 — Every pre-built TerminalTheme constant
// ===========================================================================

// [LAW:one-source-of-truth] One catalog of (label, TerminalTheme) tuples;
// every reference to a pre-built constant happens here. Adding a theme means
// adding one row — the section title's count derives from `catalog.length`,
// so the prose can't drift the way a hardcoded "N bundled themes" would.
const TERMINAL_THEME_CATALOG: ReadonlyArray<{ label: string; theme: TerminalTheme }> = [
  { label: "DEFAULT_TERMINAL_THEME", theme: DEFAULT_TERMINAL_THEME },
  { label: "SVG_EXPORT_THEME",       theme: SVG_EXPORT_THEME },
  { label: "MONOKAI",                theme: MONOKAI },
  { label: "NORD",                   theme: NORD },
  { label: "GRUVBOX",                theme: GRUVBOX },
  { label: "DRACULA",                theme: DRACULA },
  { label: "TOKYO_NIGHT",            theme: TOKYO_NIGHT },
  { label: "FLEXOKI",                theme: FLEXOKI },
  { label: "CYBERPUNK",              theme: CYBERPUNK },
  { label: "CATPPUCCIN_MOCHA",       theme: CATPPUCCIN_MOCHA },
  { label: "CATPPUCCIN_LATTE",       theme: CATPPUCCIN_LATTE },
  { label: "CATPPUCCIN_FRAPPE",      theme: CATPPUCCIN_FRAPPE },
  { label: "CATPPUCCIN_MACCHIATO",   theme: CATPPUCCIN_MACCHIATO },
  { label: "SOLARIZED_DARK",         theme: SOLARIZED_DARK },
  { label: "SOLARIZED_LIGHT",        theme: SOLARIZED_LIGHT },
  { label: "ROSE_PINE",              theme: ROSE_PINE },
  { label: "ROSE_PINE_MOON",         theme: ROSE_PINE_MOON },
  { label: "ROSE_PINE_DAWN",         theme: ROSE_PINE_DAWN },
  { label: "ATOM_ONE_DARK",          theme: ATOM_ONE_DARK },
  { label: "ATOM_ONE_LIGHT",         theme: ATOM_ONE_LIGHT },
  { label: "TEXTUAL_DARK",           theme: TEXTUAL_DARK },
  { label: "TEXTUAL_LIGHT",          theme: TEXTUAL_LIGHT },
  { label: "TEXTUAL_ANSI",           theme: TEXTUAL_ANSI },
];

function section6TerminalThemes(): void {
  out.print(
    sectionHeader(
      6,
      `TerminalTheme constants — ${TERMINAL_THEME_CATALOG.length} bundled themes`,
    ),
  );
  out.print(
    blurb(
      "Each bundled theme exposes a `TerminalTheme` constant alongside its " +
        "registry entry. TerminalTheme = (backgroundColor, foregroundColor, " +
        "ansiColors: ColorTable, palette: Palette). The data flows from the " +
        "same `data/<name>.ts` files the registry hydrates.",
    ),
  );
  out.print(blank());

  const catalog = TERMINAL_THEME_CATALOG;

  for (const { label, theme } of catalog) {
    const bg = theme.backgroundColor;
    const fg = theme.foregroundColor;
    const palette = theme.palette;
    const ansi = theme.ansiColors;
    const row = new RichText("").append(
      `  ${label.padEnd(24)} `,
      bgFgStyle(bg, fg, bg),
    );
    for (const v of SEMANTIC_VARS) {
      const c = palette.get(v);
      if (c === undefined) {
        row.append("  ∅  ", "dim");
        continue;
      }
      row.append("  ◼  ", Style.parse(`${c.hex} on ${bg.hex}`));
    }
    row.append(dim(`  ansi=${ansi.size}`));
    out.print(row);
  }
  out.print(blank());

  // SVG_EXPORT_THEME is the palette intended for SVG-format transcripts of
  // terminal output (a near-black `#292929` substrate distinct from pure
  // `#000000`, plus alpha-laden overlay colors in its data file for cursor
  // and selection shading). It is still a `dark: true` theme — the comparison
  // is between two dark substrates, not a dark-vs-light flip.
  out.print(
    dim(
      `    SVG_EXPORT_THEME.bg=${SVG_EXPORT_THEME.backgroundColor.hex}  ` +
        `vs DEFAULT_TERMINAL_THEME.bg=${DEFAULT_TERMINAL_THEME.backgroundColor.hex} — ` +
        `both dark; SVG_EXPORT lifts off pure black so the substrate is visible against an SVG-host page.`,
    ),
  );
  out.print(blank());
}

// ===========================================================================
// SECTION 7 — OKLCH transposition (themes-as-melodies)
// ===========================================================================

function section7Transposition(): void {
  out.print(sectionHeader(7, "OKLCH transposition — themes-as-melodies"));
  out.print(
    blurb(
      "Themes are melodies; ThemeKey is the key signature. Because OKLCH is " +
        "perceptually uniform, +60° hue feels like the same jump everywhere. " +
        "ANCHORED_ROOTS lock the hue of error/success/warning so semantics " +
        "survive transposition.",
    ),
  );
  out.print(blank());

  // Setup: Oklch round-trip + IDENTITY/INVERT_LIGHTNESS shape checks. The
  // labeled sub-demos (7a–7d) start after this intro.
  const sample = parseRgbHex("83a598"); // gruvbox aqua
  const okl = Oklch.fromRgba(sample);
  const back = okl.toRgba();
  out.print(
    new RichText("    Oklch.fromRgba(#83a598) → ")
      .append(`L=${okl.l.toFixed(3)}  C=${okl.c.toFixed(3)}  h=${okl.h.toFixed(1)}°`, "bold")
      .append("   → toRgba → ")
      .append(`${back.hex}`),
  );
  out.print(
    new RichText(`    isIdentityKey(IDENTITY)        = ${isIdentityKey(IDENTITY)}`),
  );
  out.print(
    new RichText(
      `    isIdentityKey(INVERT_LIGHTNESS) = ${isIdentityKey(INVERT_LIGHTNESS)}`,
    ),
  );
  out.print(blank());

  // 7a — Hue circle: rotations of gruvbox at evenly-spaced hue offsets.
  // Same swatchRow shape as section 4 / 6, but the data flowing through
  // is the *transposed* palette.
  const base = getThemePalette("gruvbox");
  const HUE_ROTATIONS = [0, 60, 120, 180, 240, 300];
  out.print(
    bold(`    7a. Hue circle — gruvbox, ${HUE_ROTATIONS.length} rotations`),
  );
  out.print(blurb("Decorative colors rotate; anchored vars (error/success/warning) hold."));
  for (const deg of HUE_ROTATIONS) {
    const key: ThemeKey = {
      hueShift: deg,
      chromaScale: 1,
      lightnessScale: 1,
      lightnessShift: 0,
    };
    const t = transposePalette(base, key, `gruvbox +${deg}°`);
    const tbg = t.get("background")!;
    const tfg = t.get("foreground")!;
    const row = new RichText("").append(`  +${String(deg).padStart(3)}°  `, bgFgStyle(tbg, tfg, tbg));
    for (const v of SEMANTIC_VARS) {
      const c = t.get(v)!;
      const lock = isAnchored(v) ? "ʟ" : " ";
      row.append(` ${lock}${v.padEnd(8)} `, bgFgStyle(c, tfg, tbg));
    }
    out.print(row);
  }
  out.print(blurb("ʟ = anchored (hue locked by ANCHORED_ROOTS)."));
  out.print(blank());

  // 7b — Chroma sweep on nord. Same dataflow, different ThemeKey axis.
  const nord = getThemePalette("nord");
  const CHROMA_SCALES = [0.3, 0.6, 1.0, 1.3, 1.6];
  out.print(
    bold(`    7b. Chroma sweep — nord, ${CHROMA_SCALES.length} saturation levels`),
  );
  out.print(blurb("chromaScale 0 = grayscale, 1 = identity, >1 = supersaturated."));
  for (const scale of CHROMA_SCALES) {
    const key: ThemeKey = {
      hueShift: 0,
      chromaScale: scale,
      lightnessScale: 1,
      lightnessShift: 0,
    };
    const t = transposePalette(nord, key, `nord ×${scale}`);
    const tbg = t.get("background")!;
    const tfg = t.get("foreground")!;
    const row = new RichText("").append(`  ×${scale.toFixed(1)}  `, bgFgStyle(tbg, tfg, tbg));
    for (const v of SEMANTIC_VARS) {
      const c = t.get(v)!;
      row.append(` ${v.padEnd(9)} `, bgFgStyle(c, tfg, tbg));
    }
    out.print(row);
  }
  out.print(blank());

  // 7c — INVERT_LIGHTNESS: algorithmic light theme from a dark one.
  out.print(bold("    7c. INVERT_LIGHTNESS — algorithmic vs hand-authored light"));
  out.print(
    blurb(
      "Solarized has a hand-authored light variant; algorithm-flipping the " +
        "dark version produces a similar but not identical palette.",
    ),
  );
  const solDark = getThemePalette("solarized-dark");
  const flipped = transposePalette(solDark, INVERT_LIGHTNESS, "solarized-dark↺");
  const solLight = getThemePalette("solarized-light");
  for (const [label, p] of [
    ["solarized-dark   (source)", solDark] as const,
    ["solarized-dark↺  (ALGO)  ", flipped] as const,
    ["solarized-light  (AUTH)  ", solLight] as const,
  ]) {
    const pbg = p.get("background")!;
    const pfg = p.get("foreground")!;
    const row = new RichText("").append(`  ${label}  `, bgFgStyle(pbg, pfg, pbg));
    for (const v of SEMANTIC_VARS) {
      const c = p.get(v)!;
      row.append(` ${v.padEnd(9)} `, bgFgStyle(c, pfg, pbg));
    }
    out.print(row);
  }
  out.print(blank());

  // 7d — themeKeyForRoot: aim a theme's *tonic* at a target hue and watch
  // the rest follow. Anchored vars still keep their hue; everything else
  // shifts by exactly the interval that carries `primary` to 200°.
  out.print(bold("    7d. themeKeyForRoot — aim gruvbox's primary at 200°"));
  const key = themeKeyForRoot(base, "primary", 200);
  const aimed = transposePalette(base, key, "gruvbox→primary@200°");
  const abg = aimed.get("background")!;
  const afg = aimed.get("foreground")!;
  const aimedRow = new RichText("").append(
    `  key.hueShift=${key.hueShift.toFixed(1)}°  `,
    bgFgStyle(abg, afg, abg),
  );
  for (const v of SEMANTIC_VARS) {
    const c = aimed.get(v)!;
    aimedRow.append(` ${v.padEnd(9)} `, bgFgStyle(c, afg, abg));
  }
  out.print(aimedRow);
  out.print(
    blurb(
      `ANCHORED_ROOTS = {${[...ANCHORED_ROOTS].join(", ")}} — these stay put; the rest follow the tonic.`,
    ),
  );
  out.print(blank());
}

// ===========================================================================
// SECTION 8 — WCAG contrast toolkit
// ===========================================================================

function section8Contrast(): void {
  out.print(sectionHeader(8, "WCAG contrast — relativeLuminance, contrastRatio, ensureContrast"));
  out.print(
    blurb(
      "relativeLuminance is the WCAG luminance of one color; contrastRatio " +
        "is the ratio between two (1:1 to 21:1). contrastFor picks black or " +
        "white. ensureContrast slides a color's OKLCH lightness until the " +
        "ratio is met — keeping its hue so themed text still looks themed.",
    ),
  );
  out.print(blank());

  // Relative luminance of a few well-known points.
  const black = new ColorRgba(0, 0, 0);
  const white = new ColorRgba(255, 255, 255);
  const mid = parseRgbHex("808080");
  out.print(
    dim(
      `    relativeLuminance: black=${relativeLuminance(black).toFixed(4)}, ` +
        `#808080=${relativeLuminance(mid).toFixed(4)}, ` +
        `white=${relativeLuminance(white).toFixed(4)}`,
    ),
  );
  out.print(
    dim(
      `    contrastRatio(black, white) = ${contrastRatio(black, white).toFixed(2)}:1   (the maximum)`,
    ),
  );
  out.print(blank());

  // A contrast matrix on gruvbox: for each semantic var, the ratio against
  // background. WCAG AA body text wants ≥ 4.5; AA large text wants ≥ 3.
  const palette = getThemePalette("gruvbox");
  const bg = palette.get("background")!;
  out.print(bold("    Contrast on gruvbox background (each semantic var → bg):"));
  for (const v of SEMANTIC_VARS) {
    const c = palette.get(v)!;
    const ratio = contrastRatio(c, bg);
    const aa = ratio >= 4.5 ? "AA body ✓" : ratio >= 3 ? "AA large ✓" : "fails AA ✗";
    out.print(
      new RichText(`      ${v.padEnd(10)} `)
        .append(`  ${c.hex}  `, bgFgStyle(c, palette.get("foreground")!, bg))
        .append(`  ratio ${ratio.toFixed(2).padStart(5)}:1  ${aa}`),
    );
  }
  out.print(blank());

  // contrastFor: pick the WCAG-correct black/white pair for "text on this bg".
  // This is the single source of truth buildPalette uses for `on-*` vars.
  out.print(bold("    contrastFor(bg) — picks black or white for text-on-bg:"));
  for (const v of ["primary", "warning", "error", "success"] as const) {
    const c = palette.get(v)!;
    const onColor = contrastFor(c);
    out.print(
      new RichText(`      on ${v.padEnd(8)} `)
        .append(`   Aa contrast text   `, Style.parse(`${onColor.hex} on ${c.hex}`)),
    );
  }
  out.print(blank());

  // ensureContrast: keep hue, just slide L. Deliberately bad cases: a
  // bright yellow on white (low contrast at full saturation), and a pale
  // pink on a light cream bg. After ensureContrast each row is guaranteed
  // legible at ratio ≥ 4.5 — and the hue is preserved, so it still looks
  // yellow and pink respectively.
  out.print(bold("    ensureContrast — keep hue, slide lightness until ≥ 4.5:1"));
  const hardCases: Array<{ label: string; fg: ColorRgba; lightBg: ColorRgba }> = [
    { label: "bright yellow on white ", fg: parseRgbHex("ffc107"), lightBg: white },
    { label: "pale pink on cream     ", fg: parseRgbHex("f8b4d9"), lightBg: parseRgbHex("fdf6e3") },
    { label: "light teal on white    ", fg: parseRgbHex("5fd2c2"), lightBg: white },
  ];
  for (const { label, fg: rawFg, lightBg } of hardCases) {
    const fixed = ensureContrast(rawFg, lightBg, 4.5);
    out.print(
      new RichText(`      before  ${label}  `)
        .append("  Aa text  ", Style.parse(`${rawFg.hex} on ${lightBg.hex}`))
        .append(`   ratio ${contrastRatio(rawFg, lightBg).toFixed(2)}:1`),
    );
    out.print(
      new RichText(`      after   ${label}  `)
        .append("  Aa text  ", Style.parse(`${fixed.hex} on ${lightBg.hex}`))
        .append(`   ratio ${contrastRatio(fixed, lightBg).toFixed(2)}:1   (${fixed.hex})`),
    );
  }
  out.print(blank());
}

// ===========================================================================
// Orchestrator — sections as data (`SECTIONS` is the order, the same render
// pipeline runs every section). [LAW:dataflow-not-control-flow]
// ===========================================================================

const SECTIONS: ReadonlyArray<() => void> = [
  section1ColorValues,
  section2ColorSpec,
  section3ColorSystem,
  section4ThemeRegistry,
  section5PaletteResolver,
  section6TerminalThemes,
  section7Transposition,
  section8Contrast,
];

function main(): void {
  out.print(
    new RichText("themes-and-color-studio", { style: "bold" }).append(
      "  ·  the flagship Themes & Color demo",
      "dim",
    ),
  );
  out.print(
    dim(
      "Eight sections. Color values → ColorSpec → system detection → registry → " +
        "resolver → terminal themes → OKLCH transposition → WCAG contrast.",
    ),
  );
  out.print(blank());

  for (const section of SECTIONS) {
    section();
  }
}

  main();

  return {
    stop(): void { /* one-shot demo — nothing to detach */ },
    out,
  };
}
