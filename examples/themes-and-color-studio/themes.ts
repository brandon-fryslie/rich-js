/** Sections 4–6: the bundled themes, the palettes built from them, and the terminal themes export draws with. */
import {
  ATOM_ONE_DARK,
  ATOM_ONE_LIGHT,
  blendRgb,
  buildPalette,
  CATPPUCCIN_FRAPPE,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MACCHIATO,
  CATPPUCCIN_MOCHA,
  ColorParseError,
  ColorRamp,
  ColorRefError,
  ColorRgba,
  Console,
  contrastFor,
  cubicBezier,
  CYBERPUNK,
  darken,
  DEFAULT_TERMINAL_THEME,
  DRACULA,
  EASES,
  Effected,
  FLEXOKI,
  getThemePalette,
  GRUVBOX,
  lighten,
  listThemePalettes,
  MONOKAI,
  NORD,
  Palette,
  parseEase,
  parseHexColor,
  parseRgbHex,
  Phase,
  resolveColorRef,
  RichText,
  ROSE_PINE,
  ROSE_PINE_DAWN,
  ROSE_PINE_MOON,
  SOLARIZED_DARK,
  SOLARIZED_LIGHT,
  steps,
  Style,
  SVG_EXPORT_THEME,
  TerminalTheme,
  TEXTUAL_ANSI,
  TEXTUAL_DARK,
  TEXTUAL_LIGHT,
  TOKYO_NIGHT,
  type Effect,
} from "@promptctl/rich-js";

import type { BaseColors, ThemeName } from "@promptctl/rich-js";

import { THEMES, type ThemePaletteData } from "@promptctl/rich-js/themes/data";
import { getThemeBaseColors, type ThemeBaseColors } from "@promptctl/rich-js/themes/registry";

import { bgFgStyle, blank, blurb, bold, dim, sectionHeader, SEMANTIC_VARS, truncate } from "./look.js";

// ===========================================================================
// SECTION 4 — Theme registry (every bundled theme as a swatch row)
// ===========================================================================

export function section4ThemeRegistry(out: Console): void {
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
  // The name column is as wide as the longest name, so the swatches line up
  // under each other and no cell goes to padding past it.
  const nameWidth = Math.max(...names.map((name) => name.length));
  for (const name of names) {
    const base: ThemeBaseColors = getThemeBaseColors(name);
    const palette = getThemePalette(name);
    const tag = base.dark ? "dark " : "light";
    const header = new RichText("").append(
      `  ${base.name.padEnd(nameWidth)} [${tag}]  `,
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
// SECTION 5 — Colour references (resolveColorRef / parseHexColor), buildPalette
// ===========================================================================

export function section5ColorRefs(out: Console): void {
  out.print(sectionHeader(5, "Colour references — one string, one checkpoint"));
  out.print(
    blurb(
      "A colour reference is a palette variable name OR a #RRGGBB / #RRGGBBAA " +
        "literal, and resolveColorRef is the single checkpoint that turns one " +
        "into a ColorRgba. It is idempotent — hand it the hex it just produced " +
        "and you get the same colour back — so callers never branch on \"is this " +
        "a name or already a colour\". A miss throws ColorRefError; there is no " +
        "spec mini-language left to learn.",
    ),
  );
  out.print(blank());

  // Use gruvbox as the substrate throughout the section.
  const palette: Palette = getThemePalette("gruvbox");
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;

  // Both reference kinds — and the round trip that proves idempotence — go
  // through the same call. [LAW:dataflow-not-control-flow]
  const named = resolveColorRef(palette, "primary");
  const literal = resolveColorRef(palette, "#d3869b");
  const roundTrip = resolveColorRef(palette, named.hex);
  const refRows: Array<{ call: string; color: ColorRgba; note: string }> = [
    { call: 'resolveColorRef(p, "primary")', color: named, note: "palette variable name" },
    { call: 'resolveColorRef(p, "#d3869b")', color: literal, note: "literal — no lookup happens" },
    {
      call: `resolveColorRef(p, "${named.hex}")`,
      color: roundTrip,
      note:
        roundTrip.hex === named.hex
          ? "idempotent: re-resolving its own output ✓"
          : "IDEMPOTENCE BROKEN — re-resolve diverged",
    },
  ];
  for (const { call, color, note } of refRows) {
    out.print(
      new RichText(`    ${call.padEnd(34)} → `)
        .append(`  ${color.hex}  `, bgFgStyle(color, fg, bg))
        .append("  ")
        .append(dim(note)),
    );
  }
  out.print(blank());

  // parseHexColor is the hex arm on its own — the parser a caller reaches for
  // when only a literal can mean anything (colour math cannot operate on a
  // name). It carries the alpha channel through, like parseRgbaHex in §1.
  const translucent = parseHexColor("#3b82f680");
  out.print(
    new RichText('    parseHexColor("#3b82f680")         → ')
      .append(`  ${translucent.hex}  `, bgFgStyle(translucent, fg, bg))
      .append(dim(`   alpha=${translucent.alpha}`)),
  );
  out.print(blank());

  // The hex grammar has one home: a caller asks parseHexColor rather than
  // keeping a pattern of its own beside it, so there is no second copy to
  // drift. A malformed literal is a ColorParseError naming the input.
  // [LAW:single-enforcer]
  out.print(dim("    parseHexColor — the one hex grammar, asked directly:"));
  // Each probe says which way it should go, so a malformed literal that
  // parsed shows as the regression it is rather than as one more swatch.
  const hexVerdict = (probe: string, parses: boolean): RichText => {
    try {
      const color = parseHexColor(probe);
      return parses
        ? new RichText("").append(`  ${color.hex}  `, bgFgStyle(color, fg, bg))
        : new RichText(`WRONG: parsed as ${color.hex}`, { style: "bold red" });
    } catch (err) {
      if (!(err instanceof ColorParseError)) {
        return new RichText(`WRONG error type (${err instanceof Error ? err.name : typeof err})`, { style: "bold red" });
      }
      return parses
        ? new RichText(`WRONG: refused — ${err.message}`, { style: "bold red" })
        : new RichText(err.message, { style: "green" });
    }
  };
  for (const [probe, parses] of [
    ["#7aa2f7", true],
    ["#7aa2f780", true],
    ["#7aa2f", false],
    ["7aa2f7", false],
    ["#7ag2f7", false],
  ] as const) {
    out.print(
      new RichText(`      parseHexColor("${probe}")${" ".repeat(Math.max(0, 12 - probe.length))} → `).append(
        hexVerdict(probe, parses),
      ),
    );
  }
  out.print(blank());

  // Loud failure, both mistakes. Same three-outcome shape as §1's
  // ColorParseError probe: the "didn't throw" branch is what keeps a
  // regression to silent-default from passing unnoticed.
  // [LAW:no-silent-fallbacks]
  type RefOutcome =
    | { kind: "correct"; message: string }
    | { kind: "wrong-type"; got: string }
    | { kind: "no-throw"; got: string };

  function probeBadRef(ref: string): RefOutcome {
    try {
      return { kind: "no-throw", got: resolveColorRef(palette, ref).hex };
    } catch (err) {
      return err instanceof ColorRefError
        ? { kind: "correct", message: err.message }
        : { kind: "wrong-type", got: err instanceof Error ? err.name : typeof err };
    }
  }

  out.print(bold("    ColorRefError — a bad reference is a broken config, so it throws:"));
  for (const { ref, why } of [
    { ref: "text-primry", why: "typo'd palette name — near misses come from the live palette" },
    { ref: "#12345", why: "malformed hex — caught by the hex arm, not reported as a bad name" },
  ]) {
    const outcome = probeBadRef(ref);
    const line: { text: string; style: string } =
      outcome.kind === "correct"
        ? { text: `      "${ref}" → ${truncate(outcome.message, 200)}`, style: "green" }
        : outcome.kind === "wrong-type"
        ? { text: `      "${ref}" raised the WRONG error type (${outcome.got})`, style: "bold red" }
        : {
            text: `      "${ref}" DID NOT THROW (got ${outcome.got}) — loud-failure regressed`,
            style: "bold red",
          };
    out.print(new RichText(line.text, { style: line.style }));
    out.print(blurb(why));
  }
  out.print(blank());

  // The composition that replaced the old spec-string grammar. Every form
  // the resolver used to parse inside a string ("primary-darken-3",
  // "accent 50%", "auto") is now an ordinary function applied to a resolved
  // colour — so the vocabulary grows by composing, not by adding grammar
  // productions. [LAW:composability]
  const primary = resolveColorRef(palette, "primary");
  const accent = resolveColorRef(palette, "accent");
  const surface = resolveColorRef(palette, "surface");
  out.print(bold("    Old spec string → the composition that replaced it:"));
  out.print(blurb('ref(x) abbreviates resolveColorRef(palette, x); bg is the gruvbox background.'));
  const compositions: Array<{ was: string; now: string; color: ColorRgba }> = [
    { was: '"primary-darken-3"', now: 'darken(ref("primary"), 3)', color: darken(primary, 3) },
    { was: '"primary-lighten-1"', now: 'lighten(ref("primary"), 1)', color: lighten(primary, 1) },
    { was: '"accent 50%"', now: 'blendRgb(bg, ref("accent"), 0.5)', color: blendRgb(bg, accent, 0.5) },
    { was: '"auto"', now: 'contrastFor(ref("surface"))', color: contrastFor(surface) },
  ];
  for (const { was, now, color } of compositions) {
    out.print(
      new RichText(`      ${was.padEnd(20)} → ${now.padEnd(32)} `)
        .append(`  ${color.hex}  `, bgFgStyle(color, fg, bg)),
    );
  }
  // The theme *also* ships a pre-derived `-darken-N` / `-lighten-N` ramp as
  // real palette variables (buildPalette's own formula, tuned per theme), and
  // resolveColorRef reaches every one of them by name — it is total over the
  // palette, not over a hand-picked list of "spec-able" roots. So the two
  // spellings are both available and neither is a special case: the named
  // ramp is the theme's opinion, the composed one is arithmetic on the spot.
  out.print(blank());
  out.print(bold("    …and the theme's own pre-derived ramp, reached by plain name:"));
  const namedRamp = new RichText("      ");
  for (const name of [
    "primary-darken-3",
    "primary-darken-1",
    "primary",
    "primary-lighten-1",
    "primary-lighten-3",
  ]) {
    const c = resolveColorRef(palette, name);
    namedRamp.append(`  ${c.hex}  `, bgFgStyle(c, fg, bg));
  }
  out.print(namedRamp.append(dim('   ref("primary-darken-3") …')));
  out.print(blank());

  // ColorRamp — the one colour operation whose input is a *number*. A
  // measurement lands on ordered stops; `linear` interpolates between them
  // in OKLCH, `step` holds each stop until the next, which is a threshold
  // cascade (`≥ 50 warning, ≥ 80 error`) spelled as data. Every ease is
  // one class with one value changed: CSS's named curves, by the name a
  // template spells them with, and `steps`/`cubicBezier` built in place.
  // [LAW:one-type-per-behavior]
  const stops = [
    { at: 0, color: surface },
    { at: 50, color: resolveColorRef(palette, "warning") },
    { at: 80, color: resolveColorRef(palette, "error") },
  ];
  out.print(bold("    ColorRamp — a number → a colour, over the same stops, per ease:"));
  out.print(blurb("stops at 0 (surface), 50 (warning), 80 (error)"));
  const eases = [
    ...Object.entries(EASES),
    ["steps(3)", steps(3)] as const,
    ["steps(3, jump-start)", steps(3, "jump-start")] as const,
    ["cubicBezier(.7,0,.3,1)", cubicBezier(0.7, 0, 0.3, 1)] as const,
  ];
  for (const [label, ease] of eases) {
    const ramp = new ColorRamp(ease, stops);
    const row = new RichText(`      ${label.padEnd(24)}`);
    for (const value of [0, 25, 50, 65, 80, 100]) {
      row.append(` ${String(value).padStart(3)} `, bgFgStyle(ramp.at(value), fg, bg));
    }
    out.print(row);
  }
  out.print(blank());

  // A phase turns seconds into progress, so the same ramp can be swept by
  // time instead of a measurement. `t` is an argument — nothing reads a
  // clock — so this row is the pulse sampled every quarter second, frozen.
  const pulse = Phase.pingPong(2);
  const pulseRamp = new ColorRamp(parseEase("sine"), [
    { at: 0, color: surface },
    { at: 1, color: resolveColorRef(palette, "primary") },
  ]);
  const pulseRow = new RichText(`      ${"pingPong(2s) · sine".padEnd(24)}`);
  for (let quarter = 0; quarter <= 8; quarter++) {
    pulseRow.append("    ", bgFgStyle(pulseRamp.at(pulse(quarter / 4)), fg, bg));
  }
  out.print(bold("    Phase — seconds → progress; t = 0 … 2 s in quarter seconds:"));
  out.print(pulseRow);
  out.print(blank());

  // Effected — the same phase driving a per-cell effect over a finished
  // renderable: a highlight band sweeping through the text, the shimmer
  // shape. The effect sees each cell's colours, its column and `t`, and the
  // band's centre is `loop(t)` of the way across. Three frames, frozen.
  const highlight = resolveColorRef(palette, "primary");
  const sweep = Phase.loop(1.5);
  const indent = "      ";
  const label = "  thinking about colour  ";
  const shimmer: Effect = (t) => {
    const centre = indent.length + sweep(t) * label.length;
    return (colors, cell) => {
      const weight = Math.max(0, 1 - Math.abs(cell.col - centre) / 4);
      const toward = new ColorRamp(EASES.linear, [
        { at: 0, color: colors.fg },
        { at: 1, color: highlight },
      ]);
      return { fg: toward.at(weight), bg: colors.bg };
    };
  };
  out.print(bold("    Effected — a per-cell effect sampled at t = 0, 0.5, 1 s:"));
  for (const t of [0, 0.5, 1]) {
    out.print(
      new Effected(new RichText(`${indent}${label}`), shimmer, { t, key: "studio-shimmer", theme: GRUVBOX }),
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

export function section6TerminalThemes(out: Console): void {
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

