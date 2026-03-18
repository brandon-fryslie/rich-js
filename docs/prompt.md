# Prompts

`Prompt` classes display a question, read a line of input, validate it, and loop until a valid response is received. Prompt text can contain markup and emoji.

## Basic string prompt

```typescript
import { Prompt } from "rich-js";

const name = await Prompt.ask("[bold cyan]What is your name?[/bold cyan]");
console.print(`Hello, [bold]${name}[/bold]!`);
```

## Default value

Provide a default that is returned when the user presses Enter without typing anything. The default is shown in the prompt:

```typescript
const host = await Prompt.ask("Host", { default: "localhost" });
// Displays: Host [localhost]:
```

## Constrained choices

Provide a list of valid choices — the prompt loops until the user enters one:

```typescript
const env = await Prompt.ask(
  "Environment",
  { choices: ["dev", "staging", "prod"] },
);
// Displays: Environment (dev/staging/prod):

// Case-insensitive matching
const level = await Prompt.ask(
  "Log level",
  { choices: ["DEBUG", "INFO", "WARN", "ERROR"], caseSensitive: false },
);
```

## Typed prompts

Specialized prompt types parse and validate the input type:

```typescript
import { IntPrompt, FloatPrompt } from "rich-js";

const port = await IntPrompt.ask("Port number", { default: 3000 });
// Returns: number

const threshold = await FloatPrompt.ask("Threshold (0.0–1.0)");
// Returns: number — reprompts if input is not a valid float
```

## Confirm prompt

A yes/no question that returns a boolean:

```typescript
import { Confirm } from "rich-js";

const proceed = await Confirm.ask("Deploy to production?");
// Displays: Deploy to production? [y/n]:
// Returns: true | false

if (proceed) {
  await deploy();
}
```

The confirm prompt also supports a default:

```typescript
const ok = await Confirm.ask("Continue?", { default: true });
// Displays: Continue? [Y/n]:  ← capital Y indicates the default
```

## Customization

`Prompt` is designed for subclassing. Override `process()` to add custom validation or transformation, or override `render()` to change how the prompt is displayed.
