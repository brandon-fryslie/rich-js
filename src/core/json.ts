/**
 * JSON — renders JSON data with syntax highlighting and pretty-printing.
 *
 * Lives in `core/` for the reason `pretty.ts` does, argued in its header: it
 * turns foreign input into `RichText`, composes no other renderable, and
 * imports core primitives only. `Console.printJson` delegates here, so this is
 * where the console can reach it without an upward edge. [LAW:one-way-deps]
 */

import { withExplicitEscaped } from "./bidi.js";
import { Segment } from "./segment.js";
import { RichText } from "./text.js";
import { replaceWithheld } from "./cells.js";
import { controlClass } from "./control-codes.js";
import { JSONHighlighter } from "./highlighter.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "./protocol.js";
import { measure, render } from "./protocol.js";

export interface JSONOptions {
  indent?: number;
  sortKeys?: boolean;
  highlight?: boolean;
}

const highlighter = new JSONHighlighter();
const STRIPPED = controlClass((disposition) => disposition === "strip");

/** `character` as JSON escapes, a surrogate pair for one past the BMP. */
const jsonEscape = (character: string): string =>
  Array.from({ length: character.length }, (_, at) => `\\u${character.charCodeAt(at).toString(16).padStart(4, "0")}`).join("");

export class JSONRenderable implements Renderable, Measurable {
  readonly text: RichText;

  private constructor(text: RichText) {
    this.text = text;
  }

  static fromString(jsonString: string, options?: JSONOptions): JSONRenderable {
    const indent = options?.indent ?? 2;
    const sortKeys = options?.sortKeys ?? false;

    // Parse and re-serialize for consistent formatting
    const data = JSON.parse(jsonString) as unknown;
    return JSONRenderable.fromData(data, { ...options, indent, sortKeys });
  }

  static fromData(data: unknown, options?: JSONOptions): JSONRenderable {
    const indent = options?.indent ?? 2;
    const sortKeys = options?.sortKeys ?? false;
    const doHighlight = options?.highlight !== false;

    const replacer = sortKeys
      ? (_key: string, value: unknown) => {
          if (value !== null && typeof value === "object" && !Array.isArray(value)) {
            const sorted: Record<string, unknown> = {};
            for (const k of Object.keys(value as Record<string, unknown>).sort()) {
              sorted[k] = (value as Record<string, unknown>)[k];
            }
            return sorted;
          }
          return value;
        }
      : undefined;

    // `undefined` for what JSON has no form of, a function or a symbol, whatever its type says.
    const jsonStr = (JSON.stringify(data, replacer, indent) as string | undefined) ?? "";
    // Data on show: one string holds every key and value, so a control left in
    // one would act on the rest of its line, and what content deletes or the wire
    // withholds would leave a document that no longer parses back to this data.
    const escaped = replaceWithheld(withExplicitEscaped(jsonStr), jsonEscape);
    const text = new RichText(escaped.replace(new RegExp(STRIPPED, "gu"), jsonEscape));

    if (doHighlight) {
      highlighter.highlight(text);
    }

    return new JSONRenderable(text);
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* render(this.text, options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return measure(this.text, options);
  }
}
