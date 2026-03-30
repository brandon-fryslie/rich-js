/**
 * Syntax — renders source code with basic syntax highlighting.
 * Uses built-in tokenization (no external dependency).
 */

import { cellLen } from "../core/cells.js";
import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { RichText } from "../core/text.js";
import type { PaddingDimensions } from "./padding.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export interface SyntaxOptions {
  lineNumbers?: boolean;
  theme?: string;
  startLine?: number;
  lineRange?: [number, number];
  highlightLines?: Set<number>;
  wordWrap?: boolean;
  tabSize?: number;
  padding?: PaddingDimensions;
}

// Built-in token patterns for common languages
const TOKEN_PATTERNS: Record<string, [RegExp, string][]> = {
  _default: [
    [/\/\/.*$/gm, "comment"],
    [/\/\*[\s\S]*?\*\//g, "comment"],
    [/#.*$/gm, "comment"],
    [/"(?:[^"\\]|\\.)*"/g, "string"],
    [/'(?:[^'\\]|\\.)*'/g, "string"],
    [/`(?:[^`\\]|\\.)*`/g, "string"],
    [/\b(?:true|false|null|undefined|NaN|Infinity)\b/g, "keyword.constant"],
    [/\b(?:function|class|const|let|var|return|if|else|for|while|do|switch|case|break|continue|new|throw|try|catch|finally|import|export|from|default|async|await|yield|of|in|typeof|instanceof|void|delete)\b/g, "keyword"],
    [/\b(?:def|lambda|with|as|pass|raise|elif|except|print|self|cls|None|True|False)\b/g, "keyword"],
    [/\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b/g, "number"],
    [/\b0x[0-9a-fA-F]+\b/g, "number"],
  ],
};

const TOKEN_STYLES: Record<string, Style> = {
  "keyword": Style.parse("bold magenta"),
  "keyword.constant": Style.parse("italic bright_magenta"),
  "string": Style.parse("green"),
  "number": Style.parse("cyan"),
  "comment": Style.parse("dim italic"),
};

export class Syntax implements Renderable, Measurable {
  readonly code: string;
  readonly language: string;
  readonly lineNumbers: boolean;
  readonly startLine: number;
  readonly lineRange: [number, number] | undefined;
  readonly highlightLines: Set<number>;
  readonly wordWrap: boolean;
  readonly tabSize: number;

  constructor(code: string, language?: string, options?: SyntaxOptions) {
    this.code = code;
    this.language = language ?? "text";
    this.lineNumbers = options?.lineNumbers ?? false;
    this.startLine = options?.startLine ?? 1;
    this.lineRange = options?.lineRange;
    this.highlightLines = options?.highlightLines ?? new Set();
    this.wordWrap = options?.wordWrap ?? false;
    this.tabSize = options?.tabSize ?? 4;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const expandedCode = this.code.replace(/\t/g, " ".repeat(this.tabSize));
    let lines = expandedCode.split("\n");

    // Apply line range
    if (this.lineRange) {
      const [start, end] = this.lineRange;
      lines = lines.slice(start - 1, end);
    }

    const lineNumWidth = this.lineNumbers
      ? String(this.startLine + lines.length - 1).length + 1
      : 0;

    // Tokenize the full text for highlighting
    const text = new RichText(lines.join("\n"), { end: "" });
    this._highlight(text);

    const textLines = text.split("\n");

    for (let i = 0; i < textLines.length; i++) {
      const lineNo = this.startLine + i;
      const isHighlighted = this.highlightLines.has(lineNo);

      if (this.lineNumbers) {
        const numStr = String(lineNo).padStart(lineNumWidth - 1) + " ";
        const numStyle = isHighlighted
          ? Style.parse("bold on grey27")
          : Style.parse("dim");
        yield new Segment(numStr, numStyle);
        yield new Segment("│ ", Style.parse("dim"));
      }

      const line = textLines[i]!;
      const segs = [...line.render({ ...options, maxWidth: options.maxWidth - lineNumWidth - 2 })];
      // Filter out trailing newline from render
      for (const seg of segs) {
        if (seg.text !== "\n") yield seg;
      }

      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const lines = this.code.split("\n");
    let maxLine = 0;
    for (const line of lines) {
      maxLine = Math.max(maxLine, cellLen(line));
    }
    const lineNumWidth = this.lineNumbers
      ? String(this.startLine + lines.length - 1).length + 3
      : 0;
    return {
      minimum: 10,
      maximum: Math.min(maxLine + lineNumWidth, options.maxWidth),
    };
  }

  private _highlight(text: RichText): void {
    const patterns = TOKEN_PATTERNS["_default"] ?? [];
    for (const [pattern, tokenType] of patterns) {
      const style = TOKEN_STYLES[tokenType];
      if (style) {
        text.highlightRegex(pattern, style);
      }
    }
  }

  static fromPath(_filePath: string, _options?: SyntaxOptions): Syntax {
    // In a real implementation, this would read the file and detect language
    throw new Error("Syntax.fromPath requires file system access — use the constructor with code string instead");
  }
}
