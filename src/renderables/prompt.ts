/**
 * Prompt — interactive prompts for user input.
 *
 * [LAW:locality-or-seam] The renderable owns prompt logic (display, choice
 * validation, default fallback, retry loop) — but not where the answer comes
 * from. The input source is a required `PromptInput` capability passed at the
 * call site. Node consumers pass `nodeAsk` from
 * `@promptctl/rich-js/node/prompt`; tests pass a fake; the browser bundle
 * gets the classes without dragging `node:readline` into the main barrel.
 *
 * [LAW:types-are-the-program] The `input: PromptInput` parameter is
 * positional and required on every `*.ask()` static — not an optional in
 * `PromptOptions`. The previous shape allowed `Prompt.ask("name?")` at the
 * type level and threw at runtime; the new shape makes the missing-capability
 * state unrepresentable to TS callers.
 *
 * A trust-boundary `typeof === "function"` check remains because the public
 * API surface is reachable from JS (no compile-time types) and from
 * `any`-typed TS callers. The check makes the failure *diagnostic* (points
 * the caller at the node helper), not gatekeep-against-bugs — TS users
 * never see it because the type already forbids the bad state.
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
}

// --- Base ---

function ask(promptText: string, input: PromptInput): Promise<string> {
  // [LAW:single-enforcer] Trust-boundary validation for non-TS callers
  // (JS, or TS with `any` laundering). TS callers can't reach this branch
  // because `PromptInput` is required at every static `.ask`. The message
  // points at the node helper rather than letting the call site die with
  // a generic `TypeError: input is not a function`.
  if (typeof input !== "function") {
    throw new TypeError(
      "Prompt: `input` must be a `PromptInput` function. Pass `nodeAsk` from " +
        "`@promptctl/rich-js/node/prompt` for Node, or supply a custom " +
        "`PromptInput` for tests/browsers.",
    );
  }
  const rendered = renderMarkup(promptText);
  return input(rendered.plain + " ");
}

// --- Prompt ---

export class Prompt {
  static async ask(
    promptText: string,
    input: PromptInput,
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
      const answer = await ask(display, input);
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
    input: PromptInput,
    options?: PromptOptions<number>,
  ): Promise<number> {
    const showDefault = options?.showDefault !== false;
    let display = promptText;
    if (showDefault && options?.default !== undefined) {
      display += ` (${options.default})`;
    }
    display += ":";

    while (true) {
      const answer = await ask(display, input);
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
    input: PromptInput,
    options?: PromptOptions<number>,
  ): Promise<number> {
    const showDefault = options?.showDefault !== false;
    let display = promptText;
    if (showDefault && options?.default !== undefined) {
      display += ` (${options.default})`;
    }
    display += ":";

    while (true) {
      const answer = await ask(display, input);
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
    input: PromptInput,
    options?: PromptOptions<boolean>,
  ): Promise<boolean> {
    const defaultVal = options?.default;
    const yesNo = defaultVal === true ? "Y/n" : defaultVal === false ? "y/N" : "y/n";
    const display = `${promptText} [${yesNo}]:`;

    while (true) {
      const answer = await ask(display, input);
      const value = answer.trim().toLowerCase();

      if (value === "" && defaultVal !== undefined) return defaultVal;
      if (value === "y" || value === "yes") return true;
      if (value === "n" || value === "no") return false;
    }
  }
}
