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

import { renderMarkup } from "../core/markup.js";
import { RichText } from "../core/text.js";

// --- Types ---

/**
 * Input capability: receives the prompt to show — styled text, ending in the
 * `": "` the answer is typed after — and resolves with the raw user response.
 * Implementations decide where the prompt is drawn and where the input comes
 * from (stdin readline, network, in-memory queue, etc.).
 *
 * [LAW:effects-at-boundaries] The prompt arrives as a `RichText`, not bytes:
 * which colours a terminal can draw is known only where the terminal is, so
 * the capability that writes to it is the one that encodes it.
 */
export type PromptInput = (prompt: RichText) => Promise<string>;

export interface PromptOptions<T> {
  default?: T;
  choices?: string[];
  caseSensitive?: boolean;
  showChoices?: boolean;
  showDefault?: boolean;
}

// --- Base ---

/** A bracketed or parenthesised hint after the question, drawn in its theme style. */
interface Hint {
  readonly text: string;
  readonly style: "prompt.choices" | "prompt.default";
}

// The prompt as Rich's `make_prompt` draws it: the caller's markup, then each
// hint appended as plain text — never read as markup, so `[y/n]` is drawn and
// not parsed as a tag — then the suffix.
function makePrompt(promptText: string, hints: readonly Hint[]): RichText {
  const prompt = new RichText("", { style: "prompt", end: "" }).append(renderMarkup(promptText));
  for (const hint of hints) prompt.append(" ").append(hint.text, hint.style);
  return prompt.append(": ");
}

function choicesHint(choices: readonly string[]): Hint {
  return { text: `[${choices.join("/")}]`, style: "prompt.choices" };
}

function defaultHint(value: string | number): Hint {
  return { text: `(${value})`, style: "prompt.default" };
}

function ask(prompt: RichText, input: PromptInput): Promise<string> {
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
  // A copy, because a `RichText` is mutable and the same prompt is asked
  // again on every retry.
  return input(prompt.copy());
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

    const display = makePrompt(promptText, [
      ...(showChoices && options?.choices ? [choicesHint(options.choices)] : []),
      ...(showDefault && options?.default !== undefined ? [defaultHint(options.default)] : []),
    ]);

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
    const display = makePrompt(
      promptText,
      showDefault && options?.default !== undefined ? [defaultHint(options.default)] : [],
    );

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
    const display = makePrompt(
      promptText,
      showDefault && options?.default !== undefined ? [defaultHint(options.default)] : [],
    );

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
    const yesNo = defaultVal === true ? ["Y", "n"] : defaultVal === false ? ["y", "N"] : ["y", "n"];
    const display = makePrompt(promptText, [choicesHint(yesNo)]);

    while (true) {
      const answer = await ask(display, input);
      const value = answer.trim().toLowerCase();

      if (value === "" && defaultVal !== undefined) return defaultVal;
      if (value === "y" || value === "yes") return true;
      if (value === "n" || value === "no") return false;
    }
  }
}
