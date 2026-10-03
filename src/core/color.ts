/**
 * Terminal color representation, parsing, downgrading, and ANSI code generation.
 */

import type { Env } from "./env.js";
import { Memo } from "./memo.js";

// --- ColorRgba ---

function hex2(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

// [LAW:one-source-of-truth] The one statement of a colour byte's range: the
// constructor asserts it and the string parser reports it, from this predicate.
function isByte(v: number): boolean {
  return Number.isInteger(v) && v >= 0 && v <= 255;
}

function assertChannel(name: string, v: number): void {
  if (!isByte(v)) {
    throw new RangeError(
      `ColorRgba.${name} must be an integer in [0, 255]; got ${v}`,
    );
  }
}

/**
 * Immutable RGBA color value. Alpha defaults to 1 (fully opaque).
 *
 * [LAW:single-enforcer] The constructor is the sole validation site for
 * channel/alpha invariants. Float-arithmetic callers (HSL roundtrips, blends,
 * lerps) are responsible for `Math.round` + clamp before construction; the
 * constructor throws rather than silently masking out-of-range input.
 */
export class ColorRgba {
  constructor(
    readonly red: number,
    readonly green: number,
    readonly blue: number,
    readonly alpha: number = 1,
  ) {
    assertChannel("red", red);
    assertChannel("green", green);
    assertChannel("blue", blue);
    if (!Number.isFinite(alpha) || alpha < 0 || alpha > 1) {
      throw new RangeError(
        `ColorRgba.alpha must be a finite number in [0, 1]; got ${alpha}`,
      );
    }
  }

  /** 6-char `#RRGGBB` when fully opaque, 8-char `#RRGGBBAA` otherwise. */
  get hex(): string {
    const rgb = "#" + hex2(this.red) + hex2(this.green) + hex2(this.blue);
    return this.alpha === 1 ? rgb : rgb + hex2(Math.round(this.alpha * 255));
  }

  /** `rgb(r,g,b)` when fully opaque, `rgba(r,g,b,a)` otherwise. */
  get rgb(): string {
    return this.alpha === 1
      ? `rgb(${this.red},${this.green},${this.blue})`
      : `rgba(${this.red},${this.green},${this.blue},${this.alpha})`;
  }

  /** [r/255, g/255, b/255, alpha] — alpha is already 0..1, no division. */
  get normalized(): [number, number, number, number] {
    return [this.red / 255, this.green / 255, this.blue / 255, this.alpha];
  }

  /**
   * Composite this color over an opaque background. Returns a fully opaque
   * ColorRgba (alpha=1). Per-channel linear interpolation by alpha.
   *
   * [LAW:dataflow-not-control-flow] alpha=1 short-circuits to `this`, so
   * callers can invoke this unconditionally; the data decides whether work
   * happens.
   */
  compositeOver(bg: ColorRgba): ColorRgba {
    if (this.alpha === 1) return this;
    const t = this.alpha;
    return new ColorRgba(
      Math.round(bg.red + (this.red - bg.red) * t),
      Math.round(bg.green + (this.green - bg.green) * t),
      Math.round(bg.blue + (this.blue - bg.blue) * t),
      1,
    );
  }
}

/**
 * The surface a terminal draws a translucent colour over. A terminal cannot
 * know what lies under its cells, so the SGR writer (`Style.toSgrCodes`), the
 * strip's seam test and the contrast choosers (`themes/colorMath`) all
 * composite over this one colour. [LAW:one-source-of-truth] One constant, so
 * the colour text is chosen against is the colour the writer draws.
 */
export const SURFACE_BLACK = new ColorRgba(0, 0, 0);

/**
 * WCAG 2.x relative luminance (0..1) of an opaque color. The single
 * luminance function in the codebase — `contrastFor`, `contrastRatio`, and
 * any caller that needs to reason about readability all funnel through it.
 * [LAW:one-source-of-truth]
 */
export function relativeLuminance(c: ColorRgba): number {
  const ch = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.red) + 0.7152 * ch(c.green) + 0.0722 * ch(c.blue);
}

/**
 * WCAG 2.x contrast ratio between two colors, in [1, 21]. Symmetric — the
 * order of arguments does not matter. 4.5 is the AA threshold for normal
 * text, 3.0 for large text.
 *
 * Assumes opaque inputs: alpha is ignored, since the displayed contrast of a
 * translucent color depends on what it composites over. For a translucent
 * foreground, flatten it first (or use `ensureContrast`, which does).
 */
export function contrastRatio(a: ColorRgba, b: ColorRgba): number {
  return luminanceRatio(relativeLuminance(a), relativeLuminance(b));
}

// [LAW:single-enforcer] The WCAG ratio over two relative luminances — the one
// formula `contrastRatio` and `ColorTable.matchReadable` (which caches its
// entries' luminances) both measure with.
function luminanceRatio(la: number, lb: number): number {
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05);
}

// --- ColorTable ---

// [LAW:one-source-of-truth] The one distance every table scan ranks by, so
// `matchWhere`'s "nearest by the distance `match` uses" cannot drift.
function rgbDistance(a: ColorRgba, b: ColorRgba): number {
  const dr = a.red - b.red;
  const dg = a.green - b.green;
  const db = a.blue - b.blue;
  return dr * dr + dg * dg + db * db;
}

/**
 * An indexed palette: entry `i` of `colors` is terminal index `firstIndex + i`.
 * `firstIndex` lets a table hold only the part of a palette a downgrade may
 * choose (the 256-colour cube and grey ramp start at 16) while every index it
 * reports is the terminal's own.
 */
export class ColorTable {
  private readonly colors: ColorRgba[];
  readonly firstIndex: number;
  // Keyed by colours a host computes without end (ramp stops, mixes), so bounded.
  private readonly matchMemo = new Memo<number>();
  private readonly readableMemo = new Memo<number>();

  constructor(colors: ColorRgba[], firstIndex = 0) {
    this.colors = colors;
    this.firstIndex = firstIndex;
  }

  get(index: number): ColorRgba {
    return this.colors[index - this.firstIndex]!;
  }

  private luminanceCache: readonly number[] | undefined;
  /** Each entry's relative luminance, computed once per table. */
  private luminances(): readonly number[] {
    this.luminanceCache ??= this.colors.map(relativeLuminance);
    return this.luminanceCache;
  }

  /** How many entries the table holds (terminal indices `firstIndex`…). */
  get size(): number {
    return this.colors.length;
  }

  /**
   * Finds the nearest table index to the given color (Euclidean RGB distance, cached).
   * Alpha is part of the cache key so two values that differ only in alpha
   * don't collide, but is not used in the distance metric.
   */
  match(value: ColorRgba): number {
    const key = `${value.red},${value.green},${value.blue},${value.alpha}`;
    return this.matchMemo.get(key, () => this.nearest(value));
  }

  private nearest(value: ColorRgba): number {
    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.colors.length; i++) {
      const c = this.colors[i]!;
      const dist = rgbDistance(c, value);
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    return this.firstIndex + bestIndex;
  }

  /**
   * The nearest entry to `value` (the distance `match` uses) among those that
   * clear `minRatio` against `on`; when none does, the entry with the most
   * contrast against `on`. Text downgraded on its own background: `match`
   * moves text and background independently, and two independent roundings
   * can meet in the middle, so a pair that read at 4.5:1 in truecolor can
   * draw at 2:1. [LAW:dataflow-not-control-flow] One scan scores every entry;
   * the ratio decides which one wins.
   */
  matchReadable(value: ColorRgba, on: ColorRgba, minRatio: number): number {
    const key = `${value.red},${value.green},${value.blue}|${on.red},${on.green},${on.blue}|${minRatio}`;
    return this.readableMemo.get(key, () => this.nearestReadable(value, on, minRatio));
  }

  private nearestReadable(value: ColorRgba, on: ColorRgba, minRatio: number): number {
    const lOn = relativeLuminance(on);
    let best = 0;
    let bestPasses = false;
    let bestScore = -Infinity;
    for (let i = 0; i < this.colors.length; i++) {
      const c = this.colors[i]!;
      const lc = this.luminances()[i]!;
      const ratio = luminanceRatio(lc, lOn);
      const passes = ratio >= minRatio;
      // A passing entry scores by closeness; a failing one only by contrast,
      // and loses to every passing one.
      const score = passes ? -rgbDistance(c, value) : ratio;
      if (
        (passes && !bestPasses) ||
        (passes === bestPasses && score > bestScore)
      ) {
        best = i;
        bestPasses = passes;
        bestScore = score;
      }
    }
    return this.firstIndex + best;
  }

  /**
   * The nearest entry to `value` (the distance `match` uses) among those
   * `accept` takes, given each entry's colour and terminal index; `undefined`
   * when it takes none. Entries are offered nearest-first (ties to the lower
   * index) and the first taken wins, so an expensive predicate runs only as
   * far out as the answer. Uncached: the predicate is the caller's, and a
   * closure has no key.
   */
  matchWhere(
    value: ColorRgba,
    accept: (entry: ColorRgba, index: number) => boolean,
  ): number | undefined {
    const dist = this.colors.map((c) => rgbDistance(c, value));
    const nearestFirst = [...dist.keys()].sort((a, b) => dist[a]! - dist[b]!);
    const found = nearestFirst.find((i) => accept(this.colors[i]!, this.firstIndex + i));
    return found === undefined ? undefined : this.firstIndex + found;
  }
}

// --- Enums ---

export enum ColorDepth {
  DEFAULT = 0,
  STANDARD = 1,
  EIGHT_BIT = 2,
  TRUECOLOR = 3,
  WINDOWS = 4,
}

/**
 * How many colours a depth can name, as a rank. WINDOWS is a sixteen-colour
 * depth whose enum value sits above TRUECOLOR, so the enum's order is not this.
 * STANDARD and WINDOWS share a rank: the same sixteen slots, drawn by
 * different terminals, so each converts to the other by keeping the slot.
 */
function fidelity(depth: ColorDepth): number {
  switch (depth) {
    case ColorDepth.DEFAULT:
      return 0;
    case ColorDepth.STANDARD:
    case ColorDepth.WINDOWS:
      return 1;
    case ColorDepth.EIGHT_BIT:
      return 2;
    case ColorDepth.TRUECOLOR:
      return 3;
  }
}

// --- ColorDepth resolution ---

export interface DetectColorOptions {
  /** Environment to probe. Defaults to `process.env`. */
  env?: Env;
  /** Whether output is going to a real terminal. Defaults to `process.stdout?.isTTY`. */
  isTTY?: boolean;
}

// The depths a colour system is named for. Its keys and "auto" are the whole
// vocabulary: `ColorSystemName` is derived from them, so the type and the
// table cannot disagree. [LAW:one-source-of-truth]
const COLOR_SYSTEM_DEPTHS = {
  truecolor: ColorDepth.TRUECOLOR,
  "256": ColorDepth.EIGHT_BIT,
  ansi: ColorDepth.STANDARD,
  none: null,
} as const;

/**
 * A colour system by name: `"auto"` detects it from the environment, and each
 * other name is a fixed depth — `"none"` no colour. `ColorDepth.WINDOWS` has
 * no name; pass the enum value where a `ColorDepth` is accepted.
 */
export type ColorSystemName = "auto" | keyof typeof COLOR_SYSTEM_DEPTHS;

// [LAW:one-source-of-truth] What the environment says about colour, by the
// value it says it with: FORCE_COLOR values (the chalk/supports-color
// convention), TERM_PROGRAM identifiers, and exact TERM names whose colour
// capability is known. A different vocabulary from `ColorSystemName`, so a
// different table: `FORCE_COLOR=none` is not a request for no colour. A `Map`,
// so a value naming an `Object.prototype` member is unknown, not a function.
// `null` means "no color".
const ENV_DEPTHS: ReadonlyMap<string, ColorDepth | null> = new Map([
  // FORCE_COLOR values
  ["0", null],
  ["false", null],
  ["1", ColorDepth.STANDARD],
  ["true", ColorDepth.STANDARD],
  ["2", ColorDepth.EIGHT_BIT],
  ["3", ColorDepth.TRUECOLOR],

  // TERM_PROGRAM identifiers
  ["iTerm.app", ColorDepth.TRUECOLOR],
  ["Apple_Terminal", ColorDepth.EIGHT_BIT],
  ["vscode", ColorDepth.TRUECOLOR],
  ["Tabby", ColorDepth.TRUECOLOR],

  // Known truecolor TERM names
  ["xterm-kitty", ColorDepth.TRUECOLOR],
  ["xterm-ghostty", ColorDepth.TRUECOLOR],
  ["wezterm", ColorDepth.TRUECOLOR],
  ["alacritty", ColorDepth.TRUECOLOR],
  ["foot", ColorDepth.TRUECOLOR],
  ["contour", ColorDepth.TRUECOLOR],
]);

/**
 * Detect the terminal's color capability from env + TTY state.
 *
 * Probes (in priority order): NO_COLOR (per https://no-color.org —
 * any non-empty value disables color), FORCE_COLOR (numeric/boolean override),
 * TTY presence, TERM=dumb/unknown, COLORTERM, known terminal/TERM_PROGRAM
 * names, and TERM regex patterns. Returns `null` for "no color".
 *
 * [LAW:dataflow-not-control-flow] Same probes run every call; variability is
 * in the env values, not in which checks execute.
 */
export function detectColorSystem(
  options: DetectColorOptions = {},
): ColorDepth | null {
  // NO_COLOR and FORCE_COLOR are preferences about colour, not facts about the
  // terminal, so they sit outside the probe. NO_COLOR (any non-empty value)
  // beats FORCE_COLOR; FORCE_COLOR beats TTY/TERM detection.
  const noColor = envOf(options)["NO_COLOR"];
  if (noColor !== undefined && noColor !== "") return null;
  const forced = forcedColorSystem(envOf(options));
  return forced !== undefined ? forced : terminalColorSystem(options);
}

// FORCE_COLOR's depth: `undefined` when unset, `null` for its off values.
function forcedColorSystem(env: Env): ColorDepth | null | undefined {
  const force = env["FORCE_COLOR"];
  if (force === undefined || force === "") return undefined;
  const mapped = ENV_DEPTHS.get(force);
  return mapped !== undefined ? mapped : ColorDepth.STANDARD;
}

function envOf(options: DetectColorOptions): Env {
  return options.env ?? (typeof process !== "undefined" ? process.env : {});
}

/**
 * A terminal that says it cannot be drawn on: `TERM` is `dumb` or `unknown`,
 * as Emacs' shell mode sets it. It takes no colour and nothing that moves the
 * cursor.
 */
export function isDumbTerminal(env: Env): boolean {
  const term = env["TERM"];
  return term === "dumb" || term === "unknown";
}

// What the destination can draw, preferences aside: TTY presence,
// TERM=dumb/unknown, COLORTERM, known terminal names, TERM patterns. `null`
// here means the destination takes no escapes at all.
function terminalColorSystem(options: DetectColorOptions): ColorDepth | null {
  const env = envOf(options);
  const isTTY =
    options.isTTY ??
    (typeof process !== "undefined" ? (process.stdout?.isTTY ?? false) : false);

  if (!isTTY) return null;

  if (isDumbTerminal(env)) return null;
  const term = env["TERM"] ?? "";

  const colorterm = env["COLORTERM"];
  if (colorterm === "truecolor" || colorterm === "24bit") {
    return ColorDepth.TRUECOLOR;
  }

  const termDepth = ENV_DEPTHS.get(term);
  if (termDepth !== undefined) return termDepth;

  const termProgram = env["TERM_PROGRAM"];
  if (termProgram !== undefined) {
    const mapped = ENV_DEPTHS.get(termProgram);
    if (mapped !== undefined) return mapped;
  }

  if (/-256(color)?$/i.test(term)) return ColorDepth.EIGHT_BIT;
  if (/-truecolor$/i.test(term)) return ColorDepth.TRUECOLOR;
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(term)) {
    return ColorDepth.STANDARD;
  }
  if (colorterm !== undefined && colorterm !== "") return ColorDepth.STANDARD;

  // Default: a terminal exists (isTTY=true) but we couldn't classify it.
  // Assume safe baseline rather than disabling color.
  return ColorDepth.STANDARD;
}

/**
 * Where segments are written, as everything the serializer (`segmentsToString`)
 * needs to know about it: the colour depth SGR is drawn at, and whether OSC 8
 * hyperlinks are emitted. The serializer takes this value whole, so a fact the
 * encoding comes to need joins it here rather than the serializer's signature.
 */
export interface Destination {
  readonly colorSystem: ColorDepth | null;
  readonly hyperlinks: boolean;
}

/**
 * Resolve a colour spec into a `Destination`.
 *
 * [LAW:single-enforcer] The one place a spec becomes both facts. A hyperlink is
 * not a colour: an explicit depth — `"none"` and `null` included — states a
 * colour choice and keeps links, and under `"auto"` links follow what the
 * terminal can take (no TTY, TERM=dumb: none) while NO_COLOR and FORCE_COLOR=0,
 * colour preferences, leave them alone. A FORCE_COLOR that forces colour on
 * declares the destination takes escapes, so it keeps links on a pipe too.
 */
export function resolveDestination(
  spec: ColorSystemName | ColorDepth | null,
  options?: DetectColorOptions,
): Destination {
  if (spec !== "auto") {
    return {
      colorSystem: typeof spec === "string" ? resolveColorSystem(spec) : spec,
      hyperlinks: true,
    };
  }
  return {
    colorSystem: detectColorSystem(options),
    hyperlinks:
      (forcedColorSystem(envOf(options ?? {})) ?? null) !== null ||
      terminalColorSystem(options ?? {}) !== null,
  };
}

/**
 * Resolve a colour system name into a `ColorDepth` (or `null` for no color).
 *
 * `"auto"` triggers env-based detection; every other name is a fixed depth.
 * A name outside the vocabulary — reachable only from untyped JavaScript —
 * throws: silent fallback would mask a typo.
 *
 * [LAW:single-enforcer] All name→ColorDepth resolution flows through here.
 */
export function resolveColorSystem(
  spec: ColorSystemName,
  options?: DetectColorOptions,
): ColorDepth | null {
  if (spec === "auto") return detectColorSystem(options);
  if (Object.hasOwn(COLOR_SYSTEM_DEPTHS, spec)) return COLOR_SYSTEM_DEPTHS[spec];
  throw new ColorParseError(
    `Unknown color system name: ${JSON.stringify(spec)} (expected "auto", "truecolor", "256", "ansi", or "none")`,
  );
}

// --- ColorSpec ---

export class ColorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ColorParseError";
  }
}

// [LAW:one-source-of-truth] The single source for parsed ColorSpec instances.
const colorSpecParseMemo = new Memo<ColorSpec>();

export class ColorSpec {
  readonly name: string;
  readonly type: ColorDepth;
  readonly number: number | undefined;
  readonly value: ColorRgba | undefined;

  private downgradeCache = new Map<ColorDepth, ColorSpec>();

  constructor(
    name: string,
    type: ColorDepth,
    number?: number,
    value?: ColorRgba,
  ) {
    this.name = name;
    this.type = type;
    this.number = number;
    this.value = value;
  }

  get isDefault(): boolean {
    return this.type === ColorDepth.DEFAULT;
  }

  /**
   * The colour every terminal draws this spec as, where that is fixed — before
   * any alpha is flattened, so a translucent value is drawn composited over
   * its ground (`flattenAlpha`) and should be measured that way: a
   * truecolor value, or a 256-colour cube or grey-ramp entry (xterm fixes
   * indices 16–255, and `fromAnsi` types only those as EIGHT_BIT). ANSI 0–15,
   * the default colour and a blend reaching either are the terminal theme's
   * own, so they have none.
   */
  get fixedValue(): ColorRgba | undefined {
    switch (this.type) {
      case ColorDepth.TRUECOLOR:
        return this.value;
      case ColorDepth.EIGHT_BIT:
        // The constructor admits an EIGHT_BIT spec at 0–15; those are the
        // theme's own slots whatever depth names them.
        return this.number! < 16 ? undefined : EIGHT_BIT_TABLE.get(this.number!);
      case ColorDepth.DEFAULT:
      case ColorDepth.STANDARD:
      case ColorDepth.WINDOWS:
        return undefined;
    }
  }

  get isSystemDefined(): boolean {
    return (
      this.type === ColorDepth.STANDARD || this.type === ColorDepth.WINDOWS
    );
  }

  /**
   * Generates SGR parameter strings for this color.
   */
  getAnsiCodes(foreground = true): string[] {
    switch (this.type) {
      case ColorDepth.DEFAULT:
        return [foreground ? "39" : "49"];
      case ColorDepth.STANDARD: {
        const n = this.number!;
        if (foreground) {
          return n < 8 ? [`${30 + n}`] : [`${90 + n - 8}`];
        }
        return n < 8 ? [`${40 + n}`] : [`${100 + n - 8}`];
      }
      case ColorDepth.EIGHT_BIT:
        return [foreground ? "38" : "48", "5", `${this.number!}`];
      case ColorDepth.TRUECOLOR: {
        const t = this.value!;
        return [
          foreground ? "38" : "48",
          "2",
          `${t.red}`,
          `${t.green}`,
          `${t.blue}`,
        ];
      }
      case ColorDepth.WINDOWS: {
        const n = this.number!;
        if (foreground) {
          return n < 8 ? [`${30 + n}`] : [`${90 + n - 8}`];
        }
        return n < 8 ? [`${40 + n}`] : [`${100 + n - 8}`];
      }
    }
  }

  /**
   * Composite this color's alpha (if any) against an opaque background,
   * returning a fully-opaque ColorSpec. Non-truecolor specs (palette
   * indices, default) have no alpha and pass through unchanged.
   *
   * [LAW:single-enforcer] Sole alpha-flattening site for the render
   * pipeline. Run *before* downgrade — otherwise palette matching on the
   * still-translucent RGB silently drops alpha (the "flatten then lose
   * alpha" path the unification ticket forbids).
   *
   * [LAW:dataflow-not-control-flow] `ColorRgba.compositeOver` is a no-op
   * when alpha=1, so callers invoke this unconditionally; the data
   * (alpha value) decides whether work happens.
   */
  flattenAlpha(bg: ColorRgba): ColorSpec {
    if (this.type !== ColorDepth.TRUECOLOR || !this.value) return this;
    const flat = this.value.compositeOver(bg);
    return flat === this.value ? this : ColorSpec.fromRgba(flat);
  }

  /**
   * Downgrade to a lower-fidelity color depth. Cached.
   */
  downgrade(targetSystem: ColorDepth): ColorSpec {
    if (this.type === ColorDepth.DEFAULT) return this;
    if (this.type === targetSystem || fidelity(this.type) < fidelity(targetSystem)) return this;

    const cached = this.downgradeCache.get(targetSystem);
    if (cached) return cached;

    const result = this.performDowngrade(targetSystem);
    this.downgradeCache.set(targetSystem, result);
    return result;
  }

  /**
   * Resolves to an actual RGB(A) value for any color type.
   */
  getTruecolor(theme?: TerminalTheme, foreground = true): ColorRgba {
    switch (this.type) {
      case ColorDepth.TRUECOLOR:
        return this.value!;
      case ColorDepth.EIGHT_BIT:
        // Slots 0–15 are the theme's own whatever depth names them, as `fixedValue` says.
        return this.number! < 16 ? resolveTerminal(theme, this.type).ansiColors.get(this.number!) : EIGHT_BIT_TABLE.get(this.number!);
      case ColorDepth.STANDARD:
      case ColorDepth.WINDOWS:
        return resolveTerminal(theme, this.type).ansiColors.get(this.number!);
      case ColorDepth.DEFAULT: {
        const t = resolveTerminal(theme, this.type);
        return foreground ? t.foregroundColor : t.backgroundColor;
      }
    }
  }

  // --- Static factories ---

  static default(): ColorSpec {
    return new ColorSpec("default", ColorDepth.DEFAULT);
  }

  static fromAnsi(n: number): ColorSpec {
    const type = n < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT;
    return new ColorSpec(`color(${n})`, type, n);
  }

  static fromRgba(value: ColorRgba): ColorSpec {
    return new ColorSpec(value.hex, ColorDepth.TRUECOLOR, undefined, value);
  }

  static fromRgb(r: number, g: number, b: number): ColorSpec {
    return ColorSpec.fromRgba(new ColorRgba(r, g, b));
  }

  /**
   * The colour `t` of the way from `from` to `to`: what `blend(from,to,t)`
   * parses to. Two fixed colours mix to a fixed colour. A mix reaching a
   * theme's own colour stays a mix until it is drawn, so whatever theme draws
   * an end draws the mix from it: exported under a theme whose `blue` is
   * #61afef, a mix with `blue` starts from #61afef. A terminal is told its RGB
   * under the standard table, the only one a render has.
   *
   * Each end is one opaque colour: `default` is no colour to mix, and a
   * translucent end has no one shade until it is laid on a ground.
   */
  static blend(from: ColorSpec, to: ColorSpec, t: number): ColorSpec {
    for (const end of [from, to]) {
      if (end.isDefault) throw new ColorParseError(`A blend cannot mix "default", which is no colour`);
      if (end.value !== undefined && end.value.alpha < 1) {
        throw new ColorParseError(`A blend's ends are opaque; "${end.name}" is translucent`);
      }
    }
    if (!(t >= 0 && t <= 1)) throw new ColorParseError(`A blend's fraction is in [0, 1]; got ${t}`);
    const a = from.fixedValue;
    const b = to.fixedValue;
    return a !== undefined && b !== undefined ? ColorSpec.fromRgba(blendRgb(a, b, t)) : new ColorBlend(from, to, t);
  }

  /**
   * The spec that draws `value` nearest to it at `depth` on a terminal known
   * to show `theme`, as the colour of the glyph (`foreground`) or of the
   * ground. Where `downgrade` knows no terminal, and so rounds only against
   * colours every terminal fixes (or, at sixteen colours, the stock
   * sixteen), this rounds against every colour the depth can write whose
   * look `theme` fixes: the default colour, the theme's sixteen, and at 256
   * colours the cube and grey ramp too. A colour read off any of those and
   * moved a little is drawn as the colour it came from — or, where the theme
   * gives two slots one colour, as the lower slot, which looks the same.
   *
   * `value` is opaque: a translucent colour has no one look until it is laid
   * on a ground (`flattenAlpha`).
   */
  static matchOn(value: ColorRgba, depth: ColorDepth, theme: TerminalTheme, foreground: boolean): ColorSpec {
    if (value.alpha < 1) throw new RangeError(`matchOn rounds an opaque colour; got alpha ${value.alpha}`);
    if (depth === ColorDepth.TRUECOLOR) return ColorSpec.fromRgba(value);
    if (depth === ColorDepth.DEFAULT) return ColorSpec.default();
    const slot = theme.ansiColors.match(value);
    // [LAW:dataflow-not-control-flow] Every candidate is scored; the depth
    // only decides whether the cube is among them. Ties go to the earlier.
    const candidates: [ColorSpec, ColorRgba][] = [
      [ColorSpec.default(), foreground ? theme.foregroundColor : theme.backgroundColor],
      [new ColorSpec(`color(${slot})`, depth === ColorDepth.WINDOWS ? depth : ColorDepth.STANDARD, slot), theme.ansiColors.get(slot)],
      ...(depth === ColorDepth.EIGHT_BIT ? [cubeCandidate(value)] : []),
    ];
    return candidates.reduce((best, next) => (rgbDistance(next[1], value) < rgbDistance(best[1], value) ? next : best))[0];
  }

  /**
   * Parse a color string. Memoized (`Memo`): a string parsed again while
   * remembered returns the same instance.
   */
  static parse(colorString: string): ColorSpec {
    return colorSpecParseMemo.get(colorString.toLowerCase().trim(), parseSingle);
  }

  // --- private ---

  private performDowngrade(targetSystem: ColorDepth): ColorSpec {
    // The colour as the terminal this depth assumes draws it: a blend's named
    // ends are the Windows console's own at WINDOWS.
    const triplet = this.getTruecolor(resolveTerminal(undefined, targetSystem));

    switch (targetSystem) {
      case ColorDepth.EIGHT_BIT:
        return ColorSpec.fromAnsi(downgradeTable(targetSystem).match(triplet));
      case ColorDepth.STANDARD:
      case ColorDepth.WINDOWS: {
        // An ANSI slot is already one of the sixteen either depth writes; only
        // a fixed colour is matched against the depth's table, as Rich does.
        const index = this.number !== undefined && this.number < 16 ? this.number : downgradeTable(targetSystem).match(triplet);
        return new ColorSpec(`color(${index})`, targetSystem, index);
      }
      case ColorDepth.TRUECOLOR:
        return this;
      case ColorDepth.DEFAULT:
        return ColorSpec.default();
    }
  }
}

/** The cube or grey-ramp entry nearest `value`, and its colour. */
function cubeCandidate(value: ColorRgba): [ColorSpec, ColorRgba] {
  const index = EIGHT_BIT_DOWNGRADE_TABLE.match(value);
  return [ColorSpec.fromAnsi(index), EIGHT_BIT_DOWNGRADE_TABLE.get(index)];
}

function mix(from: ColorSpec, to: ColorSpec, t: number, theme?: TerminalTheme): ColorRgba {
  return blendRgb(from.getTruecolor(theme), to.getTruecolor(theme), t);
}

// How a blend spells an end: by what it draws as, so every spelling of one
// colour ("blue", "color(4)", an EIGHT_BIT 4) gives the blend one name.
function blendTerm(end: ColorSpec): string {
  return end.fixedValue?.hex ?? (end.number !== undefined ? `color(${end.number})` : end.name);
}

/**
 * `ColorSpec.blend` with an end the theme draws. A terminal is told it as a
 * truecolor value, so it is one, and `value` is what it is told; a theme is
 * asked of its two ends instead. Its name is what `ColorSpec.parse` reads back.
 */
class ColorBlend extends ColorSpec {
  constructor(
    private readonly from: ColorSpec,
    private readonly to: ColorSpec,
    private readonly t: number,
  ) {
    super(`blend(${blendTerm(from)},${blendTerm(to)},${t})`, ColorDepth.TRUECOLOR, undefined, mix(from, to, t));
  }

  override get fixedValue(): undefined {
    return undefined;
  }

  override getTruecolor(theme?: TerminalTheme): ColorRgba {
    return mix(this.from, this.to, this.t, theme);
  }
}

// --- Parsing internals ---

const RGB_RE = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/;
const COLOR_NUMBER_RE = /^color\((\d+)\)$/;
const BLEND_RE = /^blend\((.*)\)$/;
// A decimal as `String(number)` spells one, exponent included; `blend` owns its range.
const FRACTION_RE = /^\s*(?:\d+(?:\.\d+)?|\.\d+)(?:e[+-]?\d+)?\s*$/;

function parseSingle(key: string): ColorSpec {
  if (key === "default" || key === "") {
    return ColorSpec.default();
  }

  // Named color
  const namedIndex = ANSI_COLOR_NAMES[key];
  if (namedIndex !== undefined) {
    const type = namedIndex < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT;
    return new ColorSpec(key, type, namedIndex);
  }

  if (key.startsWith("#")) {
    return new ColorSpec(key, ColorDepth.TRUECOLOR, undefined, parseHexColor(key));
  }

  // rgb()
  const rgbMatch = RGB_RE.exec(key);
  if (rgbMatch) {
    const r = parseByte(key, rgbMatch[1]!, "red");
    const g = parseByte(key, rgbMatch[2]!, "green");
    const b = parseByte(key, rgbMatch[3]!, "blue");
    return new ColorSpec(key, ColorDepth.TRUECOLOR, undefined, new ColorRgba(r, g, b));
  }

  // color(N)
  const numMatch = COLOR_NUMBER_RE.exec(key);
  if (numMatch) {
    const n = parseByte(key, numMatch[1]!, "number");
    const type = n < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT;
    return new ColorSpec(key, type, n);
  }

  // blend(a,b,t)
  const blendMatch = BLEND_RE.exec(key);
  if (blendMatch) {
    const terms = blendTerms(blendMatch[1]!);
    const fraction = terms[2] ?? "";
    if (terms.length !== 3 || !FRACTION_RE.test(fraction)) {
      throw new ColorParseError(`ColorSpec "${key}": a blend is blend(<color>,<color>,<fraction>)`);
    }
    return ColorSpec.blend(ColorSpec.parse(terms[0]!), ColorSpec.parse(terms[1]!), Number(fraction));
  }

  throw new ColorParseError(`Failed to parse color: "${key}"`);
}

// A blend's terms, split at the commas outside parentheses so an `rgb(…)` or a
// nested `blend(…)` stays one term.
function blendTerms(inner: string): string[] {
  const terms: string[] = [];
  let depth = 0;
  let start = 0;
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) {
      terms.push(inner.slice(start, i));
      start = i + 1;
    }
  }
  terms.push(inner.slice(start));
  return terms;
}

// [LAW:single-enforcer] The regexes admit any run of digits and leave the
// range to this check alone, so every out-of-range byte is a ColorParseError
// naming the field, never the generic parse failure or the constructor's RangeError.
function parseByte(key: string, digits: string, field: "red" | "green" | "blue" | "number"): number {
  const n = parseInt(digits, 10);
  if (!isByte(n)) {
    throw new ColorParseError(`ColorSpec "${key}": ${field} ${digits} is out of range (0-255)`);
  }
  return n;
}

// --- Utility functions ---

// [LAW:single-enforcer] The hex colour grammar, checked here and nowhere else:
// every string spelling a colour in hex — a ColorSpec, a theme's data, a colour
// reference, a template argument — becomes one through the three parsers below,
// and each is this check at the lengths it admits. Each digit pair is a byte, so
// the grammar holding is what keeps `ColorRgba`'s channels in range.
const HEX_DIGITS_RE = /^[0-9a-fA-F]+$/;

// Each admitted digit count, by the grammar it spells: the message a failure
// carries is read off the lengths a parser admits, so the two cannot disagree.
const HEX_GRAMMARS = { 6: "RRGGBB", 8: "RRGGBBAA" } as const;

function hexColor(input: string, lead: "" | "#", digits: string, lengths: readonly (keyof typeof HEX_GRAMMARS)[]): ColorRgba {
  if (!(lengths as readonly number[]).includes(digits.length) || !HEX_DIGITS_RE.test(digits)) {
    const expected = lengths.map((n) => lead + HEX_GRAMMARS[n]).join(" or ");
    throw new ColorParseError(`Invalid hex colour ${JSON.stringify(input)} (expected ${expected})`);
  }
  const byte = (at: number): number => parseInt(digits.slice(at, at + 2), 16);
  return new ColorRgba(byte(0), byte(2), byte(4), digits.length === 8 ? byte(6) / 255 : 1);
}

/** Six hex digits, no `#`, as an opaque colour. @throws {ColorParseError} on anything else. */
export function parseRgbHex(hex: string): ColorRgba {
  return hexColor(hex, "", hex, [6]);
}

/** Eight hex digits, no `#`, the last pair alpha. @throws {ColorParseError} on anything else. */
export function parseRgbaHex(hex: string): ColorRgba {
  return hexColor(hex, "", hex, [8]);
}

/**
 * A `#RRGGBB` or `#RRGGBBAA` literal, exactly — no surrounding whitespace.
 * @throws {ColorParseError} on anything else.
 */
export function parseHexColor(literal: string): ColorRgba {
  return hexColor(literal, "#", literal.startsWith("#") ? literal.slice(1) : "", [6, 8]);
}

export function blendRgb(
  color1: ColorRgba,
  color2: ColorRgba,
  crossFade = 0.5,
): ColorRgba {
  return new ColorRgba(
    Math.round(color1.red + (color2.red - color1.red) * crossFade),
    Math.round(color1.green + (color2.green - color1.green) * crossFade),
    Math.round(color1.blue + (color2.blue - color1.blue) * crossFade),
    color1.alpha + (color2.alpha - color1.alpha) * crossFade,
  );
}

// --- TerminalTheme ---

/**
 * A terminal theme — surface/foreground baseline, the sixteen ANSI colours,
 * and a semantic palette.
 *
 * **`ansiColors` is the theme's own sixteen colours**, the shades a terminal
 * showing this theme draws `red`, `blue` and the rest in. `ColorSpec.parse("red")`
 * is ANSI colour 1 under every theme; which red that is, is the theme's to say,
 * as it is in Rich, where each `TerminalTheme` carries its own table.
 */
export class TerminalTheme {
  constructor(
    readonly backgroundColor: ColorRgba,
    readonly foregroundColor: ColorRgba,
    readonly ansiColors: ColorTable,
    readonly palette: import("../themes/palette.js").Palette,
  ) {
    // [LAW:parse-dont-validate] Every reader indexes `ansiColors` 0–15 as the
    // terminal's sixteen, so a theme is the proof it holds exactly those.
    if (ansiColors.firstIndex !== 0 || ansiColors.size !== 16) {
      throw new RangeError(
        `a TerminalTheme's ansiColors are the sixteen ANSI colours, indices 0–15; got ${ansiColors.size} from index ${ansiColors.firstIndex}`,
      );
    }
  }
}

// --- ColorTable data ---

function buildStandard16(): ColorRgba[] {
  return [
    new ColorRgba(0, 0, 0),        // 0  black
    new ColorRgba(128, 0, 0),       // 1  red
    new ColorRgba(0, 128, 0),       // 2  green
    new ColorRgba(128, 128, 0),     // 3  yellow
    new ColorRgba(0, 0, 128),       // 4  blue
    new ColorRgba(128, 0, 128),     // 5  magenta
    new ColorRgba(0, 128, 128),     // 6  cyan
    new ColorRgba(192, 192, 192),   // 7  white
    new ColorRgba(128, 128, 128),   // 8  bright_black
    new ColorRgba(255, 0, 0),       // 9  bright_red
    new ColorRgba(0, 255, 0),       // 10 bright_green
    new ColorRgba(255, 255, 0),     // 11 bright_yellow
    new ColorRgba(0, 0, 255),       // 12 bright_blue
    new ColorRgba(255, 0, 255),     // 13 bright_magenta
    new ColorRgba(0, 255, 255),     // 14 bright_cyan
    new ColorRgba(255, 255, 255),   // 15 bright_white
  ];
}

function build256Table(): ColorRgba[] {
  const colors = buildStandard16();

  // 6x6x6 color cube (indices 16-231)
  const levels = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        colors.push(new ColorRgba(levels[r]!, levels[g]!, levels[b]!));
      }
    }
  }

  // Grayscale ramp (indices 232-255)
  for (let i = 0; i < 24; i++) {
    const grey = 8 + 10 * i;
    colors.push(new ColorRgba(grey, grey, grey));
  }

  return colors;
}

/**
 * The Windows console's own sixteen (its default Campbell scheme), in ANSI
 * index order: a WINDOWS colour is written as the same `30+n`/`90+n` SGR a
 * STANDARD one is, so slot `n` here is the colour the console draws for it.
 */
function buildWindowsTable(): ColorRgba[] {
  return [
    new ColorRgba(12, 12, 12),      // 0  black
    new ColorRgba(197, 15, 31),     // 1  red
    new ColorRgba(19, 161, 14),     // 2  green
    new ColorRgba(193, 156, 0),     // 3  yellow
    new ColorRgba(0, 55, 218),      // 4  blue
    new ColorRgba(136, 23, 152),    // 5  magenta
    new ColorRgba(58, 150, 221),    // 6  cyan
    new ColorRgba(204, 204, 204),   // 7  white
    new ColorRgba(118, 118, 118),   // 8  bright_black
    new ColorRgba(231, 72, 86),     // 9  bright_red
    new ColorRgba(22, 198, 12),     // 10 bright_green
    new ColorRgba(249, 241, 165),   // 11 bright_yellow
    new ColorRgba(59, 120, 255),    // 12 bright_blue
    new ColorRgba(180, 0, 158),     // 13 bright_magenta
    new ColorRgba(97, 214, 214),    // 14 bright_cyan
    new ColorRgba(242, 242, 242),   // 15 bright_white
  ];
}

export const STANDARD_TABLE = new ColorTable(buildStandard16());
export const EIGHT_BIT_TABLE = new ColorTable(build256Table());
/**
 * What a downgrade to 256 colours may choose: the cube and the grey ramp,
 * indices 16–255. Indices 0–15 are the terminal's own ANSI colours, which
 * every theme redefines, so their RGB is unknown and a match against them is
 * a guess; Python Rich never picks them either.
 */
export const EIGHT_BIT_DOWNGRADE_TABLE = new ColorTable(
  build256Table().slice(16),
  16,
);
export const WINDOWS_TABLE = new ColorTable(buildWindowsTable());

// --- Internal fallback theme ---
//
// [LAW:one-way-deps] Preset themes (DEFAULT_TERMINAL_THEME, MONOKAI, NORD, ...)
// live in `src/themes/terminalThemes.ts` because they need `buildPalette` from
// `themes/`. Keeping them out of `core/color.ts` makes the dependency strictly
// `themes/* -> core/color`, with no runtime back-edge.
//
// `getTruecolor()` retains a fallback for callers that omit `theme`: the
// terminal a colour's depth assumes, built from that depth's own sixteen with
// an empty Palette — sufficient for the lookups it serves, which never read
// `palette`.
//
// Runtime-importing `Palette` from `themes/palette.ts` is safe: that module
// only `import type`s from `core/color.ts`, so there is no runtime cycle.

import { Palette } from "../themes/palette.js";

const INTERNAL_DEFAULT_THEME = new TerminalTheme(
  new ColorRgba(0, 0, 0),
  new ColorRgba(255, 255, 255),
  STANDARD_TABLE,
  new Palette("default", true, new Map()),
);

/** The Windows console in its default Campbell scheme: a WINDOWS colour's terminal. */
const WINDOWS_CONSOLE_THEME = new TerminalTheme(
  WINDOWS_TABLE.get(0),
  WINDOWS_TABLE.get(7),
  WINDOWS_TABLE,
  new Palette("windows", true, new Map()),
);

/**
 * The terminal a colour at `depth` is drawn by: `theme`, or when a caller names
 * none, the one the depth assumes — the Windows console at WINDOWS, the VGA
 * sixteen otherwise — for `ColorSpec.getTruecolor` and the contrast measurement
 * that reads it. (Widgets fall back to `DEFAULT_TERMINAL_THEME`, which carries a
 * palette this does not.)
 */
export function resolveTerminal(theme: TerminalTheme | undefined, depth: ColorDepth): TerminalTheme {
  return theme ?? (depth === ColorDepth.WINDOWS ? WINDOWS_CONSOLE_THEME : INTERNAL_DEFAULT_THEME);
}

/**
 * The table a downgrade to `depth` rounds a fixed colour against.
 * [LAW:one-source-of-truth] `ColorSpec.downgrade` picks the index a colour is
 * written as from it, and colorMath hands back its entries as colours the
 * writer rounds to those same indices.
 */
export function downgradeTable(depth: ColorDepth.EIGHT_BIT | ColorDepth.STANDARD | ColorDepth.WINDOWS): ColorTable {
  switch (depth) {
    case ColorDepth.EIGHT_BIT:
      return EIGHT_BIT_DOWNGRADE_TABLE;
    case ColorDepth.STANDARD:
      return STANDARD_TABLE;
    case ColorDepth.WINDOWS:
      return WINDOWS_TABLE;
  }
}

// --- ANSI ColorSpec Names ---
// [LAW:one-source-of-truth] Single canonical mapping from name → palette index

/**
 * The table with every `greyNN` name repeated under the `grayNN` spelling.
 *
 * Rich accepts both spellings and the xterm palette only defines one, so the
 * aliases are part of what this table *is* rather than a patch applied to it.
 *
 * [LAW:no-ambient-temporal-coupling] Which is why they arrive as an initializer
 * and not as the loop that used to mutate the finished map: that loop made "has
 * the aliases yet" a fact about module evaluation order, so the table had two
 * shapes and nothing in its type said which one you were holding. It also made
 * this module do work at import time, which is the claim `package.json`'s
 * `sideEffects: false` makes on its behalf — see
 * `test/seam/import-time-effects.ts`.
 */
function withGrayAliases(names: Record<string, number>): Record<string, number> {
  const aliases = Object.entries(names)
    .filter(([name]) => name.includes("grey"))
    .map(([name, index]) => [name.replace("grey", "gray"), index] as const);
  return { ...names, ...Object.fromEntries(aliases) };
}

export const ANSI_COLOR_NAMES: Record<string, number> = withGrayAliases({
  // Standard 16
  black: 0,
  red: 1,
  green: 2,
  yellow: 3,
  blue: 4,
  magenta: 5,
  cyan: 6,
  white: 7,
  bright_black: 8,
  bright_red: 9,
  bright_green: 10,
  bright_yellow: 11,
  bright_blue: 12,
  bright_magenta: 13,
  bright_cyan: 14,
  bright_white: 15,

  // 6x6x6 color cube (16-231)
  grey0: 16,
  navy_blue: 17,
  dark_blue: 18,
  blue3: 19,
  blue2: 20,
  blue1: 21,
  dark_green: 22,
  deep_sky_blue4: 23,
  deep_sky_blue5: 24,
  deep_sky_blue6: 25,
  dodger_blue3: 26,
  dodger_blue2: 27,
  green4: 28,
  spring_green4: 29,
  turquoise4: 30,
  deep_sky_blue3: 31,
  deep_sky_blue7: 32,
  dodger_blue1: 33,
  green3: 34,
  spring_green3: 35,
  dark_cyan: 36,
  light_sea_green: 37,
  deep_sky_blue2: 38,
  deep_sky_blue1: 39,
  green5: 40,
  spring_green5: 41,
  spring_green2: 42,
  cyan3: 43,
  dark_turquoise: 44,
  turquoise2: 45,
  green1: 46,
  spring_green6: 47,
  spring_green1: 48,
  medium_spring_green: 49,
  cyan2: 50,
  cyan1: 51,
  dark_red: 52,
  deep_pink4: 53,
  purple4: 54,
  purple5: 55,
  purple3: 56,
  blue_violet: 57,
  orange4: 58,
  grey37: 59,
  medium_purple4: 60,
  slate_blue3: 61,
  slate_blue4: 62,
  royal_blue1: 63,
  chartreuse4: 64,
  dark_sea_green4: 65,
  pale_turquoise4: 66,
  steel_blue: 67,
  steel_blue3: 68,
  cornflower_blue: 69,
  chartreuse3: 70,
  dark_sea_green5: 71,
  cadet_blue: 72,
  cadet_blue2: 73,
  sky_blue3: 74,
  steel_blue1: 75,
  chartreuse5: 76,
  pale_green3: 77,
  sea_green3: 78,
  aquamarine3: 79,
  medium_turquoise: 80,
  steel_blue2: 81,
  chartreuse2: 82,
  sea_green2: 83,
  sea_green1: 84,
  sea_green4: 85,
  aquamarine1: 86,
  dark_slate_gray2: 87,
  dark_red2: 88,
  deep_pink5: 89,
  dark_magenta: 90,
  dark_magenta2: 91,
  dark_violet: 92,
  purple2: 93,
  orange5: 94,
  light_pink4: 95,
  plum4: 96,
  medium_purple3: 97,
  medium_purple5: 98,
  slate_blue1: 99,
  yellow4: 100,
  wheat4: 101,
  grey53: 102,
  light_slate_grey: 103,
  medium_purple: 104,
  light_slate_blue: 105,
  yellow5: 106,
  dark_olive_green3: 107,
  dark_sea_green: 108,
  light_sky_blue3: 109,
  light_sky_blue4: 110,
  sky_blue2: 111,
  chartreuse6: 112,
  dark_olive_green4: 113,
  pale_green4: 114,
  dark_sea_green3: 115,
  dark_slate_gray3: 116,
  sky_blue1: 117,
  chartreuse1: 118,
  light_green: 119,
  light_green2: 120,
  pale_green1: 121,
  aquamarine2: 122,
  dark_slate_gray1: 123,
  red3: 124,
  deep_pink6: 125,
  medium_violet_red: 126,
  magenta3: 127,
  dark_violet2: 128,
  purple: 129,
  dark_orange3: 130,
  indian_red: 131,
  hot_pink3: 132,
  medium_orchid3: 133,
  medium_orchid: 134,
  medium_purple2: 135,
  dark_goldenrod: 136,
  light_salmon3: 137,
  rosy_brown: 138,
  grey63: 139,
  medium_purple6: 140,
  medium_purple1: 141,
  gold3: 142,
  dark_khaki: 143,
  navajo_white3: 144,
  grey69: 145,
  light_steel_blue3: 146,
  light_steel_blue: 147,
  yellow3: 148,
  dark_olive_green5: 149,
  dark_sea_green6: 150,
  dark_sea_green2: 151,
  light_cyan3: 152,
  light_sky_blue1: 153,
  green_yellow: 154,
  dark_olive_green2: 155,
  pale_green2: 156,
  dark_sea_green7: 157,
  dark_sea_green1: 158,
  pale_turquoise1: 159,
  red4: 160,
  deep_pink3: 161,
  deep_pink8: 162,
  magenta4: 163,
  magenta5: 164,
  magenta2: 165,
  dark_orange4: 166,
  indian_red2: 167,
  hot_pink4: 168,
  hot_pink2: 169,
  orchid: 170,
  medium_orchid1: 171,
  orange3: 172,
  light_salmon4: 173,
  light_pink3: 174,
  pink3: 175,
  plum3: 176,
  violet: 177,
  gold4: 178,
  light_goldenrod3: 179,
  tan: 180,
  misty_rose3: 181,
  thistle3: 182,
  plum2: 183,
  yellow6: 184,
  khaki3: 185,
  light_goldenrod2: 186,
  light_yellow3: 187,
  grey84: 188,
  light_steel_blue1: 189,
  yellow2: 190,
  dark_olive_green1: 191,
  dark_olive_green6: 192,
  dark_sea_green8: 193,
  honeydew2: 194,
  light_cyan1: 195,
  red1: 196,
  deep_pink2: 197,
  deep_pink1: 198,
  deep_pink9: 199,
  magenta6: 200,
  magenta1: 201,
  orange_red1: 202,
  indian_red1: 203,
  indian_red3: 204,
  hot_pink5: 205,
  hot_pink: 206,
  medium_orchid2: 207,
  dark_orange: 208,
  salmon1: 209,
  light_coral: 210,
  pale_violet_red1: 211,
  orchid2: 212,
  orchid1: 213,
  orange1: 214,
  sandy_brown: 215,
  light_salmon1: 216,
  light_pink1: 217,
  pink1: 218,
  plum1: 219,
  gold1: 220,
  light_goldenrod4: 221,
  light_goldenrod5: 222,
  navajo_white1: 223,
  misty_rose1: 224,
  thistle1: 225,
  yellow1: 226,
  light_goldenrod1: 227,
  khaki1: 228,
  wheat1: 229,
  cornsilk1: 230,
  grey100: 231,

  // Grayscale ramp (232-255)
  grey3: 232,
  grey7: 233,
  grey11: 234,
  grey15: 235,
  grey19: 236,
  grey23: 237,
  grey27: 238,
  grey30: 239,
  grey35: 240,
  grey39: 241,
  grey42: 242,
  grey46: 243,
  grey50: 244,
  grey54: 245,
  grey58: 246,
  grey62: 247,
  grey66: 248,
  grey70: 249,
  grey74: 250,
  grey78: 251,
  grey82: 252,
  grey85: 253,
  grey89: 254,
  grey93: 255,
});

/**
 * Every word `ColorSpec.parse` accepts as a name rather than a `#hex`,
 * `rgb()` or `color(N)` form: `default` and the named palette entries, which
 * are exactly the two name checks `parseSingle` makes.
 */
export const COLOR_NAMES: readonly string[] = ["default", ...Object.keys(ANSI_COLOR_NAMES)];
