/**
 * Terminal color representation, parsing, downgrading, and ANSI code generation.
 */

// --- ColorTriplet ---

export class ColorTriplet {
  constructor(
    readonly red: number,
    readonly green: number,
    readonly blue: number,
  ) {}

  get hex(): string {
    return (
      "#" +
      this.red.toString(16).padStart(2, "0") +
      this.green.toString(16).padStart(2, "0") +
      this.blue.toString(16).padStart(2, "0")
    );
  }

  get rgb(): string {
    return `rgb(${this.red},${this.green},${this.blue})`;
  }

  get normalized(): [number, number, number] {
    return [this.red / 255, this.green / 255, this.blue / 255];
  }
}

// --- ColorTable ---

export class ColorTable {
  private readonly colors: ColorTriplet[];
  private readonly matchCache = new Map<string, number>();

  constructor(colors: ColorTriplet[]) {
    this.colors = colors;
  }

  get(index: number): ColorTriplet {
    return this.colors[index]!;
  }

  get size(): number {
    return this.colors.length;
  }

  /**
   * Finds the nearest palette index to the given triplet (Euclidean distance, cached).
   */
  match(triplet: ColorTriplet): number {
    const key = `${triplet.red},${triplet.green},${triplet.blue}`;
    const cached = this.matchCache.get(key);
    if (cached !== undefined) return cached;

    let bestIndex = 0;
    let bestDist = Infinity;
    for (let i = 0; i < this.colors.length; i++) {
      const c = this.colors[i]!;
      const dr = c.red - triplet.red;
      const dg = c.green - triplet.green;
      const db = c.blue - triplet.blue;
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

export enum ColorType {
  DEFAULT = 0,
  STANDARD = 1,
  EIGHT_BIT = 2,
  TRUECOLOR = 3,
  WINDOWS = 4,
}

export enum ColorSystem {
  STANDARD = 1,
  EIGHT_BIT = 2,
  TRUECOLOR = 3,
  WINDOWS = 4,
}

// --- Color system resolution ---

/**
 * String form of a desired color encoding. Consumers (CLIs, config files) speak
 * strings; the canonical machine representation is `ColorSystem | null`.
 *
 * - `"auto"`     — capability-detect from env + TTY state
 * - `"truecolor"` — 24-bit RGB
 * - `"256"`      — 8-bit indexed
 * - `"ansi"`     — 16-color standard
 * - `"none"`     — no color codes
 */
export type ColorSystemSpec = "auto" | "truecolor" | "256" | "ansi" | "none";

export interface DetectColorOptions {
  /** Environment to probe. Defaults to `process.env`. */
  env?: NodeJS.ProcessEnv;
  /** Whether output is going to a real terminal. Defaults to `process.stdout?.isTTY`. */
  isTTY?: boolean;
}

// [LAW:one-source-of-truth] Spec → ColorSystem mapping is data, not branches.
// The single table below is consulted by `resolveColorSystem`; "auto" routes
// to `detectColorSystem` and "none" maps to `null`.
const SPEC_TABLE: Record<Exclude<ColorSystemSpec, "auto">, ColorSystem | null> = {
  truecolor: ColorSystem.TRUECOLOR,
  "256": ColorSystem.EIGHT_BIT,
  ansi: ColorSystem.STANDARD,
  none: null,
};

// [LAW:one-source-of-truth] FORCE_COLOR=N → ColorSystem mapping is data.
// Honors the de facto convention used by chalk/supports-color/Node.
const FORCE_COLOR_TABLE: Record<string, ColorSystem | null> = {
  "0": null,
  false: null,
  "1": ColorSystem.STANDARD,
  true: ColorSystem.STANDARD,
  "2": ColorSystem.EIGHT_BIT,
  "3": ColorSystem.TRUECOLOR,
};

const TRUECOLOR_TERMS = new Set([
  "xterm-kitty",
  "xterm-ghostty",
  "wezterm",
  "alacritty",
  "foot",
  "contour",
]);

const TERM_PROGRAM_TABLE: Record<string, ColorSystem> = {
  "iTerm.app": ColorSystem.TRUECOLOR,
  Apple_Terminal: ColorSystem.EIGHT_BIT,
  vscode: ColorSystem.TRUECOLOR,
  Tabby: ColorSystem.TRUECOLOR,
};

/**
 * Detect the terminal's color capability from env + TTY state.
 *
 * Probes (in priority order): NO_COLOR (per https://no-color.org —
 * any non-empty value disables color), FORCE_COLOR (numeric/boolean override),
 * TTY presence, TERM=dumb/unknown, COLORTERM, known terminal lists, TERM_PROGRAM,
 * and TERM substring patterns. Returns `null` for "no color".
 *
 * [LAW:dataflow-not-control-flow] Same probes run every call; variability is
 * in the env values, not in which checks execute.
 */
export function detectColorSystem(
  options: DetectColorOptions = {},
): ColorSystem | null {
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
    const mapped = FORCE_COLOR_TABLE[force];
    return mapped !== undefined ? mapped : ColorSystem.STANDARD;
  }

  if (!isTTY) return null;

  const term = env["TERM"] ?? "";
  if (term === "dumb" || term === "unknown") return null;

  const colorterm = env["COLORTERM"];
  if (colorterm === "truecolor" || colorterm === "24bit") {
    return ColorSystem.TRUECOLOR;
  }

  if (TRUECOLOR_TERMS.has(term)) return ColorSystem.TRUECOLOR;

  const termProgram = env["TERM_PROGRAM"];
  if (termProgram !== undefined) {
    const mapped = TERM_PROGRAM_TABLE[termProgram];
    if (mapped !== undefined) return mapped;
  }

  if (/-256(color)?$/i.test(term)) return ColorSystem.EIGHT_BIT;
  if (/-truecolor$/i.test(term)) return ColorSystem.TRUECOLOR;
  if (/^screen|^xterm|^vt100|^vt220|^rxvt|color|ansi|cygwin|linux/i.test(term)) {
    return ColorSystem.STANDARD;
  }
  if (colorterm !== undefined && colorterm !== "") return ColorSystem.STANDARD;

  // Default: a terminal exists (isTTY=true) but we couldn't classify it.
  // Assume safe baseline rather than disabling color.
  return ColorSystem.STANDARD;
}

/**
 * Resolve a string spec into a `ColorSystem` (or `null` for no color).
 *
 * `"auto"` triggers env-based detection; all other specs are direct mappings.
 *
 * [LAW:single-enforcer] All string→ColorSystem resolution flows through here;
 * `Console` and `renderToString` both delegate to this function.
 */
export function resolveColorSystem(
  spec: ColorSystemSpec,
  options?: DetectColorOptions,
): ColorSystem | null {
  if (spec === "auto") return detectColorSystem(options);
  return SPEC_TABLE[spec];
}

// --- Color ---

export class ColorParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ColorParseError";
  }
}

// [LAW:one-source-of-truth] Parse cache is the single source for parsed Color instances
const parseCache = new Map<string, Color>();

export class Color {
  readonly name: string;
  readonly type: ColorType;
  readonly number: number | undefined;
  readonly triplet: ColorTriplet | undefined;

  private downgradeCache = new Map<ColorSystem, Color>();

  constructor(
    name: string,
    type: ColorType,
    number?: number,
    triplet?: ColorTriplet,
  ) {
    this.name = name;
    this.type = type;
    this.number = number;
    this.triplet = triplet;
  }

  get system(): ColorSystem {
    switch (this.type) {
      case ColorType.DEFAULT:
        return ColorSystem.STANDARD;
      case ColorType.STANDARD:
        return ColorSystem.STANDARD;
      case ColorType.EIGHT_BIT:
        return ColorSystem.EIGHT_BIT;
      case ColorType.TRUECOLOR:
        return ColorSystem.TRUECOLOR;
      case ColorType.WINDOWS:
        return ColorSystem.WINDOWS;
    }
  }

  get isDefault(): boolean {
    return this.type === ColorType.DEFAULT;
  }

  get isSystemDefined(): boolean {
    return (
      this.type === ColorType.STANDARD || this.type === ColorType.WINDOWS
    );
  }

  /**
   * Generates SGR parameter strings for this color.
   */
  getAnsiCodes(foreground = true): string[] {
    switch (this.type) {
      case ColorType.DEFAULT:
        return [foreground ? "39" : "49"];
      case ColorType.STANDARD: {
        const n = this.number!;
        if (foreground) {
          return n < 8 ? [`${30 + n}`] : [`${90 + n - 8}`];
        }
        return n < 8 ? [`${40 + n}`] : [`${100 + n - 8}`];
      }
      case ColorType.EIGHT_BIT:
        return [foreground ? "38" : "48", "5", `${this.number!}`];
      case ColorType.TRUECOLOR: {
        const t = this.triplet!;
        return [
          foreground ? "38" : "48",
          "2",
          `${t.red}`,
          `${t.green}`,
          `${t.blue}`,
        ];
      }
      case ColorType.WINDOWS: {
        const n = this.number!;
        if (foreground) {
          return n < 8 ? [`${30 + n}`] : [`${90 + n - 8}`];
        }
        return n < 8 ? [`${40 + n}`] : [`${100 + n - 8}`];
      }
    }
  }

  /**
   * Downgrade to a lower-fidelity color system. Cached.
   */
  downgrade(targetSystem: ColorSystem): Color {
    if (this.type === ColorType.DEFAULT) return this;
    if (this.system <= targetSystem) return this;

    const cached = this.downgradeCache.get(targetSystem);
    if (cached) return cached;

    const result = this.performDowngrade(targetSystem);
    this.downgradeCache.set(targetSystem, result);
    return result;
  }

  /**
   * Resolves to an actual RGB triplet for any color type.
   */
  getTruecolor(theme?: TerminalTheme, foreground = true): ColorTriplet {
    switch (this.type) {
      case ColorType.TRUECOLOR:
        return this.triplet!;
      case ColorType.EIGHT_BIT:
        return EIGHT_BIT_TABLE.get(this.number!);
      case ColorType.STANDARD: {
        const t = theme ?? DEFAULT_TERMINAL_THEME;
        return t.ansiColors.get(this.number!);
      }
      case ColorType.DEFAULT: {
        const t = theme ?? DEFAULT_TERMINAL_THEME;
        return foreground ? t.foregroundColor : t.backgroundColor;
      }
      case ColorType.WINDOWS: {
        const t = theme ?? DEFAULT_TERMINAL_THEME;
        return t.ansiColors.get(this.number!);
      }
    }
  }

  // --- Static factories ---

  static default(): Color {
    return new Color("default", ColorType.DEFAULT);
  }

  static fromAnsi(n: number): Color {
    const type = n < 16 ? ColorType.STANDARD : ColorType.EIGHT_BIT;
    return new Color(`color(${n})`, type, n);
  }

  static fromTriplet(triplet: ColorTriplet): Color {
    return new Color(triplet.hex, ColorType.TRUECOLOR, undefined, triplet);
  }

  static fromRgb(r: number, g: number, b: number): Color {
    return Color.fromTriplet(new ColorTriplet(r, g, b));
  }

  /**
   * Parse a color string. Cached — identical strings return the same instance.
   */
  static parse(colorString: string): Color {
    const key = colorString.toLowerCase().trim();
    const cached = parseCache.get(key);
    if (cached) return cached;

    const result = parseSingle(key);
    parseCache.set(key, result);
    return result;
  }

  // --- private ---

  private performDowngrade(targetSystem: ColorSystem): Color {
    // Get the true RGB of this color
    const triplet = this.getTruecolor();

    switch (targetSystem) {
      case ColorSystem.EIGHT_BIT: {
        const index = EIGHT_BIT_TABLE.match(triplet);
        return Color.fromAnsi(index);
      }
      case ColorSystem.STANDARD: {
        const index = STANDARD_TABLE.match(triplet);
        return new Color(
          `color(${index})`,
          ColorType.STANDARD,
          index,
        );
      }
      case ColorSystem.WINDOWS: {
        const index = WINDOWS_TABLE.match(triplet);
        return new Color(
          `color(${index})`,
          ColorType.WINDOWS,
          index,
        );
      }
      case ColorSystem.TRUECOLOR:
        return this;
    }
  }
}

// --- Parsing internals ---

const HEX_RE = /^#([0-9a-f]{6})$/;
const RGB_RE = /^rgb\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})\s*\)$/;
const COLOR_NUMBER_RE = /^color\((\d{1,3})\)$/;

function parseSingle(key: string): Color {
  if (key === "default" || key === "") {
    return Color.default();
  }

  // Named color
  const namedIndex = ANSI_COLOR_NAMES[key];
  if (namedIndex !== undefined) {
    const type = namedIndex < 16 ? ColorType.STANDARD : ColorType.EIGHT_BIT;
    return new Color(key, type, namedIndex);
  }

  // Hex
  const hexMatch = HEX_RE.exec(key);
  if (hexMatch) {
    const triplet = parseRgbHex(hexMatch[1]!);
    return new Color(key, ColorType.TRUECOLOR, undefined, triplet);
  }

  // rgb()
  const rgbMatch = RGB_RE.exec(key);
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1]!, 10);
    const g = parseInt(rgbMatch[2]!, 10);
    const b = parseInt(rgbMatch[3]!, 10);
    return new Color(key, ColorType.TRUECOLOR, undefined, new ColorTriplet(r, g, b));
  }

  // color(N)
  const numMatch = COLOR_NUMBER_RE.exec(key);
  if (numMatch) {
    const n = parseInt(numMatch[1]!, 10);
    if (n > 255) {
      throw new ColorParseError(`Color number ${n} is out of range (0-255)`);
    }
    const type = n < 16 ? ColorType.STANDARD : ColorType.EIGHT_BIT;
    return new Color(key, type, n);
  }

  throw new ColorParseError(`Failed to parse color: "${key}"`);
}

// --- Utility functions ---

export function parseRgbHex(hex: string): ColorTriplet {
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return new ColorTriplet(r, g, b);
}

export function blendRgb(
  color1: ColorTriplet,
  color2: ColorTriplet,
  crossFade = 0.5,
): ColorTriplet {
  return new ColorTriplet(
    Math.round(color1.red + (color2.red - color1.red) * crossFade),
    Math.round(color1.green + (color2.green - color1.green) * crossFade),
    Math.round(color1.blue + (color2.blue - color1.blue) * crossFade),
  );
}

// --- TerminalTheme ---

export class TerminalTheme {
  constructor(
    readonly backgroundColor: ColorTriplet,
    readonly foregroundColor: ColorTriplet,
    readonly ansiColors: ColorTable,
  ) {}
}

// --- ColorTable data ---

function buildStandard16(): ColorTriplet[] {
  return [
    new ColorTriplet(0, 0, 0),        // 0  black
    new ColorTriplet(128, 0, 0),       // 1  red
    new ColorTriplet(0, 128, 0),       // 2  green
    new ColorTriplet(128, 128, 0),     // 3  yellow
    new ColorTriplet(0, 0, 128),       // 4  blue
    new ColorTriplet(128, 0, 128),     // 5  magenta
    new ColorTriplet(0, 128, 128),     // 6  cyan
    new ColorTriplet(192, 192, 192),   // 7  white
    new ColorTriplet(128, 128, 128),   // 8  bright_black
    new ColorTriplet(255, 0, 0),       // 9  bright_red
    new ColorTriplet(0, 255, 0),       // 10 bright_green
    new ColorTriplet(255, 255, 0),     // 11 bright_yellow
    new ColorTriplet(0, 0, 255),       // 12 bright_blue
    new ColorTriplet(255, 0, 255),     // 13 bright_magenta
    new ColorTriplet(0, 255, 255),     // 14 bright_cyan
    new ColorTriplet(255, 255, 255),   // 15 bright_white
  ];
}

function build256Table(): ColorTriplet[] {
  const colors = buildStandard16();

  // 6x6x6 color cube (indices 16-231)
  const levels = [0, 95, 135, 175, 215, 255];
  for (let r = 0; r < 6; r++) {
    for (let g = 0; g < 6; g++) {
      for (let b = 0; b < 6; b++) {
        colors.push(new ColorTriplet(levels[r]!, levels[g]!, levels[b]!));
      }
    }
  }

  // Grayscale ramp (indices 232-255)
  for (let i = 0; i < 24; i++) {
    const grey = 8 + 10 * i;
    colors.push(new ColorTriplet(grey, grey, grey));
  }

  return colors;
}

function buildWindowsTable(): ColorTriplet[] {
  return [
    new ColorTriplet(0, 0, 0),        // 0
    new ColorTriplet(0, 0, 128),       // 1
    new ColorTriplet(0, 128, 0),       // 2
    new ColorTriplet(0, 128, 128),     // 3
    new ColorTriplet(128, 0, 0),       // 4
    new ColorTriplet(128, 0, 128),     // 5
    new ColorTriplet(128, 128, 0),     // 6
    new ColorTriplet(192, 192, 192),   // 7
    new ColorTriplet(128, 128, 128),   // 8
    new ColorTriplet(0, 0, 255),       // 9
    new ColorTriplet(0, 255, 0),       // 10
    new ColorTriplet(0, 255, 255),     // 11
    new ColorTriplet(255, 0, 0),       // 12
    new ColorTriplet(255, 0, 255),     // 13
    new ColorTriplet(255, 255, 0),     // 14
    new ColorTriplet(255, 255, 255),   // 15
  ];
}

export const STANDARD_TABLE = new ColorTable(buildStandard16());
export const EIGHT_BIT_TABLE = new ColorTable(build256Table());
export const WINDOWS_TABLE = new ColorTable(buildWindowsTable());

// --- Pre-built themes ---

export const DEFAULT_TERMINAL_THEME = new TerminalTheme(
  new ColorTriplet(0, 0, 0),
  new ColorTriplet(255, 255, 255),
  STANDARD_TABLE,
);

export const MONOKAI = new TerminalTheme(
  new ColorTriplet(12, 12, 12),
  new ColorTriplet(217, 217, 217),
  new ColorTable([
    new ColorTriplet(1, 1, 1),         // 0
    new ColorTriplet(222, 56, 43),     // 1
    new ColorTriplet(57, 181, 74),     // 2
    new ColorTriplet(255, 199, 6),     // 3
    new ColorTriplet(0, 111, 184),     // 4
    new ColorTriplet(118, 38, 113),    // 5
    new ColorTriplet(44, 181, 233),    // 6
    new ColorTriplet(204, 204, 204),   // 7
    new ColorTriplet(128, 128, 128),   // 8
    new ColorTriplet(255, 0, 0),       // 9
    new ColorTriplet(0, 255, 0),       // 10
    new ColorTriplet(255, 255, 0),     // 11
    new ColorTriplet(0, 0, 255),       // 12
    new ColorTriplet(255, 0, 255),     // 13
    new ColorTriplet(0, 255, 255),     // 14
    new ColorTriplet(255, 255, 255),   // 15
  ]),
);

export const SVG_EXPORT_THEME = new TerminalTheme(
  new ColorTriplet(41, 41, 41),
  new ColorTriplet(197, 200, 198),
  new ColorTable([
    new ColorTriplet(75, 78, 85),      // 0
    new ColorTriplet(204, 85, 90),     // 1
    new ColorTriplet(152, 195, 121),   // 2
    new ColorTriplet(229, 192, 123),   // 3
    new ColorTriplet(97, 175, 239),    // 4
    new ColorTriplet(198, 120, 221),   // 5
    new ColorTriplet(86, 182, 194),    // 6
    new ColorTriplet(171, 178, 191),   // 7
    new ColorTriplet(75, 78, 85),      // 8
    new ColorTriplet(255, 135, 135),   // 9
    new ColorTriplet(135, 255, 175),   // 10
    new ColorTriplet(255, 255, 95),    // 11
    new ColorTriplet(135, 175, 255),   // 12
    new ColorTriplet(255, 135, 255),   // 13
    new ColorTriplet(95, 255, 255),    // 14
    new ColorTriplet(255, 255, 255),   // 15
  ]),
);

// --- ANSI Color Names ---
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
