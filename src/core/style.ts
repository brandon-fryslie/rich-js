/**
 * Immutable style descriptors — colors, text attributes, links, metadata.
 */

import {
  ColorSpec,
  ColorDepth,
  DEFAULT_TERMINAL_THEME,
} from "./color.js";
import type { TerminalTheme } from "./color.js";

// --- Attribute definitions ---

/**
 * Canonical text-attribute inventory. Single source of truth consumed by
 * `Style.parse` / `Style.toString` and the template bindings — adding an
 * attribute here propagates to every styling surface without a second
 * list to keep in sync. [LAW:one-source-of-truth]
 */
export const ATTRIBUTE_NAMES = [
  "bold",
  "dim",
  "italic",
  "underline",
  "blink",
  "blink2",
  "reverse",
  "conceal",
  "strike",
  "underline2",
  "frame",
  "encircle",
  "overline",
] as const;

export type AttributeName = (typeof ATTRIBUTE_NAMES)[number];

// SGR codes for each attribute (on / off)
const ATTRIBUTE_SGR: Record<AttributeName, [number, number]> = {
  bold: [1, 22],
  dim: [2, 22],
  italic: [3, 23],
  underline: [4, 24],
  blink: [5, 25],
  blink2: [6, 25],
  reverse: [7, 27],
  conceal: [8, 28],
  strike: [9, 29],
  underline2: [21, 24],
  frame: [51, 54],
  encircle: [52, 54],
  overline: [53, 55],
};

/**
 * Canonical short-attribute aliases (`b` → `bold`, `i` → `italic`, …).
 * Single source of truth consumed by `Style.parse` and the template
 * bindings — adding an alias here makes it available everywhere.
 * [LAW:one-source-of-truth]
 */
export const ATTRIBUTE_SHORT_ALIASES: Record<string, AttributeName> = {
  b: "bold",
  d: "dim",
  i: "italic",
  u: "underline",
  s: "strike",
  r: "reverse",
  o: "overline",
  uu: "underline2",
};

// --- Types ---

export interface StyleOptions {
  color?: string | ColorSpec;
  bgcolor?: string | ColorSpec;
  bold?: boolean;
  dim?: boolean;
  italic?: boolean;
  underline?: boolean;
  blink?: boolean;
  blink2?: boolean;
  reverse?: boolean;
  conceal?: boolean;
  strike?: boolean;
  underline2?: boolean;
  frame?: boolean;
  encircle?: boolean;
  overline?: boolean;
  link?: string;
  meta?: Record<string, unknown>;
}

export class StyleSyntaxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StyleSyntaxError";
  }
}

// [LAW:one-source-of-truth] Parse cache is the single source for parsed Style instances
const styleParseCache = new Map<string, Style>();

let nextLinkId = 1;

// --- Style ---

export class Style {
  readonly color: ColorSpec | undefined;
  readonly bgcolor: ColorSpec | undefined;
  readonly bold: boolean | undefined;
  readonly dim: boolean | undefined;
  readonly italic: boolean | undefined;
  readonly underline: boolean | undefined;
  readonly blink: boolean | undefined;
  readonly blink2: boolean | undefined;
  readonly reverse: boolean | undefined;
  readonly conceal: boolean | undefined;
  readonly strike: boolean | undefined;
  readonly underline2: boolean | undefined;
  readonly frame: boolean | undefined;
  readonly encircle: boolean | undefined;
  readonly overline: boolean | undefined;
  readonly link: string | undefined;
  readonly meta: Record<string, unknown> | undefined;
  /** @internal */
  readonly _linkId: number;

  constructor(options?: StyleOptions) {
    if (!options) {
      this.color = undefined;
      this.bgcolor = undefined;
      this.bold = undefined;
      this.dim = undefined;
      this.italic = undefined;
      this.underline = undefined;
      this.blink = undefined;
      this.blink2 = undefined;
      this.reverse = undefined;
      this.conceal = undefined;
      this.strike = undefined;
      this.underline2 = undefined;
      this.frame = undefined;
      this.encircle = undefined;
      this.overline = undefined;
      this.link = undefined;
      this.meta = undefined;
      this._linkId = 0;
      return;
    }

    this.color = resolveColor(options.color);
    this.bgcolor = resolveColor(options.bgcolor);
    this.bold = options.bold;
    this.dim = options.dim;
    this.italic = options.italic;
    this.underline = options.underline;
    this.blink = options.blink;
    this.blink2 = options.blink2;
    this.reverse = options.reverse;
    this.conceal = options.conceal;
    this.strike = options.strike;
    this.underline2 = options.underline2;
    this.frame = options.frame;
    this.encircle = options.encircle;
    this.overline = options.overline;
    this.link = options.link;
    this.meta = options.meta;
    this._linkId = options.link ? nextLinkId++ : 0;
  }

  get isNull(): boolean {
    return (
      this.color === undefined &&
      this.bgcolor === undefined &&
      this.bold === undefined &&
      this.dim === undefined &&
      this.italic === undefined &&
      this.underline === undefined &&
      this.blink === undefined &&
      this.blink2 === undefined &&
      this.reverse === undefined &&
      this.conceal === undefined &&
      this.strike === undefined &&
      this.underline2 === undefined &&
      this.frame === undefined &&
      this.encircle === undefined &&
      this.overline === undefined &&
      this.link === undefined &&
      this.meta === undefined
    );
  }

  get transparentBackground(): boolean {
    return this.bgcolor === undefined || this.bgcolor.isDefault;
  }

  get backgroundStyle(): Style {
    return new Style({ bgcolor: this.bgcolor });
  }

  get withoutColor(): Style {
    return new Style({
      bold: this.bold,
      dim: this.dim,
      italic: this.italic,
      underline: this.underline,
      blink: this.blink,
      blink2: this.blink2,
      reverse: this.reverse,
      conceal: this.conceal,
      strike: this.strike,
      underline2: this.underline2,
      frame: this.frame,
      encircle: this.encircle,
      overline: this.overline,
      link: this.link,
      meta: this.meta,
    });
  }

  clearMetaAndLinks(): Style {
    return new Style({
      color: this.color,
      bgcolor: this.bgcolor,
      bold: this.bold,
      dim: this.dim,
      italic: this.italic,
      underline: this.underline,
      blink: this.blink,
      blink2: this.blink2,
      reverse: this.reverse,
      conceal: this.conceal,
      strike: this.strike,
      underline2: this.underline2,
      frame: this.frame,
      encircle: this.encircle,
      overline: this.overline,
    });
  }

  /**
   * Merges two styles. `other`'s values take priority.
   */
  add(other: Style | undefined): Style {
    if (!other || other.isNull) return this;
    if (this.isNull) return other;

    return new Style({
      color: other.color ?? this.color,
      bgcolor: other.bgcolor ?? this.bgcolor,
      bold: other.bold ?? this.bold,
      dim: other.dim ?? this.dim,
      italic: other.italic ?? this.italic,
      underline: other.underline ?? this.underline,
      blink: other.blink ?? this.blink,
      blink2: other.blink2 ?? this.blink2,
      reverse: other.reverse ?? this.reverse,
      conceal: other.conceal ?? this.conceal,
      strike: other.strike ?? this.strike,
      underline2: other.underline2 ?? this.underline2,
      frame: other.frame ?? this.frame,
      encircle: other.encircle ?? this.encircle,
      overline: other.overline ?? this.overline,
      link: other.link ?? this.link,
      meta:
        other.meta && this.meta
          ? { ...this.meta, ...other.meta }
          : other.meta ?? this.meta,
    });
  }

  equals(other: Style): boolean {
    if (this === other) return true;
    return (
      this.color?.name === other.color?.name &&
      this.bgcolor?.name === other.bgcolor?.name &&
      this.bold === other.bold &&
      this.dim === other.dim &&
      this.italic === other.italic &&
      this.underline === other.underline &&
      this.blink === other.blink &&
      this.blink2 === other.blink2 &&
      this.reverse === other.reverse &&
      this.conceal === other.conceal &&
      this.strike === other.strike &&
      this.underline2 === other.underline2 &&
      this.frame === other.frame &&
      this.encircle === other.encircle &&
      this.overline === other.overline &&
      this.link === other.link
    );
  }

  /**
   * Render text with this style's ANSI escape codes.
   */
  render(text: string, colorSystem?: ColorDepth): string {
    if (text.length === 0) return "";
    if (this.isNull) return text;

    const attrs: string[] = [];

    // [LAW:dataflow-not-control-flow] Always resolve a substrate and flatten
    // alpha before downgrade. Opaque colors short-circuit inside compositeOver,
    // so the same code path runs every render — the alpha value is the data,
    // not a branch.
    const surface = DEFAULT_TERMINAL_THEME.backgroundColor;
    const bgFlat = this.bgcolor?.flattenAlpha(surface);
    const fgSubstrate = bgFlat?.getTruecolor(undefined, false) ?? surface;
    const fgFlat = this.color?.flattenAlpha(fgSubstrate);

    if (fgFlat) {
      const c =
        colorSystem !== undefined ? fgFlat.downgrade(colorSystem) : fgFlat;
      attrs.push(...c.getAnsiCodes(true));
    }
    if (bgFlat) {
      const c =
        colorSystem !== undefined ? bgFlat.downgrade(colorSystem) : bgFlat;
      attrs.push(...c.getAnsiCodes(false));
    }

    // Attributes
    for (const name of ATTRIBUTE_NAMES) {
      const val = this[name];
      if (val === true) {
        attrs.push(`${ATTRIBUTE_SGR[name][0]}`);
      } else if (val === false) {
        attrs.push(`${ATTRIBUTE_SGR[name][1]}`);
      }
    }

    let result = text;
    if (attrs.length > 0) {
      result = `\x1b[${attrs.join(";")}m${text}\x1b[0m`;
    }

    // Link (OSC 8)
    if (this.link) {
      const id = this._linkId;
      result = `\x1b]8;id=${id};${this.link}\x1b\\${result}\x1b]8;;\x1b\\`;
    }

    return result;
  }

  /**
   * Returns a CSS style string for HTML rendering.
   */
  getHtmlStyle(theme?: TerminalTheme): string {
    if (this.isNull) return "";
    const parts: string[] = [];

    if (this.color) {
      const triplet = this.color.getTruecolor(theme, true);
      parts.push(`color: ${triplet.hex}`);
    }
    if (this.bgcolor) {
      const triplet = this.bgcolor.getTruecolor(theme, false);
      parts.push(`background-color: ${triplet.hex}`);
    }
    if (this.bold) parts.push("font-weight: bold");
    if (this.italic) parts.push("font-style: italic");

    const decorations: string[] = [];
    if (this.underline) decorations.push("underline");
    if (this.strike) decorations.push("line-through");
    if (this.overline) decorations.push("overline");
    if (decorations.length > 0) {
      parts.push(`text-decoration: ${decorations.join(" ")}`);
    }
    if (this.dim) parts.push("opacity: 0.5");

    return parts.join("; ");
  }

  /**
   * Serializes to a canonical string that round-trips through `Style.parse()`.
   */
  toString(): string {
    if (this.isNull) return "none";
    const parts: string[] = [];

    // Negated attributes first
    for (const name of ATTRIBUTE_NAMES) {
      if (this[name] === false) parts.push(`not ${name}`);
    }
    // Positive attributes
    for (const name of ATTRIBUTE_NAMES) {
      if (this[name] === true) parts.push(name);
    }

    if (this.color) parts.push(this.color.name);
    if (this.bgcolor) parts.push(`on ${this.bgcolor.name}`);
    if (this.link) parts.push(`link ${this.link}`);

    return parts.join(" ") || "none";
  }

  // --- Static methods ---

  static null(): Style {
    return NULL_STYLE;
  }

  static fromColor(color?: ColorSpec, bgcolor?: ColorSpec): Style {
    return new Style({ color, bgcolor });
  }

  static fromMeta(meta: Record<string, unknown>): Style {
    return new Style({ meta });
  }

  static pickFirst(...args: (Style | undefined)[]): Style {
    for (const a of args) {
      if (a !== undefined) return a;
    }
    throw new Error("All arguments are undefined");
  }

  static combine(styles: (Style | undefined)[]): Style {
    let result: Style = NULL_STYLE;
    for (const s of styles) {
      if (s) result = result.add(s);
    }
    return result;
  }

  static chain(...styles: (Style | undefined)[]): Style {
    return Style.combine(styles);
  }

  static normalize(definition: string): string {
    return definition.trim().replace(/\s+/g, " ");
  }

  /**
   * Parse a space-separated style definition. Cached.
   */
  static parse(definition: string): Style {
    const normalized = Style.normalize(definition);
    if (normalized === "" || normalized === "none") return NULL_STYLE;

    const cached = styleParseCache.get(normalized);
    if (cached) return cached;

    // Check DEFAULT_STYLES for semantic names (e.g., "table.header", "repr.number")
    // [LAW:one-source-of-truth] Semantic names resolve through DEFAULT_STYLES
    // Only check after initialization is complete (avoid circular reference)
    if (defaultStylesReady && normalized.includes(".")) {
      const semantic = DEFAULT_STYLES[normalized];
      if (semantic !== undefined) {
        styleParseCache.set(normalized, semantic);
        return semantic;
      }
    }

    const result = parseStyleDefinition(normalized);
    styleParseCache.set(normalized, result);
    return result;
  }
}

export const NULL_STYLE = new Style();

// --- StyleStack ---

export class StyleStack {
  private readonly stack: Style[];

  constructor(base: Style = NULL_STYLE) {
    this.stack = [base];
  }

  get current(): Style {
    return this.stack[this.stack.length - 1]!;
  }

  push(style: Style): void {
    this.stack.push(this.current.add(style));
  }

  pop(): Style {
    if (this.stack.length <= 1) {
      throw new Error("Cannot pop the base style from StyleStack");
    }
    return this.stack.pop()!;
  }
}

// --- Theme ---

const STYLE_NAME_RE = /^[a-z][a-z0-9._-]*$/;

export class Theme {
  private readonly styles: Map<string, Style>;

  constructor(
    definitions: Record<string, string> = {},
    options?: { inherit?: boolean },
  ) {
    this.styles = new Map();
    const inherit = options?.inherit !== false;
    if (inherit) {
      for (const [name, style] of Object.entries(DEFAULT_STYLES)) {
        this.styles.set(name, style);
      }
    }
    for (const [name, def] of Object.entries(definitions)) {
      if (!STYLE_NAME_RE.test(name)) {
        throw new Error(
          `Invalid style name: "${name}" (must be lowercase, start with letter, contain only letters, digits, ".", "-", "_")`,
        );
      }
      this.styles.set(name, Style.parse(def));
    }
  }

  get(name: string): Style | undefined {
    return this.styles.get(name);
  }

  has(name: string): boolean {
    return this.styles.has(name);
  }
}

// --- Parse helpers ---

const ATTRIBUTE_SET = new Set<string>(ATTRIBUTE_NAMES);

function parseStyleDefinition(definition: string): Style {
  const tokens = definition.split(/\s+/);
  const opts: StyleOptions = {};

  let i = 0;
  while (i < tokens.length) {
    const token = tokens[i]!;

    // "not <attr>"
    if (token === "not") {
      i++;
      const next = tokens[i];
      if (!next) {
        throw new StyleSyntaxError(`Expected attribute after "not" in style definition`);
      }
      const attrName = ATTRIBUTE_SHORT_ALIASES[next] ?? next;
      if (!ATTRIBUTE_SET.has(attrName)) {
        throw new StyleSyntaxError(`Invalid attribute: "${next}"`);
      }
      (opts as Record<string, boolean>)[attrName] = false;
      i++;
      continue;
    }

    // "on <color>"
    if (token === "on") {
      i++;
      const next = tokens[i];
      if (!next) {
        throw new StyleSyntaxError(`Expected color after "on" in style definition`);
      }
      try {
        opts.bgcolor = ColorSpec.parse(next);
      } catch {
        throw new StyleSyntaxError(`Invalid background color: "${next}"`);
      }
      i++;
      continue;
    }

    // "link <url>"
    if (token === "link") {
      i++;
      const url = tokens[i];
      if (url) {
        opts.link = url;
      }
      i++;
      continue;
    }

    // Attribute (full name)
    const resolvedAttr = ATTRIBUTE_SHORT_ALIASES[token] ?? token;
    if (ATTRIBUTE_SET.has(resolvedAttr)) {
      (opts as Record<string, boolean>)[resolvedAttr] = true;
      i++;
      continue;
    }

    // Must be a color
    try {
      opts.color = ColorSpec.parse(token);
    } catch {
      throw new StyleSyntaxError(`Invalid style definition: "${token}"`);
    }
    i++;
  }

  return new Style(opts);
}

function resolveColor(c: string | ColorSpec | undefined): ColorSpec | undefined {
  if (c === undefined) return undefined;
  if (c instanceof ColorSpec) return c;
  return ColorSpec.parse(c);
}

// --- DEFAULT_STYLES ---
// [LAW:one-source-of-truth] Single canonical mapping of semantic names to styles

let defaultStylesReady = false;

export const DEFAULT_STYLES: Record<string, Style> = {
  none: NULL_STYLE,
  reset: new Style({
    color: ColorSpec.default(),
    bgcolor: ColorSpec.default(),
    bold: false,
    dim: false,
    italic: false,
    underline: false,
    blink: false,
    blink2: false,
    reverse: false,
    conceal: false,
    strike: false,
    underline2: false,
    frame: false,
    encircle: false,
    overline: false,
  }),
  bold: new Style({ bold: true }),
  dim: new Style({ dim: true }),
  italic: new Style({ italic: true }),
  underline: new Style({ underline: true }),
  blink: new Style({ blink: true }),
  blink2: new Style({ blink2: true }),
  reverse: new Style({ reverse: true }),
  conceal: new Style({ conceal: true }),
  strike: new Style({ strike: true }),
  underline2: new Style({ underline2: true }),
  frame: new Style({ frame: true }),
  encircle: new Style({ encircle: true }),
  overline: new Style({ overline: true }),

  // Table
  "table.header": new Style({ bold: true }),
  "table.footer": new Style({ bold: true }),
  "table.cell": NULL_STYLE,
  "table.title": new Style({ italic: true }),
  "table.caption": new Style({ italic: true, dim: true }),

  // Repr/highlighting
  "repr.str": Style.parse("green"),
  "repr.number": Style.parse("cyan"),
  "repr.bool": Style.parse("italic bright_magenta"),
  "repr.none": Style.parse("italic magenta"),
  "repr.url": Style.parse("not italic underline bright_blue"),
  "repr.uuid": Style.parse("bright_yellow"),
  "repr.error": Style.parse("bold red"),
  "repr.indent": Style.parse("dim green"),
  "repr.attrib_name": Style.parse("yellow"),
  "repr.attrib_value": Style.parse("magenta"),
  "repr.attrib_equal": Style.parse("bold"),
  "repr.tag_start": Style.parse("bold"),
  "repr.tag_name": Style.parse("bright_magenta"),
  "repr.tag_contents": Style.parse("default"),
  "repr.tag_end": Style.parse("bold"),

  // Log
  "log.time": Style.parse("cyan dim"),
  "log.message": NULL_STYLE,
  "log.path": Style.parse("dim"),
  "log.line_no": Style.parse("cyan"),
  "log.level": NULL_STYLE,

  // Rule
  "rule.line": Style.parse("green"),
  "rule.text": Style.parse("bold"),

  // JSON
  "json.brace": Style.parse("bold"),
  "json.bool": Style.parse("italic bright_magenta"),
  "json.key": Style.parse("bold blue"),
  "json.null": Style.parse("italic magenta"),
  "json.number": Style.parse("cyan"),
  "json.str": Style.parse("green"),

  // Markdown
  "markdown.h1": Style.parse("bold underline"),
  "markdown.h2": Style.parse("bold"),
  "markdown.h3": Style.parse("bold dim"),
  "markdown.h4": Style.parse("bold dim italic"),
  "markdown.code": Style.parse("cyan on grey11"),
  "markdown.hr": Style.parse("yellow"),
  "markdown.link": Style.parse("bright_blue"),
  "markdown.link_url": Style.parse("blue"),

  // Progress
  "progress.description": NULL_STYLE,
  "progress.percentage": Style.parse("cyan"),
  "progress.remaining": Style.parse("cyan"),
  "progress.elapsed": Style.parse("cyan"),
  "progress.spinner": Style.parse("green"),
  "progress.download": Style.parse("green"),
  "progress.filesize": Style.parse("green"),
  "progress.filesize.total": Style.parse("green"),
  "progress.data.speed": Style.parse("red"),

  // Bar
  "bar.back": Style.parse("grey23"),
  "bar.complete": Style.parse("magenta"),
  "bar.finished": Style.parse("green"),
  "bar.pulse": Style.parse("magenta"),

  // Tree
  "tree": NULL_STYLE,
  "tree.guide": NULL_STYLE,

  // Status
  "status.spinner": Style.parse("green"),
  "status.message": NULL_STYLE,

  // Prompt
  "prompt": Style.parse("bold"),
  "prompt.choices": Style.parse("magenta"),
  "prompt.default": Style.parse("cyan"),

  // Inspect
  "inspect.attr": Style.parse("yellow italic"),
  "inspect.attr.dunder": Style.parse("yellow italic dim"),
  "inspect.callable": Style.parse("bold magenta"),
  "inspect.error": Style.parse("bold red"),
  "inspect.help": Style.parse("cyan"),
  "inspect.doc": Style.parse("dim"),
  "inspect.value.border": Style.parse("green"),

  // Traceback
  "traceback.border": Style.parse("red"),
  "traceback.text": Style.parse("red"),
  "traceback.title": Style.parse("bold red"),
  "traceback.exc_type": Style.parse("bold bright_red"),
  "traceback.exc_value": NULL_STYLE,
  "traceback.offset": Style.parse("bold bright_red"),

  // Scope
  "scope.border": Style.parse("blue"),
  "scope.key": Style.parse("italic"),
  "scope.key.special": Style.parse("dim italic"),

  // Pretty
  "pretty": NULL_STYLE,

  // ISO8601
  "iso8601.date": Style.parse("cyan"),
  "iso8601.time": Style.parse("cyan"),
  "iso8601.timezone": Style.parse("bright_blue"),
};

defaultStylesReady = true;
