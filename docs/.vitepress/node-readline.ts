/**
 * `node:readline` for a program run under the simulated process: what
 * `bundleExample` resolves that specifier to, so `nodeAsk` from
 * `@promptctl/rich-js/node/prompt` runs unchanged in a live terminal and a
 * prompt on a page is answered by what the reader types.
 *
 * It is `createInterface` and `question` and nothing else, the part of readline
 * `nodeAsk` uses. The line discipline is a terminal's in cooked mode: printable
 * keys are echoed and collected, backspace takes back the last one, an escape
 * sequence (an arrow, Home, Delete) is read whole and ignored, and Enter — `\r`,
 * `\n`, or the two together — ends the line and hands it over.
 *
 * Keys typed after that Enter are the next line's, as they would be in the
 * stream a real terminal buffers: they wait on the input for the next question
 * asked of it, `nodeAsk`'s next interface included.
 *
 * [LAW:composability] Like the simulated process it reads from, it knows no
 * docs page: the playground and the landing hero run programs through the same
 * bundle.
 */

type Chunk = string | Uint8Array;

interface KeyStream {
  on(event: "data", listener: (chunk: Chunk) => void): unknown;
  off(event: "data", listener: (chunk: Chunk) => void): unknown;
}

interface TextSink {
  write(chunk: string): unknown;
}

export interface Interface {
  question(query: string, answer: (line: string) => void): void;
  close(): void;
}

/**
 * What each input holds between questions: decoded keys no line has taken yet,
 * and a UTF-8 character still arriving. The input's own state, so it outlives
 * the interface that read it, as a real stream's buffer does.
 */
interface Pending {
  keys: string;
  /** The last line ended on a lone `\r`, so a `\n` arriving next is its other half. */
  endedOnReturn: boolean;
  readonly decoder: TextDecoder;
}

// [LAW:no-shared-mutable-globals] Keyed by the input stream it buffers and
// written only by `question`; it dies with its stream.
const pending = new WeakMap<KeyStream, Pending>();

/** An arrow, Home, Delete and the like: a CSI (`ESC [ … final`) or SS3 (`ESC O x`) sequence at the start of `keys`. */
const ESCAPE = /^\x1b(?:\[[0-?]*[ -/]*[@-~]|O[@-~])/;
/** The start of one of those sequences, the rest still to arrive. */
const PARTIAL = /^\x1b(?:\[[0-?]*[ -/]*|O)?$/;

/** One step of the line discipline: what the keys at the front of `keys` do, and how many they are. */
type Step =
  | { readonly kind: "enter"; readonly length: number }
  | { readonly kind: "erase"; readonly length: 1 }
  | { readonly kind: "type"; readonly key: string; readonly length: number }
  | { readonly kind: "skip"; readonly length: number }
  | { readonly kind: "incomplete" };

function step(keys: string): Step {
  const key = String.fromCodePoint(keys.codePointAt(0)!);
  if (key === "\r") return { kind: "enter", length: keys[1] === "\n" ? 2 : 1 };
  if (key === "\n") return { kind: "enter", length: 1 };
  if (key === "\x7f" || key === "\b") return { kind: "erase", length: 1 };
  if (key === "\x1b") {
    // Anything else after ESC is a lone Esc key, skipped on its own.
    const sequence = ESCAPE.exec(keys);
    if (sequence !== null) return { kind: "skip", length: sequence[0].length };
    return PARTIAL.test(keys) ? { kind: "incomplete" } : { kind: "skip", length: 1 };
  }
  return key >= " " ? { kind: "type", key, length: key.length } : { kind: "skip", length: key.length };
}

export function createInterface({ input, output }: { input: KeyStream; output: TextSink }): Interface {
  const buffer = pending.get(input) ?? { keys: "", endedOnReturn: false, decoder: new TextDecoder() };
  pending.set(input, buffer);
  let listening: ((chunk: Chunk) => void) | null = null;
  const stop = (): void => {
    if (listening !== null) input.off("data", listening);
    listening = null;
  };
  return {
    question(query, answer) {
      output.write(query);
      const typed: string[] = [];
      const consume = (): void => {
        while (buffer.keys.length > 0) {
          const next = step(buffer.keys);
          if (next.kind === "incomplete") return;
          const wasReturn = buffer.keys.slice(0, next.length) === "\r";
          const secondHalf = buffer.endedOnReturn && buffer.keys.startsWith("\n");
          buffer.keys = buffer.keys.slice(next.length);
          buffer.endedOnReturn = next.kind === "enter" && wasReturn;
          if (secondHalf) continue;
          if (next.kind === "enter") {
            output.write("\r\n");
            stop();
            answer(typed.join(""));
            return;
          }
          if (next.kind === "erase" && typed.pop() !== undefined) output.write("\b \b");
          if (next.kind === "type") {
            typed.push(next.key);
            output.write(next.key);
          }
        }
      };
      listening = (chunk) => {
        buffer.keys += typeof chunk === "string" ? chunk : buffer.decoder.decode(chunk, { stream: true });
        consume();
      };
      input.on("data", listening);
      consume();
    },
    close: stop,
  };
}
