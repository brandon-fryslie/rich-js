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
 * The prompt is drawn by the `Console` it was asked on — the app's, when it
 * passed one as `console`, a new default one otherwise — so it is coloured
 * exactly as that console's own output would be, the same detection, the same
 * theme, and handed to readline already encoded, so readline's line editing
 * knows where the answer starts. It goes as one logical line, never broken at
 * the console's width: the terminal wraps it at whatever width it has when
 * readline draws it, and a break baked in at capture would land mid-row after a
 * resize.
 *
 * readline draws it on the console's own target, as Rich's `Console.input`
 * prints its prompt to `console.file`. A console on stderr asks on stderr, and
 * the invalid-answer messages the prompt prints through that console land
 * beside the prompt they answer rather than on another stream, with the colours
 * that console detected for the stream it writes to.
 *
 * [LAW:single-enforcer] One readline interface per `nodeAsk` call —
 * created, asked, closed. No shared `rl` across prompts, no listener-leak
 * pitfalls when callers stack prompts in a loop.
 */

import * as readline from "node:readline";
import type { PromptInput } from "../renderables/prompt.js";

export const nodeAsk: PromptInput = (prompt, console) => {
  console.beginCapture();
  console.print(prompt, { end: "", softWrap: true });
  const query = console.endCapture();
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      // [LAW:types-are-the-program] exception: readline types its output as a
      // whole `NodeJS.WritableStream`, and a console's target is only a
      // `ConsoleSink`. readline asks more of it than `write` only once it is a
      // TTY, and a TTY target in Node is a `tty.WriteStream`.
      output: console.file as NodeJS.WritableStream,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};
