/**
 * Terminal color representation, parsing, downgrading, and ANSI code generation.
 */

// --- ColorRgba ---

function hex2(byte: number): string {
  return byte.toString(16).padStart(2, "0");
}

function assertChannel(name: string, v: number): void {
  if (!Number.isInteger(v) || v < 0 || v > 255) {
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

// --- ColorTable ---

export class ColorTable {
  private readonly colors: ColorRgba[];
  private readonly matchCache = new Map<string, number>();

  constructor(colors: ColorRgba[]) {
    this.colors = colors;
  }

  get(index: number): ColorRgba {
    return this.colors[index]!;
  }

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
      const dr = c.red - value.red;
      const dg = c.green - value.green;
      const db = c.blue - value.blue;
      const dist = dr * dr + dg * dg + db * db;
      if (dist < bestDist) {
        bestDist = dist;
        bestIndex = i;
      }
    }
    this.matchCache.set(key, bestIndex);
    return bestIndex;
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
  env?: NodeJS.ProcessEnv;
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
  const env = options.env ?? (typeof process !== "undefined" ? process.env : {});
  const isTTY =
    options.isTTY ??
    (typeof process !== "undefined" ? (process.stdout?.isTTY ?? false) : false);

  // NO_COLOR: any non-empty value disables color.
  const noColor = env["NO_COLOR"];
  if (noColor !== undefined && noColor !== "") return null;

  // FORCE_COLOR: explicit override, wins over TTY/TERM detection.
  const force = env["FORCE_COLOR"];
  if (force !== undefined && force !== "") {
    const mapped = STRING_TO_DEPTH[force];
    return mapped !== undefined ? mapped : ColorDepth.STANDARD;
  }

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
        return EIGHT_BIT_TABLE.get(this.number!);
      case ColorDepth.STANDARD: {
        const t = theme ?? DEFAULT_TERMINAL_THEME;
        return t.ansiColors.get(this.number!);
      }
      case ColorDepth.DEFAULT: {
        const t = theme ?? DEFAULT_TERMINAL_THEME;
        return foreground ? t.foregroundColor : t.backgroundColor;
      }
      case ColorDepth.WINDOWS: {
        const t = theme ?? DEFAULT_TERMINAL_THEME;
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
        const index = EIGHT_BIT_TABLE.match(triplet);
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

// --- Parsing internals ---

const HEX_RE = /^#([0-9a-f]{6})$/;
const HEX_RGBA_RE = /^#([0-9a-f]{8})$/;
const RGB_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
const COLOR_NUMBER_RE = /^color\((\d{1,3})\)$/;

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
    const r = parseInt(rgbMatch[1]!, 10);
    const g = parseInt(rgbMatch[2]!, 10);
    const b = parseInt(rgbMatch[3]!, 10);
    return new ColorSpec(key, ColorDepth.TRUECOLOR, undefined, new ColorRgba(r, g, b));
  }

  // color(N)
  const numMatch = COLOR_NUMBER_RE.exec(key);
  if (numMatch) {
    const n = parseInt(numMatch[1]!, 10);
    if (n > 255) {
      throw new ColorParseError(`ColorSpec number ${n} is out of range (0-255)`);
    }
    const type = n < 16 ? ColorDepth.STANDARD : ColorDepth.EIGHT_BIT;
    return new ColorSpec(key, type, n);
  }

  throw new ColorParseError(`Failed to parse color: "${key}"`);
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
export const WINDOWS_TABLE = new ColorTable(buildWindowsTable());

// --- Pre-built themes ---

import { buildPalette } from "../themes/buildPalette.js";

const DEFAULT_PALETTE = buildPalette("default", true, {
  primary: new ColorRgba(0, 111, 184),
  secondary: new ColorRgba(118, 38, 113),
  accent: new ColorRgba(0, 111, 184),
  success: new ColorRgba(0, 128, 0),
  warning: new ColorRgba(128, 128, 0),
  error: new ColorRgba(128, 0, 0),
  background: new ColorRgba(0, 0, 0),
  foreground: new ColorRgba(255, 255, 255),
});

export const DEFAULT_TERMINAL_THEME = new TerminalTheme(
  new ColorRgba(0, 0, 0),
  new ColorRgba(255, 255, 255),
  STANDARD_TABLE,
  DEFAULT_PALETTE,
);

export const MONOKAI = new TerminalTheme(
  new ColorRgba(39, 40, 34),
  new ColorRgba(214, 214, 214),
  STANDARD_TABLE,
  buildPalette("monokai", true, {
    primary: new ColorRgba(174, 129, 255),
    secondary: new ColorRgba(249, 38, 114),
    accent: new ColorRgba(102, 217, 239),
    success: new ColorRgba(166, 226, 46),
    warning: new ColorRgba(253, 151, 31),
    error: new ColorRgba(249, 38, 114),
    background: new ColorRgba(39, 40, 34),
    foreground: new ColorRgba(214, 214, 214),
  }),
);

export const SVG_EXPORT_THEME = new TerminalTheme(
  new ColorRgba(41, 41, 41),
  new ColorRgba(197, 200, 198),
  STANDARD_TABLE,
  buildPalette("svg-export", true, {
    primary: new ColorRgba(97, 175, 239),
    secondary: new ColorRgba(198, 120, 221),
    accent: new ColorRgba(86, 182, 194),
    success: new ColorRgba(152, 195, 121),
    warning: new ColorRgba(229, 192, 123),
    error: new ColorRgba(204, 85, 90),
    background: new ColorRgba(41, 41, 41),
    foreground: new ColorRgba(197, 200, 198),
  }),
);

export const NORD = new TerminalTheme(
  new ColorRgba(46, 52, 64),
  new ColorRgba(216, 222, 233),
  STANDARD_TABLE,
  buildPalette("nord", true, {
    primary: new ColorRgba(136, 192, 208),
    secondary: new ColorRgba(129, 161, 193),
    accent: new ColorRgba(180, 142, 173),
    success: new ColorRgba(163, 190, 140),
    warning: new ColorRgba(235, 203, 139),
    error: new ColorRgba(191, 97, 106),
    background: new ColorRgba(46, 52, 64),
    foreground: new ColorRgba(216, 222, 233),
  }),
);

export const GRUVBOX = new TerminalTheme(
  new ColorRgba(40, 40, 40),
  new ColorRgba(251, 241, 199),
  STANDARD_TABLE,
  buildPalette("gruvbox", true, {
    primary: new ColorRgba(133, 165, 152),
    secondary: new ColorRgba(168, 154, 133),
    accent: new ColorRgba(250, 189, 47),
    success: new ColorRgba(184, 187, 38),
    warning: new ColorRgba(254, 128, 25),
    error: new ColorRgba(251, 73, 52),
    background: new ColorRgba(40, 40, 40),
    foreground: new ColorRgba(251, 241, 199),
  }),
);

export const DRACULA = new TerminalTheme(
  new ColorRgba(40, 42, 54),
  new ColorRgba(248, 248, 242),
  STANDARD_TABLE,
  buildPalette("dracula", true, {
    primary: new ColorRgba(189, 147, 249),
    secondary: new ColorRgba(98, 114, 164),
    accent: new ColorRgba(255, 121, 198),
    success: new ColorRgba(80, 250, 123),
    warning: new ColorRgba(255, 184, 108),
    error: new ColorRgba(255, 85, 85),
    background: new ColorRgba(40, 42, 54),
    foreground: new ColorRgba(248, 248, 242),
  }),
);

export const TOKYO_NIGHT = new TerminalTheme(
  new ColorRgba(26, 27, 38),
  new ColorRgba(169, 177, 214),
  STANDARD_TABLE,
  buildPalette("tokyo-night", true, {
    primary: new ColorRgba(187, 154, 247),
    secondary: new ColorRgba(122, 162, 247),
    accent: new ColorRgba(255, 158, 100),
    success: new ColorRgba(158, 206, 106),
    warning: new ColorRgba(224, 175, 104),
    error: new ColorRgba(247, 118, 142),
    background: new ColorRgba(26, 27, 38),
    foreground: new ColorRgba(169, 177, 214),
  }),
);

export const FLEXOKI = new TerminalTheme(
  new ColorRgba(16, 15, 15),
  new ColorRgba(255, 252, 240),
  STANDARD_TABLE,
  buildPalette("flexoki", true, {
    primary: new ColorRgba(32, 94, 166),
    secondary: new ColorRgba(36, 131, 123),
    accent: new ColorRgba(155, 118, 200),
    success: new ColorRgba(102, 128, 11),
    warning: new ColorRgba(173, 131, 1),
    error: new ColorRgba(175, 48, 41),
    background: new ColorRgba(16, 15, 15),
    foreground: new ColorRgba(255, 252, 240),
  }),
);

export const CATPPUCCIN_MOCHA = new TerminalTheme(
  new ColorRgba(24, 24, 37),
  new ColorRgba(205, 214, 244),
  STANDARD_TABLE,
  buildPalette("catppuccin-mocha", true, {
    primary: new ColorRgba(245, 194, 231),
    secondary: new ColorRgba(203, 166, 247),
    accent: new ColorRgba(250, 179, 135),
    success: new ColorRgba(171, 233, 179),
    warning: new ColorRgba(250, 227, 176),
    error: new ColorRgba(242, 143, 173),
    background: new ColorRgba(24, 24, 37),
    foreground: new ColorRgba(205, 214, 244),
  }),
);

export const CATPPUCCIN_LATTE = new TerminalTheme(
  new ColorRgba(239, 241, 245),
  new ColorRgba(76, 79, 105),
  STANDARD_TABLE,
  buildPalette("catppuccin-latte", false, {
    primary: new ColorRgba(136, 57, 239),
    secondary: new ColorRgba(220, 138, 120),
    accent: new ColorRgba(254, 100, 11),
    success: new ColorRgba(64, 160, 43),
    warning: new ColorRgba(223, 142, 29),
    error: new ColorRgba(210, 15, 57),
    background: new ColorRgba(239, 241, 245),
    foreground: new ColorRgba(76, 79, 105),
  }),
);

export const CATPPUCCIN_FRAPPE = new TerminalTheme(
  new ColorRgba(48, 52, 70),
  new ColorRgba(198, 208, 245),
  STANDARD_TABLE,
  buildPalette("catppuccin-frappe", true, {
    primary: new ColorRgba(202, 158, 230),
    secondary: new ColorRgba(239, 159, 118),
    accent: new ColorRgba(244, 184, 228),
    success: new ColorRgba(166, 209, 137),
    warning: new ColorRgba(229, 200, 144),
    error: new ColorRgba(231, 130, 132),
    background: new ColorRgba(48, 52, 70),
    foreground: new ColorRgba(198, 208, 245),
  }),
);

export const CATPPUCCIN_MACCHIATO = new TerminalTheme(
  new ColorRgba(36, 39, 58),
  new ColorRgba(202, 211, 245),
  STANDARD_TABLE,
  buildPalette("catppuccin-macchiato", true, {
    primary: new ColorRgba(198, 160, 246),
    secondary: new ColorRgba(245, 169, 127),
    accent: new ColorRgba(245, 189, 230),
    success: new ColorRgba(166, 218, 149),
    warning: new ColorRgba(238, 212, 159),
    error: new ColorRgba(237, 135, 150),
    background: new ColorRgba(36, 39, 58),
    foreground: new ColorRgba(202, 211, 245),
  }),
);

export const SOLARIZED_DARK = new TerminalTheme(
  new ColorRgba(0, 43, 54),
  new ColorRgba(131, 148, 150),
  STANDARD_TABLE,
  buildPalette("solarized-dark", true, {
    primary: new ColorRgba(38, 139, 210),
    secondary: new ColorRgba(42, 161, 152),
    accent: new ColorRgba(108, 113, 196),
    success: new ColorRgba(133, 153, 0),
    warning: new ColorRgba(203, 75, 22),
    error: new ColorRgba(220, 50, 47),
    background: new ColorRgba(0, 43, 54),
    foreground: new ColorRgba(131, 148, 150),
  }),
);

export const SOLARIZED_LIGHT = new TerminalTheme(
  new ColorRgba(253, 246, 227),
  new ColorRgba(88, 110, 117),
  STANDARD_TABLE,
  buildPalette("solarized-light", false, {
    primary: new ColorRgba(38, 139, 210),
    secondary: new ColorRgba(42, 161, 152),
    accent: new ColorRgba(108, 113, 196),
    success: new ColorRgba(133, 153, 0),
    warning: new ColorRgba(203, 75, 22),
    error: new ColorRgba(220, 50, 47),
    background: new ColorRgba(253, 246, 227),
    foreground: new ColorRgba(88, 110, 117),
  }),
);

export const ROSE_PINE = new TerminalTheme(
  new ColorRgba(25, 23, 36),
  new ColorRgba(224, 222, 244),
  STANDARD_TABLE,
  buildPalette("rose-pine", true, {
    primary: new ColorRgba(196, 167, 231),
    secondary: new ColorRgba(49, 116, 143),
    accent: new ColorRgba(235, 188, 186),
    success: new ColorRgba(156, 207, 216),
    warning: new ColorRgba(246, 193, 119),
    error: new ColorRgba(235, 111, 146),
    background: new ColorRgba(25, 23, 36),
    foreground: new ColorRgba(224, 222, 244),
  }),
);

export const ROSE_PINE_MOON = new TerminalTheme(
  new ColorRgba(35, 33, 54),
  new ColorRgba(224, 222, 244),
  STANDARD_TABLE,
  buildPalette("rose-pine-moon", true, {
    primary: new ColorRgba(196, 167, 231),
    secondary: new ColorRgba(62, 143, 176),
    accent: new ColorRgba(234, 154, 151),
    success: new ColorRgba(156, 207, 216),
    warning: new ColorRgba(246, 193, 119),
    error: new ColorRgba(235, 111, 146),
    background: new ColorRgba(35, 33, 54),
    foreground: new ColorRgba(224, 222, 244),
  }),
);

export const ROSE_PINE_DAWN = new TerminalTheme(
  new ColorRgba(250, 244, 237),
  new ColorRgba(87, 82, 121),
  STANDARD_TABLE,
  buildPalette("rose-pine-dawn", false, {
    primary: new ColorRgba(144, 122, 169),
    secondary: new ColorRgba(40, 105, 131),
    accent: new ColorRgba(215, 130, 126),
    success: new ColorRgba(86, 148, 159),
    warning: new ColorRgba(234, 157, 52),
    error: new ColorRgba(180, 99, 122),
    background: new ColorRgba(250, 244, 237),
    foreground: new ColorRgba(87, 82, 121),
  }),
);

export const ATOM_ONE_DARK = new TerminalTheme(
  new ColorRgba(40, 44, 52),
  new ColorRgba(171, 178, 191),
  STANDARD_TABLE,
  buildPalette("atom-one-dark", true, {
    primary: new ColorRgba(97, 175, 239),
    secondary: new ColorRgba(198, 120, 221),
    accent: new ColorRgba(163, 120, 194),
    success: new ColorRgba(98, 240, 98),
    warning: new ColorRgba(222, 178, 91),
    error: new ColorRgba(240, 98, 98),
    background: new ColorRgba(40, 44, 52),
    foreground: new ColorRgba(171, 178, 191),
  }),
);

export const ATOM_ONE_LIGHT = new TerminalTheme(
  new ColorRgba(250, 250, 250),
  new ColorRgba(56, 58, 66),
  STANDARD_TABLE,
  buildPalette("atom-one-light", false, {
    primary: new ColorRgba(64, 120, 242),
    secondary: new ColorRgba(166, 38, 164),
    accent: new ColorRgba(191, 146, 50),
    success: new ColorRgba(108, 242, 63),
    warning: new ColorRgba(216, 217, 56),
    error: new ColorRgba(242, 63, 63),
    background: new ColorRgba(250, 250, 250),
    foreground: new ColorRgba(56, 58, 66),
  }),
);

// --- ANSI ColorSpec Names ---
// [LAW:one-source-of-truth] Single canonical mapping from name → palette index

export const ANSI_COLOR_NAMES: Record<string, number> = {
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
};

// Add gray→grey aliases
for (const [name, index] of Object.entries(ANSI_COLOR_NAMES)) {
  if (name.includes("grey")) {
    ANSI_COLOR_NAMES[name.replace("grey", "gray")] = index;
  }
}
