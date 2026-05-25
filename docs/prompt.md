# Prompts

`Prompt` classes display a question, read a line of input, validate it, and loop until a valid response is received. Prompt text can contain markup and emoji.

## Input capability

The prompt classes don't know where input comes from — they take a `PromptInput` function as a required second argument. Node consumers import `nodeAsk` from the `node/prompt` subpath; tests and browser code can pass a custom function.

```typescript
import { Prompt } from "@promptctl/rich-js";
import { nodeAsk } from "@promptctl/rich-js/node/prompt";
```

Reusing `nodeAsk` keeps the main `@promptctl/rich-js` barrel browser-safe — `node:readline` only loads when the consumer imports the node subpath.

## Basic string prompt

```typescript
const name = await Prompt.ask(
  "[bold cyan]What is your name?[/bold cyan]",
  nodeAsk,
);
console.print(`Hello, [bold]${name}[/bold]!`);
```

## Default value

Provide a default that is returned when the user presses Enter without typing anything. The default is shown in the prompt:

```typescript
const host = await Prompt.ask("Host", nodeAsk, { default: "localhost" });
// Displays: Host [localhost]:
```

## Constrained choices

Provide a list of valid choices — the prompt loops until the user enters one:

```typescript
const env = await Prompt.ask(
  "Environment",
  nodeAsk,
  { choices: ["dev", "staging", "prod"] },
);
// Displays: Environment (dev/staging/prod):

// Case-insensitive matching
const level = await Prompt.ask(
  "Log level",
  nodeAsk,
  { choices: ["DEBUG", "INFO", "WARN", "ERROR"], caseSensitive: false },
);
```

## Typed prompts

Specialized prompt types parse and validate the input type:

```typescript
import { IntPrompt, FloatPrompt } from "@promptctl/rich-js";

const port = await IntPrompt.ask("Port number", nodeAsk, { default: 3000 });
// Returns: number

const threshold = await FloatPrompt.ask("Threshold (0.0–1.0)", nodeAsk);
// Returns: number — reprompts if input is not a valid float
```

## Confirm prompt

A yes/no question that returns a boolean:

```typescript
import { Confirm } from "@promptctl/rich-js";

const proceed = await Confirm.ask("Deploy to production?", nodeAsk);
// Displays: Deploy to production? [y/n]:
// Returns: true | false

if (proceed) {
  await deploy();
}
```

The confirm prompt also supports a default:

```typescript
const ok = await Confirm.ask("Continue?", nodeAsk, { default: true });
// Displays: Continue? [Y/n]:  ← capital Y indicates the default
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
```

The renderable always appends a single trailing space to the rendered prompt before passing it to the input function, so custom implementations should not add their own.
