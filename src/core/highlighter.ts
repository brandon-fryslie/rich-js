/**
 * Highlighters — apply styled spans to RichText based on pattern matching.
 */

import { RichText } from "./text.js";

// --- Base ---

export abstract class Highlighter {
  abstract highlight(text: RichText): void;

  call(input: string): RichText {
    const text = new RichText(input);
    this.highlight(text);
    return text;
  }
}

// --- NullHighlighter ---

export class NullHighlighter extends Highlighter {
  highlight(_text: RichText): void {
    // No-op
  }
}

// --- RegexHighlighter ---

export class RegexHighlighter extends Highlighter {
  static highlights: (string | RegExp)[] = [];
  static baseStyle = "";

  highlight(text: RichText): void {
    const ctor = this.constructor as typeof RegexHighlighter;
    const baseStyle = ctor.baseStyle;

    for (const pattern of ctor.highlights) {
      const re =
        pattern instanceof RegExp
          ? new RegExp(pattern.source, pattern.flags.includes("g") ? pattern.flags : pattern.flags + "g")
          : new RegExp(pattern, "g");

      let match: RegExpExecArray | null;
      while ((match = re.exec(text.plain)) !== null) {
        if (match[0].length === 0) {
          re.lastIndex++;
          continue;
        }

        if (match.groups) {
          let searchFrom = 0;
          for (const [groupName, groupValue] of Object.entries(match.groups)) {
            if (groupValue !== undefined) {
              const posInMatch = match[0].indexOf(groupValue, searchFrom);
              if (posInMatch >= 0) {
                const start = match.index + posInMatch;
                text.stylize(
                  `${baseStyle}${groupName}`,
                  start,
                  start + groupValue.length,
                );
                searchFrom = posInMatch + groupValue.length;
              }
            }
          }
        }
      }
    }
  }
}

// --- ReprHighlighter ---

// [LAW:one-type-per-behavior] All repr patterns use the same RegexHighlighter mechanism
export class ReprHighlighter extends RegexHighlighter {
  static baseStyle = "repr.";
  static highlights = [
    // URLs
    /(?<url>https?:\/\/[^\s<>"']+)/g,
    // UUIDs
    /(?<uuid>[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/gi,
    // Quoted strings
    /(?<str>'[^']*'|"[^"]*")/g,
    // Booleans
    /(?<bool>\btrue\b|\bfalse\b)/g,
    // None/null/undefined
    /(?<none>\bnull\b|\bundefined\b|\bNone\b)/g,
    // Numbers (integers and floats)
    /(?<number>(?<!\w)-?(?:0x[0-9a-f]+|\d+(?:\.\d+)?(?:e[+-]?\d+)?)(?!\w))/gi,
  ];
}

// --- JSONHighlighter ---

export class JSONHighlighter extends RegexHighlighter {
  static baseStyle = "json.";
  static highlights = [
    /(?<key>"[^"]*")\s*:/g,
    /:\s*(?<str>"[^"]*")/g,
    /(?<bool>\btrue\b|\bfalse\b)/g,
    /(?<null>\bnull\b)/g,
    /(?<number>-?\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)/g,
    /(?<brace>[{}[\]])/g,
  ];
}

// --- ISO8601Highlighter ---

export class ISO8601Highlighter extends RegexHighlighter {
  static baseStyle = "iso8601.";
  static highlights = [
    /(?<date>\d{4}-\d{2}-\d{2})/g,
    /(?<time>\d{2}:\d{2}:\d{2}(?:\.\d+)?)/g,
    /(?<timezone>[+-]\d{2}:\d{2}|Z)/g,
  ];
}
