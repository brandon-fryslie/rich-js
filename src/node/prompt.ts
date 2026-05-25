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
 * [LAW:single-enforcer] One readline interface per `nodeAsk` call —
 * created, asked, closed. No shared `rl` across prompts, no listener-leak
 * pitfalls when callers stack prompts in a loop.
 */

import * as readline from "node:readline";
import type { PromptInput } from "../renderables/prompt.js";

export const nodeAsk: PromptInput = (prompt: string) =>
  new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(prompt, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
