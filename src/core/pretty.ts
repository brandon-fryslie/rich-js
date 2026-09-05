/**
 * Pretty — formats JavaScript data structures with highlighting.
 *
 * Lives in `core/` beside `markup` and `emoji` because it does their job: turn
 * foreign input into `RichText`. It composes no other renderable — the trait
 * every file in `renderables/` shares and this one does not — and its imports
 * are core primitives only. `Console.print` accepts `unknown` and must turn any
 * of it into something renderable, so the formatter has to sit where `console`
 * can reach it without an upward edge. [LAW:one-way-deps]
 */

import { cellLen } from "./cells.js";
import { Segment } from "./segment.js";
import { Style } from "./style.js";
import { RichText } from "./text.js";
import { ReprHighlighter } from "./highlighter.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "./protocol.js";

export interface PrettyOptions {
  indent?: number;
  expandAll?: boolean;
  maxLength?: number;
  maxString?: number;
  indentGuides?: boolean;
}

const reprHighlighter = new ReprHighlighter();

/**
 * Does this value carry its own string form, or must we reflect on its keys?
 *
 * A `Date`, an `Error`, a `RegExp`, or any object that defines `toString`
 * answers the display question itself, and reflecting on such a value throws
 * that answer away — `Object.keys(new Date())` is empty, so key-reflection
 * renders it `{}`. Inheriting `Object.prototype.toString` is the opposite
 * signal: it yields `[object Object]`, a non-answer, so the keys are all the
 * information there is.
 *
 * Both clauses are load-bearing. The identity check separates the two
 * populations; the `typeof` check is what makes `Object.create(null)` — which
 * has no `toString` at all — reflect rather than throw.
 * [LAW:parse-dont-validate] The question is asked once, here, and the branch it
 * selects is the whole answer; nothing downstream re-asks it.
 */
function describesItself(value: object): boolean {
  const asRecord = value as { toString?: unknown; [Symbol.toPrimitive]?: unknown };
  return (
    typeof asRecord[Symbol.toPrimitive] === "function" ||
    (typeof asRecord.toString === "function" &&
      asRecord.toString !== Object.prototype.toString)
  );
}

export class Pretty implements Renderable, Measurable {
  readonly data: unknown;
  readonly indent: number;
  readonly expandAll: boolean;
  readonly maxLength: number | undefined;
  readonly maxString: number | undefined;
  readonly indentGuides: boolean;

  constructor(data: unknown, options?: PrettyOptions) {
    this.data = data;
    this.indent = options?.indent ?? 4;
    this.expandAll = options?.expandAll ?? false;
    this.maxLength = options?.maxLength;
    this.maxString = options?.maxString;
    this.indentGuides = options?.indentGuides !== false;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const formatted = this._format(this.data, 0, options.maxWidth);
    const text = new RichText(formatted, { end: "" });
    reprHighlighter.highlight(text);

    if (this.indentGuides) {
      this._addIndentGuides(text);
    }

    yield* text.render(options);
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const formatted = this._format(this.data, 0, _options.maxWidth);
    const lines = formatted.split("\n");
    let max = 0;
    for (const line of lines) {
      max = Math.max(max, cellLen(line));
    }
    return { minimum: 1, maximum: Math.min(max, _options.maxWidth) };
  }

  private _format(value: unknown, depth: number, maxWidth: number): string {
    const indentStr = " ".repeat(this.indent * depth);
    const innerIndent = " ".repeat(this.indent * (depth + 1));

    if (value === null) return "null";
    if (value === undefined) return "undefined";

    switch (typeof value) {
      case "string": {
        let str = value;
        if (this.maxString !== undefined && str.length > this.maxString) {
          str = str.slice(0, this.maxString) + `+${value.length - this.maxString}`;
        }
        return JSON.stringify(str);
      }
      case "number":
      case "bigint":
        return String(value);
      case "boolean":
        return String(value);
      case "symbol":
        return value.toString();
      case "function":
        return `[Function: ${value.name || "anonymous"}]`;
    }

    if (Array.isArray(value)) {
      if (value.length === 0) return "[]";

      const items = this.maxLength !== undefined
        ? value.slice(0, this.maxLength)
        : value;
      const remaining = this.maxLength !== undefined
        ? Math.max(0, value.length - this.maxLength)
        : 0;

      // Try compact first
      if (!this.expandAll) {
        const compact = "[" + items.map((v) => this._format(v, 0, maxWidth)).join(", ") +
          (remaining > 0 ? `, ... +${remaining}` : "") + "]";
        if (cellLen(indentStr + compact) <= maxWidth) return compact;
      }

      const parts = items.map((v) => innerIndent + this._format(v, depth + 1, maxWidth));
      if (remaining > 0) parts.push(innerIndent + `... +${remaining}`);
      return "[\n" + parts.join(",\n") + "\n" + indentStr + "]";
    }

    if (value instanceof Map) {
      if (value.size === 0) return "Map {}";
      const entries = [...value.entries()];
      const items = this.maxLength !== undefined ? entries.slice(0, this.maxLength) : entries;
      const parts = items.map(([k, v]) =>
        innerIndent + this._format(k, depth + 1, maxWidth) + " => " + this._format(v, depth + 1, maxWidth),
      );
      return "Map {\n" + parts.join(",\n") + "\n" + indentStr + "}";
    }

    if (value instanceof Set) {
      if (value.size === 0) return "Set {}";
      const items = [...value];
      const bounded = this.maxLength !== undefined ? items.slice(0, this.maxLength) : items;
      const parts = bounded.map((v) => innerIndent + this._format(v, depth + 1, maxWidth));
      return "Set {\n" + parts.join(",\n") + "\n" + indentStr + "}";
    }

    // Objects that answer the display question themselves. Sits below the
    // Array/Map/Set arms deliberately: an array also overrides `toString`, but
    // "1,2,3" is a poorer answer than the structural form above.
    if (describesItself(value)) return String(value);

    // Plain objects — no self-description, so the keys are the whole story.
    {
      const obj = value as Record<string, unknown>;
      const keys = Object.keys(obj);
      if (keys.length === 0) return "{}";

      const items = this.maxLength !== undefined ? keys.slice(0, this.maxLength) : keys;
      const remaining = this.maxLength !== undefined ? Math.max(0, keys.length - this.maxLength) : 0;

      // Try compact
      if (!this.expandAll) {
        const compact = "{ " + items.map((k) =>
          `${k}: ${this._format(obj[k], 0, maxWidth)}`).join(", ") +
          (remaining > 0 ? `, ... +${remaining}` : "") + " }";
        if (cellLen(indentStr + compact) <= maxWidth) return compact;
      }

      const parts = items.map((k) =>
        innerIndent + `${k}: ${this._format(obj[k], depth + 1, maxWidth)}`,
      );
      if (remaining > 0) parts.push(innerIndent + `... +${remaining}`);
      return "{\n" + parts.join(",\n") + "\n" + indentStr + "}";
    }
  }

  private _addIndentGuides(text: RichText): void {
    const guideStyle = Style.parse("repr.indent");
    const lines = text.plain.split("\n");
    let offset = 0;
    for (const line of lines) {
      const leadingSpaces = line.length - line.trimStart().length;
      for (let i = 0; i < leadingSpaces; i += this.indent) {
        if (i + offset < text.length) {
          text.stylize(guideStyle, offset + i, offset + i + 1);
        }
      }
      offset += line.length + 1; // +1 for newline
    }
  }
}
