/**
 * Traceback — renders error tracebacks with formatting.
 *
 * [LAW:effects-at-boundaries] Pure rendering: an `Error` in, `Segment`s out.
 * Installing this as the process-wide crash handler touches `process.on` and
 * `process.exit`, so that lives behind the node seam as `installTraceback` in
 * `src/node/traceback.ts` — which is what keeps this module, and therefore the
 * main barrel, importable in a browser.
 *
 * [LAW:types-are-the-program] `TracebackOptions` names only what the renderer
 * reads. There is no `showLocals`: an `Error` carries a stack of locations and
 * nothing of the values in scope at them. The one way to get those in node —
 * an inspector session pausing on exceptions — would have to pause on every
 * throw, caught ones included, to serve `new Traceback(caughtError)`, and it
 * cannot exist in a browser at all. Nor is there a `width` or `theme`: those
 * sized and coloured a source-code excerpt this renderer does not produce.
 */

import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";
import { getStyle } from "../core/protocol.js";

export interface TracebackOptions {
  suppress?: string[];
  maxFrames?: number;
}


interface StackFrame {
  file: string;
  line: number | undefined;
  column: number | undefined;
  function: string | undefined;
  suppressed?: boolean;
}

function parseStack(error: Error): StackFrame[] {
  const stack = error.stack ?? "";
  const lines = stack.split("\n");
  const frames: StackFrame[] = [];

  for (const line of lines) {
    const trimmed = line.trim();
    // Node.js format: "    at functionName (file:line:column)"
    // or:            "    at file:line:column"
    const match = /^\s*at\s+(?:(.+?)\s+\()?(.+?):(\d+):(\d+)\)?/.exec(trimmed);
    if (match) {
      frames.push({
        function: match[1] || undefined,
        file: match[2]!,
        line: parseInt(match[3]!, 10),
        column: parseInt(match[4]!, 10),
      });
    }
  }

  return frames;
}

export class Traceback implements Renderable {
  readonly error: Error;
  readonly maxFrames: number;
  readonly suppress: string[];

  constructor(error: Error, options?: TracebackOptions) {
    this.error = error;
    this.maxFrames = options?.maxFrames ?? 100;
    this.suppress = options?.suppress ?? [];
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const excTypeStyle = getStyle(options, "traceback.exc_type");
    const textStyle = getStyle(options, "traceback.text");

    // Error type and message
    const errorName = this.error.name || "Error";
    const errorMessage = this.error.message || "";

    yield new Segment(errorName, excTypeStyle);
    yield new Segment(": ");
    yield new Segment(errorMessage, textStyle);
    yield Segment.line();
    yield Segment.line();

    // Stack frames — suppressed frames show file/line only (not removed)
    const frames = parseStack(this.error);
    const filteredFrames = this.suppress.length > 0
      ? frames.map((f) => ({
          ...f,
          suppressed: this.suppress.some((s) => f.file.includes(s)),
        }))
      : frames;

    let displayFrames = filteredFrames;
    if (this.maxFrames > 0 && displayFrames.length > this.maxFrames) {
      // Spend the budget exactly: the tail takes `maxFrames - head` rather than
      // a second `head`, so an odd budget shows every frame it counts, and it
      // slices from an index because `slice(-0)` is the whole array.
      const head = Math.floor(this.maxFrames / 2);
      const first = displayFrames.slice(0, head);
      const last = displayFrames.slice(displayFrames.length - (this.maxFrames - head));
      const omitted = displayFrames.length - this.maxFrames;

      for (const frame of first) {
        yield* this._renderFrame(frame, options);
      }
      yield new Segment(`  ... ${omitted} frames omitted ...`, textStyle);
      yield Segment.line();
      for (const frame of last) {
        yield* this._renderFrame(frame, options);
      }
    } else {
      for (const frame of displayFrames) {
        yield* this._renderFrame(frame, options);
      }
    }
  }

  private *_renderFrame(frame: StackFrame, options: RenderOptions): Iterable<Segment> {
    const pathStyle = Style.parse("dim");
    const lineNoStyle = getStyle(options, "traceback.offset");

    yield new Segment("  ");
    // Spec: suppressed frames show file and line only — no function name
    if (frame.function && !frame.suppressed) {
      yield new Segment(frame.function, Style.parse("bold"));
      yield new Segment(" ");
    }
    yield new Segment(frame.file, pathStyle);
    if (frame.line !== undefined) {
      yield new Segment(":");
      yield new Segment(String(frame.line), lineNoStyle);
    }
    yield Segment.line();
  }
}
