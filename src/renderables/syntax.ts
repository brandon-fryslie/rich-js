/**
 * Syntax — renders source code with basic syntax highlighting.
 * Uses built-in tokenization (no external dependency).
 *
 * Colours are names in the console's theme (`syntax.keyword`,
 * `syntax.line_number`, …), not a per-instance palette: a theme is how every
 * other renderable here is restyled, and a second styling vocabulary on this
 * one class would be a second answer to "what colour is a keyword".
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { RichText } from "../core/text.js";
import { drawable, getStyle, type Measurable, type Renderable, type RenderOptions } from "../core/protocol.js";

export interface SyntaxOptions {
  lineNumbers?: boolean;
  startLine?: number;
  lineRange?: [number, number];
  highlightLines?: Set<number>;
  wordWrap?: boolean;
  tabSize?: number;
}

type Token = "comment" | "string" | "constant" | "keyword" | "number";

/**
 * One regex per grammar, each token a named alternative. A single left-to-right
 * scan is what keeps a `//` inside a string from starting a comment, and a
 * keyword inside a comment from being drawn as one: at any position the
 * leftmost match wins, and among matches starting there the earliest rule.
 * `(?!)` never matches, so a grammar with no rules is still a regex.
 */
function grammar(rules: readonly [Token, string][]): RegExp {
  return new RegExp([...rules.map(([token, source]) => `(?<${token}>${source})`), "(?!)"].join("|"), "g");
}

const words = (list: string): string => `\\b(?:${list.split(" ").join("|")})\\b`;
const NUMBER = String.raw`\b(?:0x[0-9a-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b`;
const QUOTED = String.raw`"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'`;

const JS_KEYWORDS =
  "function class const let var return if else for while do switch case break continue new throw try catch " +
  "finally import export from default async await yield of in typeof instanceof void delete this super extends static get set";
const TS_KEYWORDS = "interface type enum implements private public protected readonly as declare namespace keyof satisfies abstract is infer";

const JAVASCRIPT: readonly [Token, string][] = [
  ["comment", String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`],
  ["string", String.raw`${QUOTED}|` + "`(?:[^`\\\\]|\\\\.)*`"],
  ["constant", words("true false null undefined NaN Infinity")],
  ["keyword", words(JS_KEYWORDS)],
  ["number", NUMBER],
];

/**
 * [LAW:one-type-per-behavior] A language is a value here — a grammar — not a
 * code path. The union is the set of languages this module can actually
 * tokenize, so a name it cannot is a compile error rather than a silent plain
 * render; `"text"` is the grammar with no rules.
 */
const GRAMMARS = {
  javascript: grammar(JAVASCRIPT),
  typescript: grammar(JAVASCRIPT.map(([token, source]) =>
    token === "keyword" ? [token, words(`${JS_KEYWORDS} ${TS_KEYWORDS}`)] : [token, source])),
  python: grammar([
    ["comment", "#[^\\n]*"],
    ["string", String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''|${QUOTED}`],
    ["constant", words("True False None")],
    ["keyword", words(
      "def class return if elif else for while in not and or is import from as with try except finally raise " +
      "pass break continue lambda yield global nonlocal assert del async await self cls",
    )],
    ["number", NUMBER],
  ]),
  bash: grammar([
    ["comment", "(?<![^\\s;])#[^\\n]*"],
    ["string", QUOTED],
    ["keyword", words("if then else elif fi for while until do done case esac function in return local export select")],
    ["number", NUMBER],
  ]),
  text: grammar([]),
} satisfies Record<string, RegExp>;

export type SyntaxLanguage = keyof typeof GRAMMARS;

export class Syntax implements Renderable, Measurable {
  readonly code: string;
  readonly language: SyntaxLanguage;
  readonly lineNumbers: boolean;
  readonly startLine: number;
  readonly lineRange: [number, number] | undefined;
  readonly highlightLines: Set<number>;
  readonly wordWrap: boolean;
  readonly tabSize: number;

  constructor(code: string, language: SyntaxLanguage = "text", options?: SyntaxOptions) {
    this.code = code;
    this.language = language;
    this.lineNumbers = options?.lineNumbers ?? false;
    this.startLine = options?.startLine ?? 1;
    this.lineRange = options?.lineRange;
    this.highlightLines = options?.highlightLines ?? new Set();
    this.wordWrap = options?.wordWrap ?? false;
    this.tabSize = options?.tabSize ?? 4;
  }

  /**
   * The lines shown and the number the first is given — render and measure
   * both read them here, so a range or a tab counts the same in each.
   * `lineRange` is 1-based and inclusive, and a line keeps the number it has in
   * the whole code: `[3, 4]` shows lines 3 and 4 numbered 3 and 4 (with a
   * `startLine` of 1), as Rich does.
   */
  private _shown(): { first: number; lines: string[] } {
    const all = this.code.replace(/\t/g, " ".repeat(this.tabSize)).split("\n");
    const [from, to] = this.lineRange ?? [1, all.length];
    return { first: this.startLine + from - 1, lines: all.slice(from - 1, to) };
  }

  /** Digits of the last number, a space, and the `│ ` rule; nothing without numbers. */
  private _gutterWidth(first: number, count: number): number {
    return this.lineNumbers ? String(first + count - 1).length + 3 : 0;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const { first, lines } = this._shown();
    const gutterWidth = this._gutterWidth(first, lines.length);
    const numberStyle = getStyle(options, "syntax.line_number");
    const highlightStyle = getStyle(options, "syntax.line_number.highlight");
    const rule = drawable(options, "│ ", "| ");

    // Tokenized whole, so a block comment or a triple-quoted string that spans
    // lines is one token, then split back into the lines it was joined from.
    const text = new RichText(lines.join("\n"), { end: "" });
    for (const match of text.plain.matchAll(GRAMMARS[this.language])) {
      const [token] = Object.entries(match.groups!).find(([, value]) => value !== undefined)!;
      text.stylize(`syntax.${token}`, match.index, match.index + match[0].length);
    }

    // [LAW:dataflow-not-control-flow] `wordWrap` reaches the line as the
    // overflow it is drawn with, not as a second path: wrapped, a line may
    // become several rows; cropped, it is always one.
    const lineOptions: RenderOptions = {
      ...options,
      maxWidth: options.maxWidth - gutterWidth,
      noWrap: !this.wordWrap,
      overflow: this.wordWrap ? "fold" : "crop",
    };

    const textLines = text.split("\n");
    for (let i = 0; i < textLines.length; i++) {
      const lineNo = first + i;
      const style = this.highlightLines.has(lineNo) ? highlightStyle : numberStyle;
      // Terminated, so an empty line is one empty row rather than none.
      const rows = Segment.splitLines([...textLines[i]!.render(lineOptions), Segment.line()]);
      for (let row = 0; row < rows.length; row++) {
        if (this.lineNumbers) {
          // A wrapped line's continuation rows keep the gutter, unnumbered.
          const label = row === 0 ? String(lineNo) : "";
          yield new Segment(label.padStart(gutterWidth - 3) + " ", style);
          yield new Segment(rule, numberStyle);
        }
        yield* rows[row]!;
        yield Segment.line();
      }
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const { first, lines } = this._shown();
    const widest = Math.max(0, ...lines.map((line) => cellLen(line)));
    return {
      minimum: 10,
      maximum: Math.min(widest + this._gutterWidth(first, lines.length), options.maxWidth),
    };
  }
}
