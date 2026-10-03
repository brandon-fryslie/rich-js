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
      // `d` reports where each group matched, as Python's `match.span(name)`
      // does; searching the match for the group's text finds the first copy
      // of it, which is not always the one the group captured.
      const source = pattern instanceof RegExp ? pattern.source : pattern;
      const flags = new Set([...(pattern instanceof RegExp ? pattern.flags : ""), "g", "d"]);
      for (const match of text.plain.matchAll(new RegExp(source, [...flags].join("")))) {
        if (match.indices === undefined) throw new Error("a match of a `d`-flag pattern carries indices");
        // Group definition order, as Rich's `groupdict()`: a later group's span
        // lands on top of an earlier one's.
        for (const [groupName, span] of Object.entries(match.indices.groups ?? {})) {
          if (span === undefined || span[1] <= span[0]) continue;
          const style = isNamespace ? `${baseStyle}${groupName}` : baseStyle || groupName;
          text.stylize(style, span[0], span[1]);
        }
      }
    }
  }
}

// --- ReprHighlighter ---

// Rich 15.0.0's patterns, compiled for the `u` flag. Python's `\w`, `\b` and
// `\d` are Unicode-aware on a `str`; JavaScript's are ASCII even under `u`, so
// `café=1` would lose its attribute name. Each is spelled out below. `.` is
// `[^\n]` because Python's dot stops only at `\n`, JavaScript's at `\r` too.
const W = String.raw`\p{L}\p{N}_`;
const WB = String.raw`(?:(?<=[${W}])(?![${W}])|(?<![${W}])(?=[${W}]))`;
const NWB = String.raw`(?:(?<=[${W}])(?=[${W}])|(?<![${W}])(?![${W}]))`;
const D = String.raw`\p{Nd}`;

// [LAW:one-type-per-behavior] All repr patterns use the same RegexHighlighter mechanism
export class ReprHighlighter extends RegexHighlighter {
  static override baseStyle = "repr.";
  static override highlights = [
    new RegExp(String.raw`(?<tag_start><)(?<tag_name>[\-${W}.:|]*)(?<tag_contents>[^]*)(?<tag_end>>)`, "u"),
    new RegExp(String.raw`(?<attrib_name>[${W}]{1,50})=(?<attrib_value>"?[${W}]+"?)?`, "u"),
    new RegExp(String.raw`(?<brace>[\][{}()])`, "u"),
    // [LAW:dataflow-not-control-flow] One alternation, scanned once, as Rich's
    // `_combine_regex` joins it: where two could match, the earlier claims it.
    new RegExp(
      [
        String.raw`(?<ipv4>[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3})`,
        String.raw`(?<ipv6>([A-Fa-f0-9]{1,4}::?){1,7}[A-Fa-f0-9]{1,4})`,
        String.raw`(?<eui64>(?:[0-9A-Fa-f]{1,2}-){7}[0-9A-Fa-f]{1,2}|(?:[0-9A-Fa-f]{1,2}:){7}[0-9A-Fa-f]{1,2}|(?:[0-9A-Fa-f]{4}\.){3}[0-9A-Fa-f]{4})`,
        String.raw`(?<eui48>(?:[0-9A-Fa-f]{1,2}-){5}[0-9A-Fa-f]{1,2}|(?:[0-9A-Fa-f]{1,2}:){5}[0-9A-Fa-f]{1,2}|(?:[0-9A-Fa-f]{4}\.){2}[0-9A-Fa-f]{4})`,
        String.raw`(?<uuid>[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12})`,
        String.raw`(?<call>[${W}.]*?)\(`,
        // JavaScript's `true`, `false`, `null` and `undefined` beside Python's
        // names: `Pretty` draws JavaScript values through this highlighter.
        String.raw`${WB}(?<bool_true>True|true)${WB}|${WB}(?<bool_false>False|false)${WB}|${WB}(?<none>None|null|undefined)${WB}`,
        String.raw`(?<ellipsis>\.\.\.)`,
        String.raw`(?<number_complex>(?<![${W}])(?:-?[0-9]+\.?[0-9]*(?:e[\-+]?${D}+?)?)(?:[\-+](?:[0-9]+\.?[0-9]*(?:e[\-+]?${D}+)?))?j)`,
        String.raw`(?<number>(?<![${W}])-?[0-9]+\.?[0-9]*(e[\-+]?${D}+?)?${WB}|0x[0-9a-fA-F]*)`,
        String.raw`(?<path>${NWB}(\/[\-${W}._+]+)*\/)(?<filename>[\-${W}._+]*)?`,
        String.raw`(?<![\\${W}])(?<str>b?'''[^\n]*?(?<!\\)'''|b?'[^\n]*?(?<!\\)'|b?"""[^\n]*?(?<!\\)"""|b?"[^\n]*?(?<!\\)")`,
        String.raw`(?<url>(file|https|http|ws|wss):\/\/[\-0-9a-zA-Z$_+!\x60(),.?\/;:&=%#~@]*)`,
      ].join("|"),
      "u",
    ),
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

// Rich 15.0.0's patterns, after the Regular Expressions Cookbook recipes it
// cites. Each matches a whole string that is one ISO 8601 value, never a value
// inside other text. Python's `$` also matches before a final `\n`, which
// JavaScript's does not; `END` is Python's.
const END = String.raw`(?=\n?$)`;
const YEAR = String.raw`(?<year>[0-9]{4})`;
const MONTH = String.raw`(?<month>1[0-2]|0[1-9])`;
const DAY = String.raw`(?<day>3[01]|0[1-9]|[12][0-9])`;
const HOUR = String.raw`(?<hour>2[0-3]|[01][0-9])`;
const MINUTE = String.raw`(?<minute>[0-5][0-9])`;
const SECOND = String.raw`(?<second>[0-5][0-9])`;
const WEEK = String.raw`(?<week>5[0-3]|[1-4][0-9]|0[1-9])`;
const TZ_HOUR = String.raw`[+-](?:2[0-3]|[01][0-9])`;
const XSD_DATE = String.raw`(?<date>(?<year>-?(?:[1-9][0-9]*)?[0-9]{4})-${MONTH}-${DAY})`;
const XSD_TZ = String.raw`(?<timezone>Z|${TZ_HOUR}:[0-5][0-9])?`;

export class ISO8601Highlighter extends RegexHighlighter {
  static override baseStyle = "iso8601.";
  static override highlights = [
    // Dates
    `^${YEAR}-${MONTH}${END}`,
    `^(?<date>${YEAR}${MONTH}${DAY})${END}`,
    String.raw`^(?<date>${YEAR}-?(?<day>36[0-6]|3[0-5][0-9]|[12][0-9]{2}|0[1-9][0-9]|00[1-9]))${END}`,
    // Weeks
    `^(?<date>${YEAR}-?W${WEEK})${END}`,
    `^(?<date>${YEAR}-?W${WEEK}-?(?<day>[1-7]))${END}`,
    // Times
    `^(?<time>${HOUR}:?${MINUTE})${END}`,
    `^(?<time>${HOUR}${MINUTE}${SECOND})${END}`,
    `^(?<timezone>(Z|${TZ_HOUR}(?::?(?:[0-5][0-9]))?))${END}`,
    `^(?<time>${HOUR}${MINUTE}${SECOND})(?<timezone>Z|${TZ_HOUR}(?::?(?:[0-5][0-9]))?)${END}`,
    // Date and time. Rich writes this as one pattern whose `-` and `:`
    // separators are all present or all absent, keyed on a Python conditional
    // group JavaScript lacks; it is the two spellings here, adjacent, so the
    // one that matches lays its spans where Rich's single pattern would.
    `^(?<date>${YEAR}(?<hyphen>-)${MONTH}-${DAY}) (?<time>${HOUR}:${MINUTE}:${SECOND})${END}`,
    `^(?<date>${YEAR}${MONTH}${DAY}) (?<time>${HOUR}${MINUTE}${SECOND})${END}`,
    // XML Schema date, time and dateTime
    `^${XSD_DATE}${XSD_TZ}${END}`,
    String.raw`^(?<time>${HOUR}:${MINUTE}:${SECOND}(?<frac>\.[0-9]+)?)${XSD_TZ}${END}`,
    String.raw`^${XSD_DATE}T(?<time>${HOUR}:${MINUTE}:${SECOND}(?<ms>\.[0-9]+)?)${XSD_TZ}${END}`,
  ];
}
