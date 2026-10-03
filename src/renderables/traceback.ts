/**
 * Traceback — renders error tracebacks with formatting.
 *
 * [LAW:effects-at-boundaries] Pure rendering: a caught value in, `Segment`s out.
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
  /**
   * The program's message, or the thrown value itself when it is not an error,
   * laid out at the width left after the name.
   */
  message: (options: RenderOptions) => RichText;
  frames: StackFrame[];
}

/**
 * [LAW:parse-dont-validate] The checkpoint between whatever a `catch` caught —
 * JavaScript lets a program throw any value — and the report. Anything with a
 * string `name` and a `message` is reported as the error it presents itself
 * as: that is every native error from any realm, which `instanceof Error`
 * would refuse for one from a `node:vm` context or an iframe, and any thrower
 * shaped like one. A message that is not a string — a native error's, assigned
 * after construction — is formatted by `Pretty` under the error's own name.
 * Anything else is reported as the value it is, under `NonError`, formatted by
 * `Pretty` so it reads the same in a browser as in node — with the frames of a
 * stack it carries, when it carries one.
 */
function readCaught(value: unknown): Caught {
  const fields = readFields(value);
  if (fields !== undefined && typeof fields.name === "string" && fields.hasMessage) {
    const { name, message } = fields;
    const text = typeof message === "string" ? message : undefined;
    return {
      name: name || "Error",
      message: text === undefined
        ? prettyMessage(message)
        : () => new RichText(text, { style: "traceback.text", end: "" }),
      frames: parseStack(fields.stack, name, text),
    };
  }
  return { name: "NonError", message: prettyMessage(value), frames: parseStack(fields?.stack ?? "", undefined, undefined) };
}

interface Fields {
  name: unknown;
  hasMessage: boolean;
  message: unknown;
  stack: string;
}

/**
 * The fields the report reads off a caught object, or `undefined` when it is
 * not an object or reading them throws — a getter that throws, a `Proxy` whose
 * trap does. Such a value is reported under `NonError`, where `Pretty` reads
 * it again and marks the read that threw as `[Threw: …]`, so the fault stays
 * in the report instead of taking the crash handler down with it.
 */
function readFields(value: unknown): Fields | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  try {
    const record = value as { name?: unknown; message?: unknown; stack?: unknown };
    const stack = record.stack;
    return {
      name: record.name,
      hasMessage: "message" in record,
      message: record.message,
      stack: typeof stack === "string" ? stack : "",
    };
  } catch {
    return undefined;
  }
}

function prettyMessage(value: unknown): (options: RenderOptions) => RichText {
  const pretty = new Pretty(value, UNSEEN_DATA_BOUNDS);
  return (options) => pretty.toText(options);
}

/** The first line V8 writes into an error's stack: `String(error)` at the throw. */
function header(name: string, message: string): string {
  if (!name) return message;
  if (!message) return name;
  return `${name}: ${message}`;
}

/**
 * Where the header that opens an error's stack ends, or `undefined` when the
 * stack does not open with the header the error now has.
 *
 * V8 writes `String(error)`; node writes its own errors' code into the name
 * there (`RangeError [ERR_X]: message`), so after the name may come one line of
 * anything before `: ` and the message.
 */
function headerEnd(stack: string, name: string, message: string): number | undefined {
  const endsLine = (at: number): boolean => at === stack.length || stack[at] === "\n";
  const plain = header(name, message);
  if (stack.startsWith(plain) && endsLine(plain.length)) return plain.length;
  if (!name || !stack.startsWith(name)) return undefined;
  const tail = `: ${message}`;
  const at = stack.indexOf(tail, name.length);
  if (at < 0 || stack.slice(name.length, at).includes("\n")) return undefined;
  return endsLine(at + tail.length) ? at + tail.length : undefined;
}

/**
 * Whether a stack line is shaped as V8's header — a name, then `:` or nothing —
 * rather than as a SpiderMonkey or JavaScriptCore frame, whose `@` comes before
 * the first `:` of its location. Read by shape, not by the error's name,
 * because the name may have been reassigned after V8 wrote the header too.
 */
function isHeaderShaped(line: string): boolean {
  const colon = line.indexOf(":");
  return !(colon < 0 ? line : line.slice(0, colon)).includes("@");
}

/**
 * The frames of a stack, in order.
 *
 * V8 opens a stack with the error's header, and a message can span lines that
 * look like frames, so the header comes off first, as the exact text it is.
 * When it does not open the stack, the message was reassigned after the throw
 * and what precedes the first V8 frame is that stale header — all of it, when
 * V8 recorded no frame, as under `Error.stackTraceLimit = 0`. SpiderMonkey and
 * JavaScriptCore write no header, so a stack that opens with one of their
 * frames is all frames. A value that is not an error has no name, so its stack is
 * read from its first V8 frame, or whole when it has none.
 */
function parseStack(stack: string, name: string | undefined, message: string | undefined): StackFrame[] {
  const end = name !== undefined && message !== undefined ? headerEnd(stack, name, message) : undefined;
  const lines = stack.slice(end ?? 0).split("\n").map((line) => line.trim()).filter((line) => line !== "");
  if (end !== undefined) return lines.map(parseFrame);
  const firstV8 = lines.findIndex((line) => V8_FRAME.test(line));
  if (firstV8 >= 0) return lines.slice(firstV8).map(parseFrame);
  return name !== undefined && lines[0] !== undefined && isHeaderShaped(lines[0]) ? [] : lines.map(parseFrame);
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
    // The message starts after the name, so a value `Pretty` lays out fits the
    // width that is left on that line rather than overrunning it.
    header.append(message({ ...options, maxWidth: Math.max(1, options.maxWidth - header.cellLength) }));
    header.append("\n\n");
    yield* header.render(options);

    // A suppressed frame keeps its place and shows its file and line only: it
    // is the same frame with no function name to show.
    const frames = this.caught.frames.map((frame) =>
      this.suppress.some((s) => frame.location.includes(s)) ? { ...frame, function: undefined } : frame,
    );

    // One entry per row of the frame block, so a report with no frames has no
    // rows: empty text is one line, as in Rich, and a block built as one text
    // drew a blank indented row under every frameless report.
    let entries: RichText[];
    if (this.maxFrames > 0 && frames.length > this.maxFrames) {
      // Spend the budget exactly: the tail takes `maxFrames - head` rather than
      // a second `head`, so an odd budget shows every frame it counts, and it
      // slices from an index because `slice(-0)` is the whole array.
      const head = Math.floor(this.maxFrames / 2);
      const omitted = frames.length - this.maxFrames;
      entries = [
        ...frames.slice(0, head).map(frameEntry),
        new RichText(`... ${omitted} frames omitted ...`, { style: "traceback.text", end: "" }),
        ...frames.slice(frames.length - (this.maxFrames - head)).map(frameEntry),
      ];
    } else {
      entries = frames.map(frameEntry);
    }

    // The frames are one block set in from the report's edge, so a frame that
    // wraps continues under itself instead of at the edge, where it read as a
    // frame of its own. The width is divided as `Padding` divides it; the rows
    // are not padded out on the right, as `Padding`'s are, because trailing
    // blanks on every line of a crash report are bytes nobody asked for.
    const { left, contentWidth } = layoutPadding(options.maxWidth, 2, 0);
    const indent = new Segment(" ".repeat(left));
    for (const entry of entries) {
      for (const line of Segment.splitLines(entry.render({ ...options, maxWidth: contentWidth }))) {
        yield indent;
        yield* line;
        yield Segment.line();
      }
    }
  }
}

function frameEntry(frame: StackFrame): RichText {
  const entry = new RichText("", { end: "" });
  if (frame.function) {
    entry.append(frame.function, "bold");
    entry.append(" ");
  }
  entry.append(frame.location, "dim");
  if (frame.line !== undefined) {
    entry.append(":");
    entry.append(String(frame.line), "traceback.offset");
  }
  return entry;
}
