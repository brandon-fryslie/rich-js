/**
 * Pretty — formats JavaScript data structures with highlighting.
 *
 * Lives in `core/` beside `markup` and `emoji` because it does their job: turn
 * foreign input into `RichText`. It composes no other renderable — the trait
 * every file in `renderables/` shares and this one does not — and its imports
 * are core primitives only. `Console.print` accepts `unknown` and must turn any
 * of it into something renderable, so the formatter has to sit where `console`
 * can reach it without an upward edge. [LAW:one-way-deps]
 *
 * Two traversals share this file, and the split is the whole design. `_format`
 * lays a value out across lines; `_oneLine` answers only "does this fit on one
 * line, and if so what is it?". They meet at `_shape`, which describes a
 * container without committing to either layout. One traversal answering both
 * questions is what made this formatter exponential: every child was rendered
 * once to probe it and again to place it, so a node at depth d was visited 2^d
 * times.
 */

import { cellLen } from "./cells.js";
import { Segment } from "./segment.js";
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

/**
 * Where a laying-out traversal is: how far the output is indented (`inset`),
 * and how deep in the data we are (`level`).
 *
 * The two are separate numbers because they answer to different things —
 * `level` is what `maxDepth` caps, and only ever increases. Collapsing them
 * made the cap read the layout number, and every compact probe reset it, so the
 * cap never fired at all. `Probe` is why that cannot recur: the traversal that
 * used to do the resetting has no `inset` to reset.
 *
 * `open` holds the objects between the root and here, not every object seen. A
 * value joins on the way down and leaves on the way back up, so a cycle is
 * caught while a DAG — one object reached twice through sibling positions —
 * still renders both times. A never-emptied set would call the second sibling
 * circular. [LAW:no-ambient-temporal-coupling] the traversal owns its state
 * explicitly; a field on the instance would leak between renders.
 */
interface Frame {
  readonly inset: number;
  readonly level: number;
  readonly maxWidth: number;
  readonly open: WeakSet<object>;
}

const rootFrame = (maxWidth: number): Frame => ({ inset: 0, level: 0, maxWidth, open: new WeakSet() });

/**
 * Where a fits-on-one-line traversal is.
 *
 * [LAW:types-are-the-program] It carries no `inset`, and that absence is the
 * point: a single-line form is the same string wherever it lands, so an
 * indented one is not a state worth being able to write down. The old code said
 * this by setting `inset: 0` on a `Frame` and trusting every arm to leave it
 * alone.
 *
 * `budget` is the cells still available on the line. It replaces the full width
 * because a one-line form wider than its budget is never used for anything, so
 * producing it is waste — and refusing to produce it is what stops an ancestor's
 * probe from walking a subtree it has already outgrown. That short-circuit is
 * what makes the traversal linear in depth rather than exponential.
 */
interface Probe {
  readonly level: number;
  readonly budget: number;
  readonly open: WeakSet<object>;
}

/**
 * The text, when it is a single line no wider than `budget` — otherwise `null`.
 *
 * The one definition of "fits on one line" in this file, and it has to name
 * both halves: `cellLen` scores a newline as zero cells, so a width check alone
 * accepted multi-line text as compact. That is how a `Map` nested in an object
 * used to render as `{ m: Map {` — a one-line object with an expansion wedged
 * inside it and the closing brace back at column 0.
 */
function fitOneLine(text: string, budget: number): string | null {
  return text.includes("\n") || cellLen(text) > budget ? null : text;
}

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
 * The first `limit` items of a sequence, pulled and no more.
 *
 * A `Map` or `Set` reaches its size through `.size`, which iterates nothing, so
 * spreading one only ever served to throw the tail away — `print` of a
 * half-million-entry cache walked all of it to show a hundred. `Infinity` is
 * the unbounded case and never breaks.
 */
function take<T>(source: Iterable<T>, limit: number): T[] {
  const taken: T[] = [];
  if (limit <= 0) return taken;
  for (const item of source) {
    taken.push(item);
    if (taken.length >= limit) break;
  }
  return taken;
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

/**
 * One value inside a slot, and the literal text that follows it.
 *
 * `read` is deferred rather than a value already in hand because reading is
 * itself the reflection that can throw, and each traversal wants to catch that
 * at its own position. A `Map` entry is the reason a slot holds a list of these
 * rather than a single value: its key is a formatted value too, so `1 => 2` is
 * two holes joined by literal text.
 */
interface Hole {
  readonly read: () => unknown;
  readonly tail: string;
}

/**
 * One position in a container: literal text, then values with text between.
 *
 * `{ head: "... +3", holes: [] }` is the elision marker — one more position in
 * the sequence rather than a suffix glued on after a separator, so a bound of
 * zero does not lead with the comma it was supposed to follow.
 */
interface Slot {
  readonly head: string;
  readonly holes: readonly Hole[];
}

/**
 * What an object renders as, said without committing to a layout.
 *
 * This is the seam between the two traversals. `text` is a value that spells
 * itself and is done; a container names the brackets it wears and the positions
 * inside it, and each traversal joins those positions its own way. Both
 * traversals therefore agree on what a `Map` is called, where the elision
 * marker goes, and what an empty one looks like, because there is one
 * description and not two. [LAW:one-source-of-truth]
 */
interface Container {
  readonly kind: "container";
  readonly open: string;
  readonly close: string;
  /** What separates the brackets from the items on one line: `{ a: 1 }` vs `[1]`. */
  readonly pad: string;
  readonly slots: readonly Slot[];
}

type Shape = { readonly kind: "text"; readonly text: string } | Container;

/** What joins a container's positions on one line. Its width is charged for, so it is named once. */
const SEPARATOR = ", ";

/** The marker for positions the bound dropped, or nothing when it dropped none. */
const elided = (dropped: number): Slot[] =>
  dropped > 0 ? [{ head: `... +${dropped}`, holes: [] }] : [];


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
   * The text a value shows without being reflected on, or `null` when it is an
   * object and the shape arms own it.
   *
   * Every kind answered here renders the same wherever it sits — no
   * indentation, no width to fit — which is why one method serves both
   * traversals.
   */
  private _scalar(value: unknown): string | null {
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
      case "boolean":
        return String(value);
      case "symbol":
        return value.toString();
      case "function":
        return `[Function: ${value.name || "anonymous"}]`;
    }

    return null;
  }

  /**
   * A container, or the text standing in for one that is empty or past the
   * depth cap.
   *
   * `positions` is a thunk because both of those answers are reachable from
   * `size` alone, and reaching a position is not free: a `Map` or `Set` reaches
   * its own through an iterator, so enumerating one only to elide it drains a
   * container to print `Set {...}`. `size` also says how many positions were
   * dropped, which is where the elision marker comes from — one derivation, so
   * the count and the bound cannot disagree.
   */
  private _container(
    open: string,
    close: string,
    pad: string,
    size: number,
    level: number,
    positions: () => Slot[],
  ): Shape {
    if (size === 0) return { kind: "text", text: open + close };
    if (level >= this.maxDepth) return { kind: "text", text: open + "..." + close };

    const slots = positions();
    return { kind: "container", open, close, pad, slots: [...slots, ...elided(size - slots.length)] };
  }

  /**
   * The brackets and positions of an object, layout-free. See `Shape`.
   *
   * `bound` is the most positions the caller could ever use. Laying out passes
   * `Infinity`, because it prints every position it is handed. A probe passes
   * what is left of its line, which is already more positions than a fitting
   * one could hold — `SEPARATOR` charges two cells apiece, so a container with
   * more positions than `budget` overruns however narrow its contents are.
   * Reaching past it only ever feeds a join that returns `null`, and reaching a
   * position is what drains a `Map` or `Set`.
   */
  private _shape(value: object, level: number, bound: number): Shape {
    // Clamped because a probe's budget goes negative once a line is overrun,
    // and `slice` reads a negative end as counting from the far end — it would
    // keep all but the last few keys where the other arms take none.
    const cap = Math.max(0, Math.min(this.maxLength ?? Infinity, bound));

    const elements = indexedElements(value);
    if (elements !== null) {
      return this._container("[", "]", "", elements.length, level, () => {
        // Positions rather than values: each index is read in its own slot, so
        // one throwing accessor costs its own slot, not the whole sequence.
        const shown = Math.min(elements.length, cap);
        return Array.from({ length: shown }, (_, i): Slot => ({
          head: "",
          holes: [{ read: () => elements[i], tail: "" }],
        }));
      });
    }

    if (value instanceof Map) {
      return this._container("Map {", "}", " ", value.size, level, () =>
        take(value.entries(), cap).map(([k, v]): Slot => ({
          head: "",
          holes: [{ read: () => k, tail: " => " }, { read: () => v, tail: "" }],
        })),
      );
    }

    if (value instanceof Set) {
      return this._container("Set {", "}", " ", value.size, level, () =>
        take(value, cap).map((v): Slot => ({
          head: "",
          holes: [{ read: () => v, tail: "" }],
        })),
      );
    }

    // Objects that answer the display question themselves. Sits below the
    // Array/Map/Set arms deliberately: an array also overrides `toString`, but
    // "1,2,3" is a poorer answer than the structural form above.
    if (describesItself(value)) return { kind: "text", text: String(value) };

    // Plain objects — no self-description, so the keys are the whole story.
    const obj = value as Record<string, unknown>;
    const keys = Object.keys(obj);
    return this._container("{", "}", " ", keys.length, level, () =>
      keys.slice(0, cap).map((k): Slot => ({
        head: `${k}: `,
        holes: [{ read: () => obj[k], tail: "" }],
      })),
    );
  }

  /** The laid-out form of a value, expanded across lines wherever one line will not do. */
  private _format(value: unknown, at: Frame): string {
    const scalar = this._scalar(value);
    if (scalar !== null) return scalar;

    const object = value as object;
    if (at.open.has(object)) return "[Circular]";
    at.open.add(object);
    try {
      return this._formatObject(object, at);
    } catch (error) {
      // The container's *shape* would not be read — `Object.keys`, an iterator,
      // `toString`. Nothing can be enumerated, so the whole container degrades;
      // a value that merely would not be read degrades alone, in its own slot.
      return threw(error);
    } finally {
      at.open.delete(object);
    }
  }

  /** The arms for a non-null object, with `value` already on the open path. */
  private _formatObject(value: object, at: Frame): string {
    const shape = this._shape(value, at.level, Infinity);
    if (shape.kind === "text") return shape.text;

    const indentStr = " ".repeat(this.indent * at.inset);
    if (!this.expandAll) {
      const compact = this._joinOneLine(shape, {
        level: at.level + 1,
        budget: at.maxWidth - cellLen(indentStr),
        open: at.open,
      });
      if (compact !== null) return compact;
    }

    const innerIndent = " ".repeat(this.indent * (at.inset + 1));
    const deeper: Frame = { inset: at.inset + 1, level: at.level + 1, maxWidth: at.maxWidth, open: at.open };
    const parts = shape.slots.map((slot) => innerIndent + this._expandSlot(slot, deeper));
    return shape.open + "\n" + parts.join(",\n") + "\n" + indentStr + shape.close;
  }

  /** One position, with every value in it laid out. */
  private _expandSlot(slot: Slot, at: Frame): string {
    let out = slot.head;
    for (const hole of slot.holes) {
      // This is the read that costs the least when it fails: neighbours are
      // unaffected, so `{ a: 1, b: [Threw: …], c: 3 }` still shows everything
      // that could be read.
      try {
        out += this._format(hole.read(), at);
      } catch (error) {
        out += threw(error);
      }
      out += hole.tail;
    }
    return out;
  }

  /** The one-line form of a value, or `null` when it will not fit `at.budget`. */
  private _oneLine(value: unknown, at: Probe): string | null {
    const scalar = this._scalar(value);
    if (scalar !== null) return fitOneLine(scalar, at.budget);

    const object = value as object;
    if (at.open.has(object)) return fitOneLine("[Circular]", at.budget);
    at.open.add(object);
    try {
      const shape = this._shape(object, at.level, at.budget);
      if (shape.kind === "text") return fitOneLine(shape.text, at.budget);
      return this._joinOneLine(shape, { level: at.level + 1, budget: at.budget, open: at.open });
    } catch (error) {
      return fitOneLine(threw(error), at.budget);
    } finally {
      at.open.delete(object);
    }
  }

  /**
   * A container's positions on one line, or `null` as soon as they overrun.
   *
   * The budget is spent as it goes and each position is asked for only what is
   * left, so a subtree that has already outgrown the line is abandoned where it
   * outgrew it rather than formatted in full and then measured.
   *
   * The brackets are charged before anything is read, and that ordering is what
   * bounds the traversal: a budget checked only against the finished text still
   * reads the whole subtree to produce text it then throws away. Charged first,
   * every level costs at least the two cells of its own brackets, so a probe
   * descends at most `budget / 2` levels however deep the data goes.
   */
  private _joinOneLine(shape: Container, at: Probe): string | null {
    let used = cellLen(shape.open) + cellLen(shape.close) + 2 * cellLen(shape.pad);
    if (used > at.budget) return null;

    const pieces: string[] = [];
    for (const slot of shape.slots) {
      used += pieces.length > 0 ? cellLen(SEPARATOR) : 0;
      const piece = this._slotOneLine(slot, { ...at, budget: at.budget - used });
      if (piece === null) return null;
      used += cellLen(piece);
      pieces.push(piece);
    }
    return shape.open + shape.pad + pieces.join(SEPARATOR) + shape.pad + shape.close;
  }

  /** One position on one line, or `null` when any value in it will not fit. */
  private _slotOneLine(slot: Slot, at: Probe): string | null {
    let out = slot.head;
    for (const hole of slot.holes) {
      const left = at.budget - cellLen(out);
      let text: string | null;
      try {
        text = this._oneLine(hole.read(), { ...at, budget: left });
      } catch (error) {
        text = fitOneLine(threw(error), left);
      }
      if (text === null) return null;
      out += text + hole.tail;
    }
    return fitOneLine(out, at.budget);
  }

  private _addIndentGuides(text: RichText): void {
    const lines = text.plain.split("\n");
    let offset = 0;
    for (const line of lines) {
      const leadingSpaces = line.length - line.trimStart().length;
      for (let i = 0; i < leadingSpaces; i += this.indent) {
        if (i + offset < text.length) {
          text.stylize("repr.indent", offset + i, offset + i + 1);
        }
      }
      offset += line.length + 1; // +1 for newline
    }
  }
}
