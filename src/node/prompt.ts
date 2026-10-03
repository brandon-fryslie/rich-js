/**
 * node:prompt — readline-backed `PromptInput` for use with the prompt
 * renderable in a Node runtime.
 *
 * [LAW:locality-or-seam] `node:readline` lives only here, on the node side
 * of the API boundary. The main barrel stays browser-safe; consumers that
 * want interactive prompts in Node opt in by importing `nodeAsk` and
 * passing it as the input capability:
 *
 *     import { Prompt } from "@promptctl/rich-js";
 *     import { nodeAsk } from "@promptctl/rich-js/node/prompt";
 *     const answer = await Prompt.ask("What's your name?", nodeAsk);
 *     // or with options:
 *     const choice = await Prompt.ask("Pick one", nodeAsk, { choices: ["a", "b"] });
 *
 * The prompt is printed by the `Console` it was asked on — the app's, when it
 * passed one as `console`, a new default one otherwise — and then a line is
 * read, as Rich's `Console.input` prints its prompt and calls `input()`. So
 * the prompt is coloured exactly as that console's own output would be and
 * goes to its target: a console on stderr asks on stderr, beside the
 * invalid-answer messages it prints. It goes as one logical line, never broken
 * at the console's width: the terminal wraps it at whatever width it has.
 *
 * readline reads in non-terminal mode, the terminal's own cooked line
 * discipline, as Python's `input()` does without its readline module: in
 * terminal mode readline redraws the line itself, prompt included, and needs a
 * whole `tty.WriteStream` to draw on, which a console's target need not be.
 *
 * [LAW:single-enforcer] One readline interface per `nodeAsk` call —
 * created, asked, closed. No shared `rl` across prompts, no listener-leak
 * pitfalls when callers stack prompts in a loop.
 */

import * as readline from "node:readline";
import type { PromptInput } from "../renderables/prompt.js";

export const nodeAsk: PromptInput = (prompt, console) => {
  console.print(prompt, { end: "", softWrap: true });
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      // [LAW:types-are-the-program] exception: readline types its output as a
      // whole `NodeJS.WritableStream`, and a console's target is only a
      // `ConsoleSink`. With `terminal: false` readline only ever calls its
      // `write`, whatever its `isTTY` says.
      output: console.file as NodeJS.WritableStream,
      terminal: false,
    });
    rl.question("", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};
