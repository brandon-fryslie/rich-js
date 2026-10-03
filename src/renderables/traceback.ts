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
import { RichText } from "../core/text.js";
import { Pretty, UNSEEN_DATA_BOUNDS } from "../core/pretty.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";
import { layoutPadding } from "./padding.js";

export interface TracebackOptions {
  suppress?: string[];
  maxFrames?: number;
}

/**
 * One line of a stack: where a call was, as the engine wrote it.
 *
 * `location` is a file for most frames, but not for all of them — V8 writes
 * `index 0` for an element of `Promise.all`, `<anonymous>` for a builtin and
 * `native` for native code — so a frame with no line is a frame, not a
 * failure to read one. A line the reader recognises no shape in is also a
 * frame: its whole text is its location, so it shows as written rather than
 * vanishing from the stack.
 */
interface StackFrame {
  function: string | undefined;
  location: string;
  line: number | undefined;
}

/**
 * A caught value as the report reads it: a name, a message, and the stack to
 * read frames from.
 */
interface Caught {
  name: string;
  /** The program's message, or the thrown value itself when it is not an error. */
  message: (options: RenderOptions) => RichText;
  frames: StackFrame[];
}

/**
 * [LAW:parse-dont-validate] The checkpoint between whatever a `catch` caught —
 * JavaScript lets a program throw any value — and the report. Anything with a
 * string `name` and `message` is reported as the error it presents itself as:
 * that is every native error from any realm, which `instanceof Error` would
 * refuse for one from a `node:vm` context or an iframe, and any thrower shaped
 * like one. Anything else is reported as the value it is, under `NonError`,
 * formatted by `Pretty` so it reads the same in a browser as in node — with the
 * frames of a stack it carries, when it carries one.
 *
 * A native error whose `message` was later assigned a non-string is the second
 * case, which is how it renders rather than throwing out of `console.print`
 * when the report reads it.
 */
function readCaught(value: unknown): Caught {
  const stack = stringField(value, "stack");
  const name = stringField(value, "name");
  const message = stringField(value, "message");
  if (name !== undefined && message !== undefined) {
    return {
      name: name || "Error",
      message: () => new RichText(message, { style: "traceback.text", end: "" }),
      frames: parseStack(stack ?? "", header(name, message)),
    };
  }
  const pretty = new Pretty(value, UNSEEN_DATA_BOUNDS);
  return { name: "NonError", message: (options) => pretty.toText(options), frames: parseStack(stack ?? "", "") };
}

function stringField(value: unknown, key: "name" | "message" | "stack"): string | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const field: unknown = (value as Record<string, unknown>)[key];
  return typeof field === "string" ? field : undefined;
}

/** The first line V8 writes into an error's stack: `String(error)` at the throw. */
function header(name: string, message: string): string {
  if (!name) return message;
  if (!message) return name;
  return `${name}: ${message}`;
}

/**
 * The frames of a stack, in order.
 *
 * V8 opens a stack with the error's header, and a message can span lines that
 * look like frames, so the header comes off first, as the exact text it is.
 * When it does not open the stack — the message was reassigned after the
 * throw, or SpiderMonkey and JavaScriptCore wrote the stack, which carry no
 * header — what precedes the first V8 frame is that stale header, and a stack
 * with no V8 frame is all frames. A value that is not an error opens with no
 * header, the empty one.
 */
function parseStack(stack: string, opening: string): StackFrame[] {
  const body = stack === opening || stack.startsWith(`${opening}\n`)
    ? stack.slice(opening.length)
    : stack;
  const lines = body.split("\n").map((line) => line.trim()).filter((line) => line !== "");
  const firstV8 = lines.findIndex((line) => V8_FRAME.test(line));
  return lines.slice(Math.max(firstV8, 0)).map(parseFrame);
}

/**
 * V8 writes `at [async] [fn (]location[)]`. The `async` marker is not part of
 * any name, so it is read and dropped; the lookahead keeps `at async (…)` — a
 * function named `async` — a name.
 */
const V8_FRAME = /^at\s+(?:async\s+(?!\())?(.*)$/;
/**
 * SpiderMonkey and JavaScriptCore write `[fn]@location`, Firefox prefixing an
 * awaited call's name with a cause up to a `*` (`async*`, `promise callback*`),
 * which is dropped as V8's `async` is.
 */
const AT_SIGN_FRAME = /^(?:[^@]*\*)?([^@]*)@(.*)$/;

function parseFrame(text: string): StackFrame {
  const v8 = V8_FRAME.exec(text);
  if (v8) {
    const body = v8[1]!;
    const open = openingParen(body);
    return open > 0
      ? locate(body.slice(0, open).trim() || undefined, body.slice(open + 1, -1))
      : locate(undefined, body);
  }
  const atSign = AT_SIGN_FRAME.exec(text);
  if (atSign) return locate(atSign[1] || undefined, atSign[2]!);
  return { function: undefined, location: text, line: undefined };
}

/**
 * Where the parenthesised location that closes a V8 frame opens, or -1 when
 * the frame does not end in one. Matched from the end, because an eval
 * frame's location nests parentheses: `eval (eval at f (file:8:22), …)`.
 */
function openingParen(body: string): number {
  if (!body.endsWith(")")) return -1;
  let depth = 0;
  for (let i = body.length - 1; i >= 0; i--) {
    if (body[i] === ")") depth++;
    else if (body[i] === "(" && --depth === 0) return i;
  }
  return -1;
}

/**
 * The shapes a location takes, each read as its file and line, first match
 * wins. Code run by `eval` or `new Function` has no file of its own, so its
 * frame is placed at the call that ran it, which is where the source is: V8
 * nests that site inside the location (`eval at f (file:8:22), <anonymous>:1:1`,
 * innermost first-parenthesised for an eval inside an eval), and Firefox appends
 * the code to it (`file line 8 > eval:1:1`).
 */
const LOCATIONS: readonly RegExp[] = [
  /^eval at [^]*?\(([^()]+):(\d+):\d+\)/,
  /^(.*?) line (\d+) > (?:eval|Function)/,
  /^(.*?):(\d+)(?::\d+)?$/,
];

function locate(fn: string | undefined, location: string): StackFrame {
  for (const shape of LOCATIONS) {
    const match = shape.exec(location);
    if (match) return { function: fn, location: match[1]!, line: parseInt(match[2]!, 10) };
  }
  return { function: fn, location, line: undefined };
}

export class Traceback implements Renderable {
  /** What was caught, as it was handed in. */
  readonly error: unknown;
  readonly maxFrames: number;
  readonly suppress: string[];
  private readonly caught: Caught;

  constructor(error: unknown, options?: TracebackOptions) {
    this.error = error;
    this.caught = readCaught(error);
    this.maxFrames = options?.maxFrames ?? 100;
    this.suppress = options?.suppress ?? [];
  }

  // [LAW:single-enforcer] The report is `RichText`, so fitting it to the width
  // is the one fitting every text in the library gets: a line wider than the
  // report wraps, and a location wider than the report folds across lines
  // whole, as Rich's does. Written as bare segments, each line was cropped at
  // the edge instead, and a frame lost its file and line to a long path.
  *render(options: RenderOptions): Iterable<Segment> {
    const header = new RichText("", { end: "" });
    const { name, message } = this.caught;
    header.append(name, "traceback.exc_type");
    header.append(": ");
    header.append(message(options));
    header.append("\n\n");
    yield* header.render(options);

    // A suppressed frame keeps its place and shows its file and line only: it
    // is the same frame with no function name to show.
    const frames = this.caught.frames.map((frame) =>
      this.suppress.some((s) => frame.location.includes(s)) ? { ...frame, function: undefined } : frame,
    );

    const list = new RichText("", { end: "" });
    if (this.maxFrames > 0 && frames.length > this.maxFrames) {
      // Spend the budget exactly: the tail takes `maxFrames - head` rather than
      // a second `head`, so an odd budget shows every frame it counts, and it
      // slices from an index because `slice(-0)` is the whole array.
      const head = Math.floor(this.maxFrames / 2);
      const omitted = frames.length - this.maxFrames;
      for (const frame of frames.slice(0, head)) appendFrame(list, frame);
      list.append(`... ${omitted} frames omitted ...\n`, "traceback.text");
      for (const frame of frames.slice(frames.length - (this.maxFrames - head))) appendFrame(list, frame);
    } else {
      for (const frame of frames) appendFrame(list, frame);
    }

    // The frames are one block set in from the report's edge, so a frame that
    // wraps continues under itself instead of at the edge, where it read as a
    // frame of its own. The width is divided as `Padding` divides it; the rows
    // are not padded out on the right, as `Padding`'s are, because trailing
    // blanks on every line of a crash report are bytes nobody asked for.
    const { left, contentWidth } = layoutPadding(options.maxWidth, 2, 0);
    const indent = new Segment(" ".repeat(left));
    for (const line of Segment.splitLines(list.render({ ...options, maxWidth: contentWidth }))) {
      yield indent;
      yield* line;
      yield Segment.line();
    }
  }
}

function appendFrame(list: RichText, frame: StackFrame): void {
  if (frame.function) {
    list.append(frame.function, "bold");
    list.append(" ");
  }
  list.append(frame.location, "dim");
  if (frame.line !== undefined) {
    list.append(":");
    list.append(String(frame.line), "traceback.offset");
  }
  list.append("\n");
}
