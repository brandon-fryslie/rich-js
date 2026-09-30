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
 * The prompt is drawn by a `Console` on stdout, so it is coloured exactly as
 * that console's own output would be — the same detection, the same theme —
 * and handed to readline already encoded, so readline's line editing knows
 * where the answer starts. It goes as one logical line, never broken at the
 * console's width: the terminal wraps it at whatever width it has when readline
 * draws it, and a break baked in at capture would land mid-row after a resize.
 *
 * [LAW:single-enforcer] One readline interface per `nodeAsk` call —
 * created, asked, closed. No shared `rl` across prompts, no listener-leak
 * pitfalls when callers stack prompts in a loop.
 */

import * as readline from "node:readline";
import { Console } from "../core/console.js";
import type { PromptInput } from "../renderables/prompt.js";

export const nodeAsk: PromptInput = (prompt) => {
  const stdout = new Console();
  stdout.beginCapture();
  stdout.print(prompt, { end: "", softWrap: true });
  const query = stdout.endCapture();
  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(query, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
};
