---
exampleContext: |
  const deploy = async () => {
    console.print("[bold green]:rocket: deployed[/]");
  };
---

# Prompts

`Prompt` classes display a question, read a line of input, validate it, and loop until a valid response is received. Prompt text can contain markup and emoji.

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

Provide a list of valid choices — the prompt loops until the user enters one. Try an answer that is not on the list first:

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

Specialized prompt types parse and validate the input type:

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

A yes/no question that returns a boolean:

```typescript live
import { Confirm } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const proceed = await Confirm.ask("Deploy to production?", nodeAsk);

if (proceed) {
  await deploy();
}
```

Here `deploy()` stands for your own deployment step.

The confirm prompt also supports a default:

```typescript live
import { nodeAsk } from "@promptctl/rich-js/node/prompt";

const ok = await Confirm.ask("Continue?", nodeAsk, { default: true });
console.print(ok ? "[green]continuing[/]" : "[red]stopped[/]");
```

## Custom input sources

`PromptInput` is `(prompt: string) => Promise<string>`. Use it to wire tests, browser shells, or non-stdin sources:

```typescript
import { Prompt, Confirm } from "@promptctl/rich-js";
import type { PromptInput } from "@promptctl/rich-js";

// In a test: a queue of pre-canned answers
const answers = ["Alice", "yes"];
const fakeAsk: PromptInput = async () => answers.shift()!;

const name = await Prompt.ask("Name?", fakeAsk);
const confirmed = await Confirm.ask("Proceed?", fakeAsk);
console.print({ name, confirmed });
```

The renderable always appends a single trailing space to the rendered prompt before passing it to the input function, so custom implementations should not add their own.
