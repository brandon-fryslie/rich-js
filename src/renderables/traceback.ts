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

import type { Segment } from "../core/segment.js";
import { RichText } from "../core/text.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";

export interface TracebackOptions {
  suppress?: string[];
  maxFrames?: number;
}


interface StackFrame {
  file: string;
  line: number;
  function: string | undefined;
}

function parseStack(error: Error): StackFrame[] {
  const stack = error.stack ?? "";
  const lines = stack.split("\n");
  const frames: StackFrame[] = [];

  for (const line of lines) {
    // The two V8 frame shapes located by file:line:column: "at fn (file:…)"
    // and "at file:…", either one prefixed "async " when the frame is an
    // awaited call. The marker is not part of any name, so it is read and
    // dropped; the lookahead keeps "at async (file:…)" — a function named
    // `async` — a name.
    const match = /^at\s+(?:async\s+(?!\())?(?:(.+?)\s+\()?(.+?):(\d+):\d+\)?/.exec(line.trim());
    if (match) {
      frames.push({
        function: match[1] || undefined,
        file: match[2]!,
        line: parseInt(match[3]!, 10),
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

  // [LAW:single-enforcer] The report is one `RichText`, so fitting it to the
  // width is the one fitting every text in the library gets: a line wider than
  // the report wraps, and a location wider than the report folds across lines
  // whole, as Rich's does. Written as bare segments, each line was cropped at
  // the edge instead, and a frame lost its file and line to a long path.
  render(options: RenderOptions): Iterable<Segment> {
    const report = new RichText("", { end: "" });
    report.append(this.error.name || "Error", "traceback.exc_type");
    report.append(": ");
    report.append(this.error.message, "traceback.text");
    report.append("\n\n");

    // A suppressed frame keeps its place and shows its file and line only: it
    // is the same frame with no function name to show.
    const frames = parseStack(this.error).map((frame) =>
      this.suppress.some((s) => frame.file.includes(s)) ? { ...frame, function: undefined } : frame,
    );

    if (this.maxFrames > 0 && frames.length > this.maxFrames) {
      // Spend the budget exactly: the tail takes `maxFrames - head` rather than
      // a second `head`, so an odd budget shows every frame it counts, and it
      // slices from an index because `slice(-0)` is the whole array.
      const head = Math.floor(this.maxFrames / 2);
      const omitted = frames.length - this.maxFrames;
      for (const frame of frames.slice(0, head)) appendFrame(report, frame);
      report.append(`  ... ${omitted} frames omitted ...\n`, "traceback.text");
      for (const frame of frames.slice(frames.length - (this.maxFrames - head))) appendFrame(report, frame);
    } else {
      for (const frame of frames) appendFrame(report, frame);
    }

    return report.render(options);
  }
}

function appendFrame(report: RichText, frame: StackFrame): void {
  report.append("  ");
  if (frame.function) {
    report.append(frame.function, "bold");
    report.append(" ");
  }
  report.append(frame.file, "dim");
  report.append(":");
  report.append(String(frame.line), "traceback.offset");
  report.append("\n");
}
