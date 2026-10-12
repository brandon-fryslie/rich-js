/** Sections 1–3: colour as a value — parsed, downgraded, and the colour system a terminal is detected to have. */
import {
  ANSI_COLOR_NAMES,
  blendRgb,
  ColorDepth,
  ColorParseError,
  ColorRgba,
  ColorSpec,
  ColorTable,
  Console,
  detectColorSystem,
  EIGHT_BIT_TABLE,
  parseRgbaHex,
  parseRgbHex,
  resolveColorSystem,
  resolveDestination,
  RichText,
  STANDARD_TABLE,
  Style,
  WINDOWS_TABLE,
} from "@promptctl/rich-js";

import type { ColorSystemName, DetectColorOptions } from "@promptctl/rich-js";

import { bgFgStyle, blank, blurb, dim, sectionHeader } from "./look.js";

// ===========================================================================
// SECTION 1 — Color values, parsing, blending, alpha compositing
// ===========================================================================

export function section1ColorValues(out: Console): void {
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

export function section2ColorSpec(out: Console): void {
  out.print(sectionHeader(2, "ColorSpec — the styled-output color type"));
  out.print(
    blurb(
      "ColorSpec wraps a value at a given ColorDepth (TRUECOLOR / EIGHT_BIT / " +
        "STANDARD / DEFAULT / WINDOWS) and emits ANSI SGR codes. " +
        "`ColorSpec.downgrade` quantizes truecolor into EIGHT_BIT_TABLE, " +
        "STANDARD_TABLE, or WINDOWS_TABLE — the Windows console's own " +
        "sixteen, which nothing detects: only `ColorDepth.WINDOWS` picks it.",
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
  // EIGHT_BIT_DOWNGRADE_TABLE.match — indices 16–255, never the terminal's
  // own ANSI 0–15 — and STANDARD via STANDARD_TABLE.match).
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

export function section3ColorSystem(out: Console): void {
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

  // resolveColorSystem: same enum from a ColorSystemName. "auto" falls
  // through to detection; every other name is a fixed depth.
  out.print(dim("    resolveColorSystem(spec):"));
  const names: readonly ColorSystemName[] = ["truecolor", "256", "ansi", "none", "auto"];
  for (const spec of names) {
    const depth = resolveColorSystem(spec, cases[1]!.opts);
    const label = depth === null ? "null" : ColorDepth[depth];
    out.print(new RichText(`      "${spec.padEnd(9)}"  →  ${label}`));
  }
  out.print(blank());

  // resolveDestination: the colour depth AND whether OSC 8 links are drawn.
  // A hyperlink is not a colour — NO_COLOR keeps links; no TTY or TERM=dumb
  // (a destination that takes no escapes) drops them.
  out.print(dim("    resolveDestination(\"auto\", opts):"));
  for (const c of [
    ...cases,
    { label: "TTY + TERM=dumb            ", opts: { env: { TERM: "dumb" }, isTTY: true } },
  ]) {
    const d = resolveDestination("auto", c.opts);
    const depth = d.colorSystem === null ? "null" : ColorDepth[d.colorSystem];
    out.print(new RichText(`      ${c.label}  →  ${depth}, links ${d.hyperlinks ? "on" : "off"}`));
  }
  out.print(blank());
}

