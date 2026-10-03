import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import type { RichText } from "../../src/core/text.js";
import { Theme } from "../../src/core/style.js";
import { Confirm, FloatPrompt, IntPrompt, Prompt, type PromptInput } from "../../src/renderables/prompt.js";

// [LAW:behavior-not-structure] What a prompt shows the reader: its text and the
// bytes a colour terminal draws it as, compared with the same prompt written
// out in markup by hand.

/** Draws `item` on a 256-colour terminal, with no line ending of its own. */
function draw(item: RichText | string): string {
  const chunks: string[] = [];
  const file = { write: (data: string) => (chunks.push(data), true) } as NodeJS.WritableStream;
  new Console({ file, width: 80, colorSystem: "256", forceTerminal: true, highlight: false }).print(item, { end: "" });
  return chunks.join("");
}

/**
 * `run` answered with each of `answers` in turn, on a 256-colour console:
 * what it returned, the prompts it showed, and what it printed between them.
 */
async function answered<T>(run: (input: PromptInput, console: Console) => Promise<T>, ...answers: string[]) {
  const chunks: string[] = [];
  const file = { write: (data: string) => (chunks.push(data), true) };
  const console = new Console({ file, width: 80, colorSystem: "256", forceTerminal: true, highlight: false });
  const prompts: RichText[] = [];
  const consoles: Console[] = [];
  const value = await run(async (prompt, asked) => {
    prompts.push(prompt);
    consoles.push(asked);
    const answer = answers.shift();
    if (answer === undefined) throw new Error(`asked again after the last answer: ${prompt.plain}`);
    return answer;
  }, console);
  return { value, prompts, consoles, console, printed: chunks.join(""), unused: answers };
}

/** The prompt `run` shows its input, answered with `answer` — one the prompt accepts, or it asks forever. */
async function shown(run: (input: PromptInput) => Promise<unknown>, answer: string): Promise<RichText> {
  let seen: RichText | undefined;
  await run(async (prompt) => {
    seen = prompt;
    return answer;
  });
  return seen!;
}

describe("Prompt", () => {
  it("shows its choices, which open on a lowercase letter, rather than reading them as a tag", async () => {
    const prompt = await shown((input) => Prompt.ask("Environment", input, { choices: ["dev", "staging", "prod"] }), "dev");
    expect(prompt.plain).toBe("Environment [dev/staging/prod]: ");
  });

  it("draws the prompt's markup, its choices in prompt.choices and its default in prompt.default", async () => {
    const prompt = await shown((input) =>
      Prompt.ask("[bold cyan]Env[/bold cyan]", input, { choices: ["dev", "prod"], default: "dev" }),
      "",
    );
    expect(draw(prompt)).toBe(draw("[bold cyan]Env[/bold cyan] [bold magenta]\\[dev/prod][/] [bold cyan](dev)[/]: "));
  });

  it("draws a choice that looks like markup as the characters it is", async () => {
    const prompt = await shown((input) => Prompt.ask("Pick", input, { choices: ["[b]", "c"] }), "c");
    expect(prompt.plain).toBe("Pick [[b]/c]: ");
  });

  it("leaves out what showChoices and showDefault turn off", async () => {
    const prompt = await shown((input) =>
      Prompt.ask("Env", input, { choices: ["dev"], default: "dev", showChoices: false, showDefault: false }),
      "",
    );
    expect(prompt.plain).toBe("Env: ");
  });
});

describe("IntPrompt and FloatPrompt", () => {
  it.each(["+5", "007", "-0", "1_000", " 42 ", "-17"])("IntPrompt reads %j as Python's int() does", async (answer) => {
    const { value } = await answered((input, console) => IntPrompt.ask("n", input, { console }), answer);
    expect(Object.is(value, Number(answer.trim().replaceAll("_", "")) + 0)).toBe(true);
  });

  it.each(["1.5", "abc", "1_", "_1", "1__0", "0x10", "1e3", "9007199254740993", " "])(
    "IntPrompt refuses %j, prints Rich's message in prompt.invalid and asks again",
    async (answer) => {
      const { value, printed, prompts } = await answered((input, console) => IntPrompt.ask("n", input, { console }), answer, "3");
      expect(value).toBe(3);
      expect(prompts).toHaveLength(2);
      expect(printed).toBe(draw("[red]Please enter a valid integer number[/]") + "\n");
    },
  );

  it.each([
    ["1.5", 1.5], [".5", 0.5], ["5.", 5], ["1e3", 1000], ["-2.5E-1", -0.25], ["1_000.0_1", 1000.01],
    ["inf", Infinity], ["-Infinity", -Infinity], ["+5", 5],
  ])("FloatPrompt reads %j as Python's float() does", async (answer, expected) => {
    const { value } = await answered((input, console) => FloatPrompt.ask("x", input, { console }), answer);
    expect(value).toBe(expected);
  });

  it("FloatPrompt reads nan as NaN", async () => {
    const { value } = await answered((input, console) => FloatPrompt.ask("x", input, { console }), "NaN");
    expect(value).toBeNaN();
  });

  it.each(["1abc", "3.2.1", "0.5 volts", "e5", ".", "1_.5", "infinite"])(
    "FloatPrompt refuses %j, prints Rich's message in prompt.invalid and asks again",
    async (answer) => {
      const { value, printed } = await answered((input, console) => FloatPrompt.ask("x", input, { console }), answer, "2");
      expect(value).toBe(2);
      expect(printed).toBe(draw("[red]Please enter a number[/]") + "\n");
    },
  );

  it("draw their choices and hold the answer to them, refusing an off-list number with Rich's choice message", async () => {
    const int = await answered((input, console) => IntPrompt.ask("n", input, { console, choices: ["1", "2"] }), "3", "x", "2");
    expect(int.prompts[0]!.plain).toBe("n [1/2]: ");
    expect(int.value).toBe(2);
    expect(int.printed).toBe(
      draw("[red]Please select one of the available options[/]") + "\n" +
      draw("[red]Please enter a valid integer number[/]") + "\n",
    );
    const float = await answered((input, console) => FloatPrompt.ask("x", input, { console, choices: ["INF"], caseSensitive: false }), "inf");
    expect(float.value).toBe(Infinity);
  });

  it("show their default in prompt.default", async () => {
    const int = await shown((input) => IntPrompt.ask("Port", input, { default: 3000 }), "");
    const float = await shown((input) => FloatPrompt.ask("Ratio", input, { default: 0.5 }), "");
    expect(draw(int)).toBe(draw("Port [bold cyan](3000)[/]: "));
    expect(draw(float)).toBe(draw("Ratio [bold cyan](0.5)[/]: "));
  });
});

describe("Confirm", () => {
  it.each([
    { default: undefined, shown: "Deploy? [bold magenta]\\[y/n][/]: " },
    { default: true, shown: "Deploy? [bold magenta]\\[y/n][/] [bold cyan](y)[/]: " },
    { default: false, shown: "Deploy? [bold magenta]\\[y/n][/] [bold cyan](n)[/]: " },
  ])("draws its default as Rich does when it is $default", async ({ default: dflt, shown: markup }) => {
    const prompt = await shown((input) => Confirm.ask("Deploy?", input, { default: dflt }), "y");
    expect(draw(prompt)).toBe(draw(markup));
  });

  it("leaves out what showChoices and showDefault turn off", async () => {
    const prompt = await shown((input) => Confirm.ask("Deploy?", input, { default: true, showChoices: false, showDefault: false }), "y");
    expect(prompt.plain).toBe("Deploy?: ");
  });

  it("asks with its own choices, the first meaning yes", async () => {
    const { value, prompts } = await answered((input, console) =>
      Confirm.ask("Ship?", input, { console, choices: ["si", "no"], default: true }), "NO");
    expect(prompts[0]!.plain).toBe("Ship? [si/no] (si): ");
    expect(value).toBe(false);
  });

  it("matches choices spelled with a capital, which Rich's Confirm never can", async () => {
    const { value, unused } = await answered((input, console) => Confirm.ask("Ok?", input, { console, choices: ["Y", "N"] }), "y");
    expect(value).toBe(true);
    expect(unused).toEqual([]);
  });

  it.each([["Y", true], [" n ", false]])("reads %j in any case", async (answer, expected) => {
    const { value } = await answered((input, console) => Confirm.ask("Ok?", input, { console }), answer);
    expect(value).toBe(expected);
  });

  it("refuses anything but its two choices with Rich's message, yes and no included", async () => {
    const { value, printed } = await answered((input, console) => Confirm.ask("Ok?", input, { console }), "yes", "no", "y");
    expect(value).toBe(true);
    expect(printed).toBe(draw("[red]Please enter Y or N[/]\n[red]Please enter Y or N[/]") + "\n");
  });
});

describe("Prompt answers", () => {
  it("refuses an off-list answer with Rich's choice message in prompt.invalid.choice", async () => {
    const { value, printed } = await answered((input, console) =>
      Prompt.ask("Env", input, { console, choices: ["dev", "prod"] }), "test", "prod");
    expect(value).toBe("prod");
    expect(printed).toBe(draw("[red]Please select one of the available options[/]") + "\n");
  });

  it("draws no hint for an empty list of choices, as Rich's `self.choices` test does", async () => {
    const { prompts } = await answered((input, console) => Prompt.ask("Name", input, { console, choices: [], default: "x" }), "");
    expect(prompts[0]!.plain).toBe("Name (x): ");
  });

  it("prints its message as markup on a console that reads none", async () => {
    const chunks: string[] = [];
    const file = { write: (data: string) => (chunks.push(data), true) };
    const console = new Console({ file, width: 80, colorSystem: "256", forceTerminal: true, highlight: false, markup: false });
    const answers = ["x", "1"];
    await IntPrompt.ask("N", async () => answers.shift()!, { console });
    expect(chunks.join("")).toBe(draw("[red]Please enter a valid integer number[/]") + "\n");
  });

  it("answers a case-insensitive match with the choice as written", async () => {
    const { value } = await answered((input, console) =>
      Prompt.ask("Level", input, { console, choices: ["WARN"], caseSensitive: false }), " warn ");
    expect(value).toBe("WARN");
  });

  it("returns the default only for an answer of nothing, as typed", async () => {
    const empty = await answered((input, console) => Prompt.ask("Host", input, { console, default: "localhost" }), "");
    const spaces = await answered((input, console) => Prompt.ask("Host", input, { console, default: "localhost" }), "  ");
    expect([empty.value, spaces.value]).toEqual(["localhost", ""]);
  });

  it("hands its input the console it was given, and prints in that console's theme", async () => {
    const chunks: string[] = [];
    const console = new Console({
      file: { write: (data: string) => chunks.push(data) },
      colorSystem: "256",
      forceTerminal: true,
      theme: new Theme({ "prompt.invalid.choice": "green" }),
    });
    const { consoles } = await answered((input) => Prompt.ask("Env", input, { console, choices: ["a"] }), "b", "a");
    expect(consoles).toEqual([console, console]);
    expect(chunks.join("")).toBe(draw("[green]Please select one of the available options[/]") + "\n");
  });
});
