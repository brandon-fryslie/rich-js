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
  /** Style applied to matches. When ending with "." it acts as a namespace
   *  prefix: named groups become `baseStyle + groupName` (e.g. "repr." + "url"
   *  → "repr.url"). Otherwise it's used as a literal style for all matches
   *  (e.g. "bold red" applies "bold red" to every named group). */
  static baseStyle = "";

  highlight(text: RichText): void {
    const ctor = this.constructor as typeof RegexHighlighter;
    const baseStyle = ctor.baseStyle;
    // Namespace mode: "repr." + groupName → "repr.url"
    // Literal mode: "bold red" → applied directly to every match
    const isNamespace = baseStyle.endsWith(".");

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
                const style = isNamespace
                  ? `${baseStyle}${groupName}`
                  : baseStyle || groupName;
                text.stylize(style, start, start + groupValue.length);
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
  static override baseStyle = "repr.";
  static override highlights = [
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

// A JSON string as Python Rich 9d8f9a3 matches one, `b` bytes prefix included:
// an opening quote with no backslash or word character before it, through the
// first quote with no backslash before it, so an escaped quote stays inside.
const JSON_STR = String.raw`(?<![\\\w])(?<str>b?".*?(?<!\\)")`;

export class JSONHighlighter extends RegexHighlighter {
  static override baseStyle = "json.";
  // [LAW:dataflow-not-control-flow] One alternation, scanned once, as Rich's
  // `_combine_regex` joins it. A token claims its characters where the scan
  // meets it, so the `true` and `12` inside `"true 12"` belong to the string.
  static override highlights = [
    [
      String.raw`(?<brace>[\{\[\(\)\]\}])`,
      String.raw`\b(?<bool_true>true)\b|\b(?<bool_false>false)\b|\b(?<null>null)\b`,
      String.raw`(?<number>(?<!\w)\-?[0-9]+\.?[0-9]*(e[\-\+]?\d+?)?\b|0x[0-9a-fA-F]*)`,
      JSON_STR,
    ].join("|"),
  ];

  // A string followed by a colon is also a key. Its `json.key` span comes after
  // its `json.str` span, so the key style lands on top. Each string is found on
  // its own and then checked for a colon. One `string(?=:)` pattern would get
  // this wrong: its lazy body can stretch past a value's closing quote to the
  // next key's, marking `"b", "c"` in `{"a": "b", "c": 1}` as one key.
  override highlight(text: RichText): void {
    super.highlight(text);
    const colon = /[ \n\r\t]*:/y;
    for (const { index, 0: str } of text.plain.matchAll(new RegExp(JSON_STR, "g"))) {
      const end = index + str.length;
      colon.lastIndex = end;
      if (colon.test(text.plain)) text.stylize("json.key", index, end);
    }
  }
}

// --- ISO8601Highlighter ---

export class ISO8601Highlighter extends RegexHighlighter {
  static override baseStyle = "iso8601.";
  static override highlights = [
    /(?<date>\d{4}-\d{2}-\d{2})/g,
    /(?<time>\d{2}:\d{2}:\d{2}(?:\.\d+)?)/g,
    /(?<timezone>[+-]\d{2}:\d{2}|Z)/g,
  ];
}
