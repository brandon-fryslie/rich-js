/**
 * JSON — renders JSON data with syntax highlighting and pretty-printing.
 */

import { Segment } from "../core/segment.js";
import { RichText } from "../core/text.js";
import { JSONHighlighter } from "../core/highlighter.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export interface JSONOptions {
  indent?: number;
  sortKeys?: boolean;
  highlight?: boolean;
}

const highlighter = new JSONHighlighter();

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

    const jsonStr = JSON.stringify(data, replacer, indent);
    const text = new RichText(jsonStr, { end: "" });

    if (doHighlight) {
      highlighter.highlight(text);
    }

    return new JSONRenderable(text);
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this.text.render(options);
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return this.text.measure(options);
  }
}
