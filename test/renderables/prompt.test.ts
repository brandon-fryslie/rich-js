import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import type { RichText } from "../../src/core/text.js";
import { Confirm, FloatPrompt, IntPrompt, Prompt, type PromptInput } from "../../src/renderables/prompt.js";

// [LAW:behavior-not-structure] What a prompt shows the reader: its text and the
// bytes a colour terminal draws it as, compared with the same prompt written
// out in markup by hand.

/** Draws `item` on a 256-colour terminal, with no line ending of its own. */
function draw(item: RichText | string): string {
  const chunks: string[] = [];
  const file = { write: (data: string) => (chunks.push(data), true) } as NodeJS.WritableStream;
  new Console({ file, width: 80, colorSystem: "256", forceTerminal: true }).print(item, { end: "" });
  return chunks.join("");
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
  it("show their default in prompt.default", async () => {
    const int = await shown((input) => IntPrompt.ask("Port", input, { default: 3000 }), "");
    const float = await shown((input) => FloatPrompt.ask("Ratio", input, { default: 0.5 }), "");
    expect(draw(int)).toBe(draw("Port [bold cyan](3000)[/]: "));
    expect(draw(float)).toBe(draw("Ratio [bold cyan](0.5)[/]: "));
  });
});

describe("Confirm", () => {
  it.each([
    { default: undefined, hint: "[y/n]" },
    { default: true, hint: "[Y/n]" },
    { default: false, hint: "[y/N]" },
  ])("shows $hint in prompt.choices when the default is $default", async ({ default: dflt, hint }) => {
    const prompt = await shown((input) => Confirm.ask("Deploy?", input, { default: dflt }), "y");
    expect(prompt.plain).toBe(`Deploy? ${hint}: `);
    expect(draw(prompt)).toBe(draw(`Deploy? [bold magenta]\\${hint}[/]: `));
  });
});
