/**
 * Prompt — interactive prompts for user input.
 */

import * as readline from "node:readline";
import { Console } from "../core/console.js";
import { render as renderMarkup } from "../core/markup.js";

// --- Types ---

export interface PromptOptions<T> {
  default?: T;
  choices?: string[];
  caseSensitive?: boolean;
  console?: Console;
  showChoices?: boolean;
  showDefault?: boolean;
}

// --- Base ---

function ask(
  promptText: string,
  _options?: { console?: Console },
): Promise<string> {
  const rendered = renderMarkup(promptText);

  return new Promise<string>((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });
    rl.question(rendered.plain + " ", (answer) => {
      rl.close();
      resolve(answer);
    });
  });
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
      const answer = await ask(display, { console: options?.console });
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
        // Invalid choice — retry
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
      const answer = await ask(display, { console: options?.console });
      const value = answer.trim();

      if (value === "" && options?.default !== undefined) {
        return options.default;
      }

      const num = parseInt(value, 10);
      if (!isNaN(num) && String(num) === value) return num;
      // Invalid — retry
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
      const answer = await ask(display, { console: options?.console });
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
      const answer = await ask(display, { console: options?.console });
      const value = answer.trim().toLowerCase();

      if (value === "" && defaultVal !== undefined) return defaultVal;
      if (value === "y" || value === "yes") return true;
      if (value === "n" || value === "no") return false;
    }
  }
}
