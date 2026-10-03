/**
 * Prompt — interactive prompts for user input, Rich's `rich/prompt.py`.
 *
 * [LAW:locality-or-seam] The renderable owns prompt logic (display, parsing the
 * answer, choice checking, default fallback, the retry loop and the message
 * each rejected answer prints) — but not where the answer comes from. The
 * input source is a required `PromptInput` capability passed at the call site.
 * Node consumers pass `nodeAsk` from `@promptctl/rich-js/node/prompt`; tests
 * pass a fake; the browser bundle gets the classes without dragging
 * `node:readline` into the main barrel.
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

import { Console } from "../core/console.js";
import { renderMarkup } from "../core/markup.js";
import { RichText } from "../core/text.js";

// --- Types ---

/**
 * Input capability: receives the prompt to show — styled text, ending in the
 * `": "` the answer is typed after — and the `Console` the prompt was asked
 * on, and resolves with the raw user response. Implementations decide where
 * the input comes from (stdin readline, network, in-memory queue, etc.); the
 * console is what the prompt is drawn with, as Rich's `Console.input` draws
 * it — its theme, its colours, the target it writes to.
 *
 * [LAW:effects-at-boundaries] The prompt arrives as a `RichText`, not bytes:
 * encoding it is the console's job, and the console arrives with it.
 */
export type PromptInput = (prompt: RichText, console: Console) => Promise<string>;

export interface PromptOptions<T> {
  default?: T;
  choices?: readonly string[];
  caseSensitive?: boolean;
  showChoices?: boolean;
  showDefault?: boolean;
  /**
   * The console the prompt is drawn with and its invalid-answer messages are
   * printed on — Rich's `console=`. Default: a new `Console`, made when the
   * prompt is asked.
   */
  console?: Console;
}

/**
 * Confirm's options. Its two choices are the yes answer and the no answer, in
 * that order, and an answer matches one in any letter case — Rich's `Confirm`,
 * which takes no `case_sensitive`, but where Rich lowercases only the answer
 * and so can never match a choice spelled with a capital.
 */
export interface ConfirmOptions extends Omit<PromptOptions<boolean>, "choices" | "caseSensitive"> {
  choices?: readonly [yes: string, no: string];
}

// --- Base ---

/** What the prompt loop reads off every kind's options: how to draw it and what an empty answer returns. */
type AskOptions<T> = Pick<PromptOptions<T>, "default" | "showChoices" | "showDefault" | "console">;

/** An answer the prompt refused, and the markup it prints before asking again — Rich's `InvalidResponse`. */
class InvalidResponse {
  constructor(readonly message: string) {}
}

const ILLEGAL_CHOICE = new InvalidResponse("[prompt.invalid.choice]Please select one of the available options");

/**
 * One kind of prompt: what it draws after the question, and what it makes of
 * an answer — Rich's `PromptBase` subclasses, as values.
 */
interface PromptKind<T> {
  /** The choices drawn after the question, or none. */
  readonly choices: readonly string[] | undefined;
  /** The default as the `(…)` hint shows it. */
  renderDefault(value: T): string;
  /** The answer as typed, made into the prompt's value or refused. */
  process(answer: string): T | InvalidResponse;
}

// The prompt as Rich's `make_prompt` draws it: the caller's markup, then each
// hint appended as plain text — never read as markup, so `[y/n]` is drawn and
// not parsed as a tag — then the suffix.
function makePrompt<T>(promptText: string, kind: PromptKind<T>, options: AskOptions<T>): RichText {
  const prompt = new RichText("", { style: "prompt", end: "" }).append(renderMarkup(promptText));
  // Rich's `if self.show_choices and self.choices`: an empty list draws no hint.
  if (options.showChoices !== false && kind.choices !== undefined && kind.choices.length > 0) {
    prompt.append(" ").append(`[${kind.choices.join("/")}]`, "prompt.choices");
  }
  if (options.showDefault !== false && options.default !== undefined) {
    prompt.append(" ").append(`(${kind.renderDefault(options.default)})`, "prompt.default");
  }
  return prompt.append(": ");
}

// Rich's `PromptBase.__call__`: ask, return the default for an empty answer —
// the answer as typed, so one of spaces is processed rather than defaulted —
// and otherwise process it, printing why it was refused and asking again.
async function run<T>(promptText: string, input: PromptInput, kind: PromptKind<T>, options: AskOptions<T>): Promise<T> {
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
  const console = options.console ?? new Console();
  const prompt = makePrompt(promptText, kind, options);
  while (true) {
    // A copy, because a `RichText` is mutable and the same prompt is asked
    // again on every retry.
    const answer = await input(prompt.copy(), console);
    if (answer === "" && options.default !== undefined) return options.default;
    const value = kind.process(answer);
    if (!(value instanceof InvalidResponse)) return value;
    // The message is this module's markup, read as markup whatever the
    // console's own `markup` setting.
    console.print(renderMarkup(value.message));
  }
}

/**
 * Rich's `PromptBase.process_response`: the stripped answer converted, then
 * checked against the choices — when there are any — and the value of the
 * choice it matched returned, so a case-insensitive match answers with the
 * choice as written. An answer that neither converts nor matches is refused
 * for not converting, the check Rich makes first.
 */
function responseKind<T>(
  convert: (value: string) => T | undefined,
  invalid: InvalidResponse,
  options: PromptOptions<T>,
): PromptKind<T> {
  const choices = options.choices;
  const caseSensitive = options.caseSensitive !== false;
  const matches = (choice: string, value: string): boolean =>
    caseSensitive ? choice === value : choice.toLowerCase() === value.toLowerCase();
  return {
    choices,
    renderDefault: String,
    process(answer) {
      const value = answer.trim();
      // [LAW:dataflow-not-control-flow] With no choices every answer is its
      // own choice. A choice matched is the answer but for letter case, which
      // no number grammar here reads, so it converts exactly when the answer does.
      const choice = choices === undefined ? value : choices.find((c) => matches(c, value));
      const converted = convert(choice ?? value);
      if (converted === undefined) return invalid;
      return choice === undefined ? ILLEGAL_CHOICE : converted;
    },
  };
}

/** Python's `int()` over a string: a sign, then digits, any two of which may have one `_` between them. */
const INTEGER = /^[+-]?\d(?:_?\d)*$/;
const DIGITS = String.raw`\d(?:_?\d)*`;
/** Python's `float()` over a string: a decimal with an optional exponent, or `inf`, `infinity` or `nan`, in any case. */
const FLOAT = new RegExp(String.raw`^[+-]?(?:(?:${DIGITS}(?:\.(?:${DIGITS})?)?|\.${DIGITS})(?:e[+-]?${DIGITS})?|inf(?:inity)?|nan)$`, "i");

/**
 * The integer an answer spells, as Python's `int()` reads it, or none. One a
 * `number` cannot hold exactly is none: Python's int is unbounded and a
 * rounded value is not the number typed, so it is refused rather than changed.
 */
function pythonInt(value: string): number | undefined {
  if (!INTEGER.test(value)) return undefined;
  // `+ 0` folds `-0` into 0: Python has no negative integer zero.
  const integer = Number(value.replaceAll("_", "")) + 0;
  return Number.isSafeInteger(integer) ? integer : undefined;
}

/** The number an answer spells, as Python's `float()` reads it, or none. */
function pythonFloat(value: string): number | undefined {
  if (!FLOAT.test(value)) return undefined;
  return Number(value.replaceAll("_", "").toLowerCase().replace(/inf(inity)?$/, "Infinity"));
}

// --- Prompt ---

export class Prompt {
  static ask(promptText: string, input: PromptInput, options: PromptOptions<string> = {}): Promise<string> {
    // Rich's base message, which a string prompt never prints: every answer converts.
    const kind = responseKind((value) => value, new InvalidResponse("[prompt.invalid]Please enter a valid value"), options);
    return run(promptText, input, kind, options);
  }
}

export class IntPrompt {
  static ask(promptText: string, input: PromptInput, options: PromptOptions<number> = {}): Promise<number> {
    const kind = responseKind(pythonInt, new InvalidResponse("[prompt.invalid]Please enter a valid integer number"), options);
    return run(promptText, input, kind, options);
  }
}

export class FloatPrompt {
  static ask(promptText: string, input: PromptInput, options: PromptOptions<number> = {}): Promise<number> {
    const kind = responseKind(pythonFloat, new InvalidResponse("[prompt.invalid]Please enter a number"), options);
    return run(promptText, input, kind, options);
  }
}

const CONFIRM_INVALID = new InvalidResponse("[prompt.invalid]Please enter Y or N");

export class Confirm {
  static ask(promptText: string, input: PromptInput, options: ConfirmOptions = {}): Promise<boolean> {
    const [yes, no] = options.choices ?? ["y", "n"];
    const kind: PromptKind<boolean> = {
      choices: [yes, no],
      renderDefault: (value) => (value ? yes : no),
      process(answer) {
        const value = answer.trim().toLowerCase();
        if (value === yes.toLowerCase()) return true;
        return value === no.toLowerCase() ? false : CONFIRM_INVALID;
      },
    };
    return run(promptText, input, kind, options);
  }
}
