/**
 * `node:readline` for a program run under the simulated process: what
 * `bundleExample` resolves that specifier to, so `nodeAsk` from
 * `@promptctl/rich-js/node/prompt` runs unchanged in a live terminal and a
 * prompt on a page is answered by what the reader types.
 *
 * It is `createInterface` and `question` and nothing else, the part of readline
 * `nodeAsk` uses. The line discipline is a terminal's in cooked mode: printable
 * keys are echoed and collected, backspace takes back the last one, and Enter
 * ends the line and hands it over.
 *
 * [LAW:composability] Like the simulated process it reads from, it knows
 * no docs page: the playground and the landing hero run programs through the
 * same bundle.
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

const ENTER = new Set(["\r", "\n"]);
const BACKSPACE = new Set(["\x7f", "\b"]);

export function createInterface({ input, output }: { input: KeyStream; output: TextSink }): Interface {
  const decoder = new TextDecoder();
  let listening: ((chunk: Chunk) => void) | null = null;
  const stop = (): void => {
    if (listening !== null) input.off("data", listening);
    listening = null;
  };
  return {
    question(query, answer) {
      output.write(query);
      const typed: string[] = [];
      listening = (chunk) => {
        for (const key of typeof chunk === "string" ? chunk : decoder.decode(chunk)) {
          if (ENTER.has(key)) {
            output.write("\r\n");
            stop();
            answer(typed.join(""));
            return;
          }
          if (BACKSPACE.has(key)) {
            if (typed.pop() !== undefined) output.write("\b \b");
          } else if (key >= " ") {
            typed.push(key);
            output.write(key);
          }
        }
      };
      input.on("data", listening);
    },
    close: stop,
  };
}
