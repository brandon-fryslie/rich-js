/**
 * Prompt — interactive prompts for user input.
 *
 * [LAW:locality-or-seam] The renderable owns prompt logic (display, choice
 * validation, default fallback, retry loop) — but not where the answer comes
 * from. Input is a capability injected via options: pass `ask` per call to
 * supply an answer source. Node consumers pass `nodeAsk` from
 * `@promptctl/rich-js/node/prompt`; tests pass a fake; the browser bundle
 * gets the classes without dragging `node:readline` into the main barrel.
 */

import { render as renderMarkup } from "../core/markup.js";

// --- Types ---

/**
 * Input capability: receives the rendered prompt string (always with a
 * trailing space appended by the renderable, so implementations should not
 * add their own), resolves with the raw user response. Implementations
 * decide where the input comes from (stdin readline, network, in-memory
 * queue, etc.).
 */
export type PromptInput = (prompt: string) => Promise<string>;

export interface PromptOptions<T> {
  default?: T;
  choices?: string[];
  caseSensitive?: boolean;
  showChoices?: boolean;
  showDefault?: boolean;
  /**
   * Input source. Required per call — there is no module-level default by
   * design ([LAW:no-shared-mutable-globals]). When unset, calls throw with a
   * pointer at the node helper — missing capability becomes a loud error
   * rather than a silent hang.
   */
  ask?: PromptInput;
}

// --- Base ---

function missingInput(): never {
  throw new Error(
    "Prompt: no `ask` capability provided. Pass `{ ask }` in options, e.g. " +
      "`import { nodeAsk } from '@promptctl/rich-js/node/prompt'` for Node, " +
      "or supply a custom `PromptInput` for tests/browsers.",
  );
}

function ask(promptText: string, input: PromptInput | undefined): Promise<string> {
  const rendered = renderMarkup(promptText);
  if (!input) missingInput();
  return input(rendered.plain + " ");
}

// --- Prompt ---

export class Prompt {
  static async ask(
    promptText: string,
    options?: PromptOptions<string>,
  ): Promise<string> {
    const showDefault = options?.showDefault !== false;
    const showChoices = options?.showChoices !== false;

    let display = promptText;
    if (showChoices && options?.choices) {
      display += ` [${options.choices.join("/")}]`;
    }
    if (showDefault && options?.default !== undefined) {
      display += ` (${options.default})`;
    }
    display += ":";

    while (true) {
      const answer = await ask(display, options?.ask);
      const value = answer.trim();

      if (value === "" && options?.default !== undefined) {
        return options.default;
      }

      if (options?.choices) {
        const caseSensitive = options.caseSensitive !== false;
        const match = options.choices.find((c) =>
          caseSensitive ? c === value : c.toLowerCase() === value.toLowerCase(),
        );
        if (match) return match;
        continue;
      }

      return value;
    }
  }
}

export class IntPrompt {
  static async ask(
    promptText: string,
    options?: PromptOptions<number>,
  ): Promise<number> {
    const showDefault = options?.showDefault !== false;
    let display = promptText;
    if (showDefault && options?.default !== undefined) {
      display += ` (${options.default})`;
    }
    display += ":";

    while (true) {
      const answer = await ask(display, options?.ask);
      const value = answer.trim();

      if (value === "" && options?.default !== undefined) {
        return options.default;
      }

      const num = parseInt(value, 10);
      if (!isNaN(num) && String(num) === value) return num;
    }
  }
}

export class FloatPrompt {
  static async ask(
    promptText: string,
    options?: PromptOptions<number>,
  ): Promise<number> {
    const showDefault = options?.showDefault !== false;
    let display = promptText;
    if (showDefault && options?.default !== undefined) {
      display += ` (${options.default})`;
    }
    display += ":";

    while (true) {
      const answer = await ask(display, options?.ask);
      const value = answer.trim();

      if (value === "" && options?.default !== undefined) {
        return options.default;
      }

      const num = parseFloat(value);
      if (!isNaN(num)) return num;
    }
  }
}

export class Confirm {
  static async ask(
    promptText: string,
    options?: PromptOptions<boolean>,
  ): Promise<boolean> {
    const defaultVal = options?.default;
    const yesNo = defaultVal === true ? "Y/n" : defaultVal === false ? "y/N" : "y/n";
    const display = `${promptText} [${yesNo}]:`;

    while (true) {
      const answer = await ask(display, options?.ask);
      const value = answer.trim().toLowerCase();

      if (value === "" && defaultVal !== undefined) return defaultVal;
      if (value === "y" || value === "yes") return true;
      if (value === "n" || value === "no") return false;
    }
  }
}
