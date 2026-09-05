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
import type { Highlighter } from "./highlighter.js";
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
  /**
   * How many levels of nesting to descend before eliding. Unbounded by default.
   *
   * `Console.print` supplies a bound because it formats whatever it is handed;
   * a caller constructing a `Pretty` has seen their data and can say what they
   * want. Past the cap a container renders as `[...]`, `{...}`, `Map {...}` or
   * `Set {...}` — visible, so the reader knows the value continues.
   */
  maxDepth?: number;
  indentGuides?: boolean;
  /**
   * Who colours the formatted text. Defaults to a `ReprHighlighter`.
   *
   * Passed rather than imported so a caller's choice survives. `Console.print`
   * routes data arguments through here, and its `highlight` flag and custom
   * `highlighter` have to reach the output the same way they reach a printed
   * string — a `Pretty` reaching for its own singleton would silently outrank
   * both. `NullHighlighter` is the "none" case.
   */
  highlighter?: Highlighter;
}

const reprHighlighter = new ReprHighlighter();

/** One position in a traversal. See `_format` for why `inset` and `level` are two numbers. */
interface Frame {
  readonly inset: number;
  readonly level: number;
  readonly maxWidth: number;
  readonly open: WeakSet<object>;
}

const rootFrame = (maxWidth: number): Frame => ({ inset: 0, level: 0, maxWidth, open: new WeakSet() });

/**
 * The elements of an indexed sequence, or `null` for anything that isn't one.
 *
 * A typed array is an array with a fixed element type, and neither of the two
 * questions asked elsewhere in this file recognises it: `Array.isArray` says
 * false, and its own `toString` answers the bare `1,2,3` — no brackets, nothing
 * for the highlighter to colour per element. Both spellings reach the one arm
 * that knows what a sequence looks like. `DataView` is excluded because it is a
 * window onto bytes, not a sequence of values.
 *
 * Returned as `ArrayLike` rather than a materialised array because both
 * spellings already are one. Converting here would box every element of a
 * multi-megabyte `Buffer` to keep the first `maxLength` of them — bounding the
 * output while leaving the cost of producing it unbounded.
 */
function indexedElements(value: object): ArrayLike<unknown> | null {
  if (Array.isArray(value)) return value as unknown[];
  if (ArrayBuffer.isView(value) && !(value instanceof DataView)) {
    return value as unknown as ArrayLike<unknown>;
  }
  return null;
}

/**
 * What a value renders as when reading it threw instead of producing it.
 *
 * `Pretty` reflects on data it did not create, and every reflection it performs
 * — a property getter, `Object.keys`, an iterator, `toString` — can throw. The
 * message travels into the output, so the failure stays visible and attributed
 * to the position that produced it. [LAW:no-silent-failure] the error is
 * carried rather than swallowed; a marker naming its cause is not an
 * answer-shaped void, and a diagnostic that takes the program down over one
 * lazily-computed field is unusable on the objects it is most wanted for.
 */
function threw(error: unknown): string {
  return `[Threw: ${error instanceof Error ? error.message : String(error)}]`;
}

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
  readonly maxDepth: number;
  readonly indentGuides: boolean;
  readonly highlighter: Highlighter;

  constructor(data: unknown, options?: PrettyOptions) {
    this.data = data;
    this.indent = options?.indent ?? 4;
    this.expandAll = options?.expandAll ?? false;
    this.maxLength = options?.maxLength;
    this.maxString = options?.maxString;
    this.maxDepth = options?.maxDepth ?? Infinity;
    this.indentGuides = options?.indentGuides !== false;
    this.highlighter = options?.highlighter ?? reprHighlighter;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const formatted = this._format(this.data, rootFrame(options.maxWidth));
    const text = new RichText(formatted, { end: "" });
    this.highlighter.highlight(text);

    if (this.indentGuides) {
      this._addIndentGuides(text);
    }

    yield* text.render(options);
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    const formatted = this._format(this.data, rootFrame(_options.maxWidth));
    const lines = formatted.split("\n");
    let max = 0;
    for (const line of lines) {
      max = Math.max(max, cellLen(line));
    }
    return { minimum: 1, maximum: Math.min(max, _options.maxWidth) };
  }

  /**
   * Where the traversal is, in the two senses that differ.
   *
   * `inset` is how far the output is indented; it resets to 0 whenever a value
   * is measured for a single line, because a compact form carries no
   * indentation. `level` is how deep in the data we are, and only ever
   * increases. Collapsing the two into one number is the mistake this pair
   * exists to make unrepresentable: the depth cap read the layout number, so
   * every compact probe reset it and the cap never fired at all.
   *
   * `open` holds the objects between the root and here, not every object seen.
   * A value joins on the way down and leaves on the way back up, so a cycle is
   * caught while a DAG — one object reached twice through sibling positions —
   * still renders both times. A never-emptied set would call the second sibling
   * circular. [LAW:no-ambient-temporal-coupling] the traversal owns its state
   * explicitly; a field on the instance would leak between renders.
   */
  private _format(value: unknown, at: Frame): string {
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

    if (at.open.has(value)) return "[Circular]";
    at.open.add(value);
    try {
      return this._formatObject(value, at);
    } catch (error) {
      // The container's *shape* would not be read — `Object.keys`, an iterator,
      // `toString`. Nothing can be enumerated, so the whole container degrades;
      // a value that merely would not be read degrades alone, in `_property`.
      return threw(error);
    } finally {
      at.open.delete(value);
    }
  }

  /**
   * One key's value, or the marker for why reading it failed.
   *
   * Split out because this is the read that costs the least when it fails:
   * siblings are unaffected, so `{ a: 1, b: [Threw: …], c: 3 }` still shows
   * everything that could be read.
   */
  private _property(obj: Record<string, unknown>, key: string, at: Frame): string {
    try {
      return this._format(obj[key], at);
    } catch (error) {
      return threw(error);
    }
  }

  /** The arms for a non-null object, with `value` already on the open path. */
  private _formatObject(value: object, at: Frame): string {
    const { maxWidth, open } = at;
    const indentStr = " ".repeat(this.indent * at.inset);
    const innerIndent = " ".repeat(this.indent * (at.inset + 1));
    const deeper: Frame = { inset: at.inset + 1, level: at.level + 1, maxWidth, open };
    const onOneLine: Frame = { inset: 0, level: at.level + 1, maxWidth, open };

    const elements = indexedElements(value);
    if (elements !== null) {
      if (elements.length === 0) return "[]";
      if (at.level >= this.maxDepth) return "[...]";

      const items = Array.prototype.slice.call(elements, 0, this.maxLength) as unknown[];
      const remaining = elements.length - items.length;

      // Try compact first
      if (!this.expandAll) {
        const compact = "[" + items.map((v) => this._format(v, onOneLine)).join(", ") +
          (remaining > 0 ? `, ... +${remaining}` : "") + "]";
        if (cellLen(indentStr + compact) <= maxWidth) return compact;
      }

      const parts = items.map((v) => innerIndent + this._format(v, deeper));
      if (remaining > 0) parts.push(innerIndent + `... +${remaining}`);
      return "[\n" + parts.join(",\n") + "\n" + indentStr + "]";
    }

    if (value instanceof Map) {
      if (value.size === 0) return "Map {}";
      if (at.level >= this.maxDepth) return "Map {...}";
      const entries = [...value.entries()];
      const items = this.maxLength !== undefined ? entries.slice(0, this.maxLength) : entries;
      const parts = items.map(([k, v]) =>
        innerIndent + this._format(k, deeper) + " => " + this._format(v, deeper),
      );
      const dropped = entries.length - items.length;
      if (dropped > 0) parts.push(innerIndent + `... +${dropped}`);
      return "Map {\n" + parts.join(",\n") + "\n" + indentStr + "}";
    }

    if (value instanceof Set) {
      if (value.size === 0) return "Set {}";
      if (at.level >= this.maxDepth) return "Set {...}";
      const items = [...value];
      const bounded = this.maxLength !== undefined ? items.slice(0, this.maxLength) : items;
      const parts = bounded.map((v) => innerIndent + this._format(v, deeper));
      const dropped = items.length - bounded.length;
      if (dropped > 0) parts.push(innerIndent + `... +${dropped}`);
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
      if (at.level >= this.maxDepth) return "{...}";

      const items = this.maxLength !== undefined ? keys.slice(0, this.maxLength) : keys;
      const remaining = this.maxLength !== undefined ? Math.max(0, keys.length - this.maxLength) : 0;

      // Try compact
      if (!this.expandAll) {
        const compact = "{ " + items.map((k) =>
          `${k}: ${this._property(obj, k, onOneLine)}`).join(", ") +
          (remaining > 0 ? `, ... +${remaining}` : "") + " }";
        if (cellLen(indentStr + compact) <= maxWidth) return compact;
      }

      const parts = items.map((k) =>
        innerIndent + `${k}: ${this._property(obj, k, deeper)}`,
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
