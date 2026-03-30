/**
 * Traceback — renders error tracebacks with formatting.
 */

import { Segment } from "../core/segment.js";
import { Style } from "../core/style.js";
import { Console } from "../core/console.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";

export interface TracebackOptions {
  showLocals?: boolean;
  suppress?: string[];
  maxFrames?: number;
  width?: number;
  theme?: string;
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
  readonly showLocals: boolean;
  readonly width: number | undefined;
  readonly theme: string | undefined;

  constructor(error: Error, options?: TracebackOptions) {
    this.error = error;
    this.maxFrames = options?.maxFrames ?? 100;
    this.suppress = options?.suppress ?? [];
    this.showLocals = options?.showLocals ?? false;
    this.width = options?.width;
    this.theme = options?.theme;
  }

  *render(_options: RenderOptions): Iterable<Segment> {
    const excTypeStyle = Style.parse("traceback.exc_type");
    const textStyle = Style.parse("traceback.text");

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
      const half = Math.floor(this.maxFrames / 2);
      const first = displayFrames.slice(0, half);
      const last = displayFrames.slice(-half);
      const omitted = displayFrames.length - this.maxFrames;

      for (const frame of first) {
        yield* this._renderFrame(frame);
      }
      yield new Segment(`  ... ${omitted} frames omitted ...`, textStyle);
      yield Segment.line();
      for (const frame of last) {
        yield* this._renderFrame(frame);
      }
    } else {
      for (const frame of displayFrames) {
        yield* this._renderFrame(frame);
      }
    }
  }

  private *_renderFrame(frame: StackFrame): Iterable<Segment> {
    const pathStyle = Style.parse("dim");
    const lineNoStyle = Style.parse("traceback.offset");

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

  /** Install as global uncaught exception handler */
  static install(options?: TracebackOptions): void {
    process.on("uncaughtException", (error) => {
      const tb = new Traceback(error, options);
      const cons = new Console({ stderr: true });
      cons.print(tb);
      process.exit(1);
    });
  }
}
