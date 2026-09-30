/**
 * Terminal color representation, parsing, downgrading, and ANSI code generation.
 */

import type { Env } from "./env.js";

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

/**
 * An indexed palette: entry `i` of `colors` is terminal index `firstIndex + i`.
 * `firstIndex` lets a table hold only the part of a palette a downgrade may
 * choose (the 256-colour cube and grey ramp start at 16) while every index it
 * reports is the terminal's own.
 */
// [LAW:single-enforcer] The one size policy for ColorTable's memos: a key is
// derived from colours a long-running host computes without end (ramp stops,
// mixes), so an unbounded map grows with every render. Clearing at the cap is
// the policy `cellLen` already uses; a refill costs one table scan per key.
const TABLE_CACHE_MAX = 4096;

function remember(cache: Map<string, number>, key: string, index: number): number {
  if (cache.size >= TABLE_CACHE_MAX) cache.clear();
  cache.set(key, index);
  return index;
}

// [LAW:one-source-of-truth] The one distance every table scan ranks by, so
// `matchWhere`'s "nearest by the distance `match` uses" cannot drift.
function rgbDistance(a: ColorRgba, b: ColorRgba): number {
  const dr = a.red - b.red;
  const dg = a.green - b.green;
  const db = a.blue - b.blue;
  return dr * dr + dg * dg + db * db;
}

export class ColorTable {
  private readonly colors: ColorRgba[];
  private readonly firstIndex: number;
  private readonly matchCache = new Map<string, number>();
  private readonly readableCache = new Map<string, number>();

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
    const cached = this.matchCache.get(key);
    if (cached !== undefined) return cached;

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
    return remember(this.matchCache, key, this.firstIndex + bestIndex);
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
    const cached = this.readableCache.get(key);
    if (cached !== undefined) return cached;

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
    return remember(this.readableCache, key, this.firstIndex + best);
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

// --- ColorDepth resolution ---

export interface DetectColorOptions {
  /** Environment to probe. Defaults to `process.env`. */
  env?: Env;
  /** Whether output is going to a real terminal. Defaults to `process.stdout?.isTTY`. */
  isTTY?: boolean;
}

// [LAW:one-source-of-truth] One table covers every recognized string form
// that resolves to a ColorDepth: user-facing CLI/config specs, FORCE_COLOR
// values (the chalk/supports-color convention), TERM_PROGRAM identifiers,
// and exact TERM names whose color capability is known. Keys are disjoint
// across these sources, so one table is honest. `null` means "no color".
// "auto" is intentionally absent — it routes to env detection.
const STRING_TO_DEPTH: Record<string, ColorDepth | null> = {
  // CLI/config specs
  truecolor: ColorDepth.TRUECOLOR,
  "256": ColorDepth.EIGHT_BIT,
  ansi: ColorDepth.STANDARD,
  none: null,

  // FORCE_COLOR values
  "0": null,
  false: null,
  "1": ColorDepth.STANDARD,
  true: ColorDepth.STANDARD,
  "2": ColorDepth.EIGHT_BIT,
  "3": ColorDepth.TRUECOLOR,

  // TERM_PROGRAM identifiers
  "iTerm.app": ColorDepth.TRUECOLOR,
  Apple_Terminal: ColorDepth.EIGHT_BIT,
  vscode: ColorDepth.TRUECOLOR,
  Tabby: ColorDepth.TRUECOLOR,

  // Known truecolor TERM names
  "xterm-kitty": ColorDepth.TRUECOLOR,
  "xterm-ghostty": ColorDepth.TRUECOLOR,
  wezterm: ColorDepth.TRUECOLOR,
  alacritty: ColorDepth.TRUECOLOR,
  foot: ColorDepth.TRUECOLOR,
  contour: ColorDepth.TRUECOLOR,
};

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
  const mapped = STRING_TO_DEPTH[force];
  return mapped !== undefined ? mapped : ColorDepth.STANDARD;
}

function envOf(options: DetectColorOptions): Env {
  return options.env ?? (typeof process !== "undefined" ? process.env : {});
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

  const term = env["TERM"] ?? "";
  if (term === "dumb" || term === "unknown") return null;

  const colorterm = env["COLORTERM"];
  if (colorterm === "truecolor" || colorterm === "24bit") {
    return ColorDepth.TRUECOLOR;
  }

  const termDepth = STRING_TO_DEPTH[term];
  if (termDepth !== undefined) return termDepth;

  const termProgram = env["TERM_PROGRAM"];
  if (termProgram !== undefined) {
    const mapped = STRING_TO_DEPTH[termProgram];
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
  spec: string | ColorDepth | null,
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
 * Resolve a string spec into a `ColorDepth` (or `null` for no color).
 *
 * `"auto"` triggers env-based detection; all other recognized specs are
 * direct table lookups against `STRING_TO_DEPTH`. Throws on unknown specs
 * — silent fallback would mask user typos.
 *
 * [LAW:single-enforcer] All string→ColorDepth resolution flows through here.
 */
export function resolveColorSystem(
  spec: string,
  options?: DetectColorOptions,
): ColorDepth | null {
  if (spec === "auto") return detectColorSystem(options);
  if (Object.hasOwn(STRING_TO_DEPTH, spec)) return STRING_TO_DEPTH[spec]!;
  throw new ColorParseError(
    `Unknown color depth spec: ${JSON.stringify(spec)} (expected "auto", "truecolor", "256", "ansi", or "none")`,
  );
}

// --- ColorSpec ---

export class ColorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ColorParseError";
  }
}

// [LAW:one-source-of-truth] Parse cache is the single source for parsed ColorSpec instances
const parseCache = new Map<string, ColorSpec>();

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
    if (this.type <= targetSystem) return this;

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
        return this.number! < 16 ? (theme ?? INTERNAL_DEFAULT_THEME).ansiColors.get(this.number!) : EIGHT_BIT_TABLE.get(this.number!);
      case ColorDepth.STANDARD: {
        const t = theme ?? INTERNAL_DEFAULT_THEME;
        return t.ansiColors.get(this.number!);
      }
      case ColorDepth.DEFAULT: {
        const t = theme ?? INTERNAL_DEFAULT_THEME;
        return foreground ? t.foregroundColor : t.backgroundColor;
      }
      case ColorDepth.WINDOWS: {
        const t = theme ?? INTERNAL_DEFAULT_THEME;
        return t.ansiColors.get(this.number!);
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
   * Parse a color string. Cached — identical strings return the same instance.
   */
  static parse(colorString: string): ColorSpec {
    const key = colorString.toLowerCase().trim();
    const cached = parseCache.get(key);
    if (cached) return cached;

    const result = parseSingle(key);
    parseCache.set(key, result);
    return result;
  }

  // --- private ---

  private performDowngrade(targetSystem: ColorDepth): ColorSpec {
    // Get the true RGB of this color
    const triplet = this.getTruecolor();

    switch (targetSystem) {
      case ColorDepth.EIGHT_BIT: {
        const index = EIGHT_BIT_DOWNGRADE_TABLE.match(triplet);
        return ColorSpec.fromAnsi(index);
      }
      case ColorDepth.STANDARD: {
        const index = STANDARD_TABLE.match(triplet);
        return new ColorSpec(
          `color(${index})`,
          ColorDepth.STANDARD,
          index,
        );
      }
      // WINDOWS is a detection result (max enum value), not a downgrade target.
      // The `this.type <= targetSystem` guard in downgrade() always short-circuits
      // before reaching this method with WINDOWS, so this case is unreachable.
      case ColorDepth.WINDOWS:
      case ColorDepth.TRUECOLOR:
        return this;
      case ColorDepth.DEFAULT:
        return ColorSpec.default();
    }
  }
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

const HEX_RE = /^#([0-9a-f]{6})$/;
const HEX_RGBA_RE = /^#([0-9a-f]{8})$/;
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

  // Hex (8-char with alpha takes precedence over 6-char to avoid the 6-char
  // regex matching a prefix of an 8-char string).
  const hexRgbaMatch = HEX_RGBA_RE.exec(key);
  if (hexRgbaMatch) {
    return new ColorSpec(key, ColorDepth.TRUECOLOR, undefined, parseRgbaHex(hexRgbaMatch[1]!));
  }
  const hexMatch = HEX_RE.exec(key);
  if (hexMatch) {
    return new ColorSpec(key, ColorDepth.TRUECOLOR, undefined, parseRgbHex(hexMatch[1]!));
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

export function parseRgbHex(hex: string): ColorRgba {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return new ColorRgba(r, g, b);
}

export function parseRgbaHex(hex: string): ColorRgba {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  const a = parseInt(hex.slice(6, 8), 16) / 255;
  return new ColorRgba(r, g, b, a);
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
 * A terminal theme — surface/foreground baseline, the ANSI 16/256 LUT, and a
 * semantic palette.
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
  ) {}
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

function buildWindowsTable(): ColorRgba[] {
  return [
    new ColorRgba(0, 0, 0),        // 0
    new ColorRgba(0, 0, 128),       // 1
    new ColorRgba(0, 128, 0),       // 2
    new ColorRgba(0, 128, 128),     // 3
    new ColorRgba(128, 0, 0),       // 4
    new ColorRgba(128, 0, 128),     // 5
    new ColorRgba(128, 128, 0),     // 6
    new ColorRgba(192, 192, 192),   // 7
    new ColorRgba(128, 128, 128),   // 8
    new ColorRgba(0, 0, 255),       // 9
    new ColorRgba(0, 255, 0),       // 10
    new ColorRgba(0, 255, 255),     // 11
    new ColorRgba(255, 0, 0),       // 12
    new ColorRgba(255, 0, 255),     // 13
    new ColorRgba(255, 255, 0),     // 14
    new ColorRgba(255, 255, 255),   // 15
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
// `getTruecolor()` retains a fallback for callers that omit `theme`. The
// fallback uses STANDARD_TABLE + black/white + an empty Palette — sufficient
// for STANDARD/DEFAULT/WINDOWS lookups, which never read `palette`.
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
