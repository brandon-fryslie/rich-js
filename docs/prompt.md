---
exampleContext: |
  const deploy = async () => {
    console.print("[bold green]:rocket: deployed[/]");
  };
---

# Prompts

`Prompt` classes display a question, read a line of input, validate it, and loop until a valid response is received, printing why each refused answer was refused. Prompt text can contain markup and emoji. The choices and default a prompt appends are drawn as written, in the theme's `prompt.choices` and `prompt.default` styles; the message after a refused answer is drawn in `prompt.invalid`, or `prompt.invalid.choice` when the answer was not one of the choices.

## Input capability

The prompt classes don't know where input comes from — they take a `PromptInput` function as a required second argument. Node consumers import `nodeAsk` from the `node/prompt` subpath; tests and browser code can pass a custom function.

The examples on this page run live: click one, then type your answer and press Enter.

```typescript silent
import { Prompt } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";
```

Reusing `nodeAsk` keeps the main `@promptctl/rich-js` barrel browser-safe — `node:readline` only loads when the consumer imports the node subpath.

## Basic string prompt

```typescript live
import { Prompt } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const name = await Prompt.ask(
  "[bold cyan]What is your name?[/bold cyan]",
  nodeAsk,
);
console.print(`Hello, [bold magenta]${name}[/bold magenta]! :wave:`);
```

## Default value

Provide a default that is returned when the user presses Enter without typing anything. The default is shown in the prompt:

```typescript live
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const host = await Prompt.ask("Host", nodeAsk, { default: "localhost" });
console.print(`Connecting to [bold cyan]${host}[/]…`);
```

## Constrained choices

Provide a list of valid choices — the prompt loops until the user enters one, printing *Please select one of the available options* after each answer that is not on the list. Try one first:

```typescript live
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const env = await Prompt.ask(
  "Environment",
  nodeAsk,
  { choices: ["dev", "staging", "prod"] },
);

// Case-insensitive matching: "warn" is accepted as WARN
const level = await Prompt.ask(
  "Log level",
  nodeAsk,
  { choices: ["DEBUG", "INFO", "WARN", "ERROR"], caseSensitive: false },
);
console.print(`[bold]${env}[/] at [yellow]${level}[/]`);
```

## Typed prompts

Specialized prompt types parse the answer as Python's `int()` and `float()` read a string, as Rich's do. `IntPrompt` takes a sign, leading zeros and `_` between digits (`+5`, `007`, `1_000`), and refuses an integer too large for a `number` to hold exactly. `FloatPrompt` takes the same, plus a decimal point, an exponent, `inf` and `nan`, and refuses anything after the number (`0.5 volts`). Each prints its own message on a refused answer, and both take `choices`, drawn and held to as `Prompt` does:

```typescript live
import { IntPrompt, FloatPrompt } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const port = await IntPrompt.ask("Port number", nodeAsk, { default: 3000 });

// Reprompts until the input is a valid float
const threshold = await FloatPrompt.ask("Threshold (0.0–1.0)", nodeAsk);
console.print({ port, threshold });
```

Both return a `number`.

## Confirm prompt

A yes/no question that returns a boolean. It takes `y` or `n` in either case — not `yes` or `no` — and prints *Please enter Y or N* after anything else:

```typescript live
import { Confirm } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const proceed = await Confirm.ask("Deploy to production?", nodeAsk);

if (proceed) {
  await deploy();
}
```

Here `deploy()` stands for your own deployment step.

The confirm prompt also supports a default, drawn after the choices as `(y)` or `(n)`. Its `choices` option replaces the pair, yes first:

```typescript live
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const ok = await Confirm.ask("Continue?", nodeAsk, { default: true });
const sure = await Confirm.ask("¿Seguro?", nodeAsk, { choices: ["s", "n"] });
console.print(ok && sure ? "[green]continuing[/]" : "[red]stopped[/]");
```

## Your app's Console

A prompt is drawn with a `Console`, and its refused-answer messages are printed on it. Pass your app's as `console` — Rich's `console=` — and the prompt takes its theme, its colour system and the stream it writes to. Without one, each `ask` makes a default `Console` — which in a browser has no stream to print on, so pass one there.

```typescript live
import { Console, Prompt, Theme } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const app = new Console({
  theme: new Theme({ "prompt.choices": "bold green", "prompt.invalid.choice": "yellow" }),
});
const env = await Prompt.ask("Environment", nodeAsk, { choices: ["dev", "prod"], console: app });
app.print(`[bold]${env}[/]`);
```

`nodeAsk` prints the prompt as any `print` on that console goes — into a capture you have open, too — then reads the line in the terminal's own line editing, as Rich's `input()` does. It asks on the console's own target: a `Console({ stderr: true })` prompts on stderr, coloured for stderr, with its messages beside it. `colorSystem: null` draws the prompt in plain text.

## Custom input sources

`PromptInput` is `(prompt: RichText, console: Console) => Promise<string>`. The prompt arrives as styled text, ending in the `": "` the answer is typed after, with the console it is drawn on; drawing it is the input's job. Use it to wire tests, browser shells, or non-stdin sources:

```typescript
import { Prompt, Confirm } from "@promptctl/rich-js";
import type { PromptInput } from "@promptctl/rich-js";

// In a test: a queue of pre-canned answers
const answers = ["Alice", "maybe", "y"];
const fakeAsk: PromptInput = async () => answers.shift()!;

const name = await Prompt.ask("Name?", fakeAsk, { console });
const confirmed = await Confirm.ask("Proceed?", fakeAsk, { console });
console.print({ name, confirmed });
```

`maybe` is refused, so `Confirm` prints its message on `console` and asks again.
