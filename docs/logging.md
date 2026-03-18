# Logging Handler

rich-js provides a logging handler that formats log records with colors and layout matching the library's output. Log lines get timestamps, level indicators, and auto-highlighted messages. It slots into the standard Node.js logging ecosystem.

## Basic setup

```typescript
import { createLogger, transports, format } from "winston";  // or pino, etc.
import { RichHandler } from "rich-js";

// Using with a standard logging library
const logger = createLogger({
  level: "info",
  transports: [new RichHandler()],
});

logger.info("Server started on port 3000");
logger.warn("Cache miss — falling back to database");
logger.error("Connection refused", { host: "db.internal" });
```

Or with Node.js's built-in `console`:

```typescript
import { RichHandler, Console } from "rich-js";

const console = new Console();
const handler = new RichHandler({ console });

handler.emit({ level: "INFO", message: "Server started" });
```

## Markup in log messages

Markup is **disabled by default** in log messages. This is intentional — most code that calls into a logger is not markup-aware and may contain brackets from non-markup context (e.g., `[object Object]`, array representations).

Enable markup per-handler:

```typescript
const handler = new RichHandler({ markup: true });
logger.info("[bold green]Startup complete[/bold green]");
```

Enable markup per-message:

```typescript
logger.info("[bold]Important[/bold]", { extra: { markup: true } });
```

::: tip Why markup is off by default
If your logger receives messages from third-party libraries, those messages may contain `[...]` characters that happen to look like markup tags. Leaving markup disabled prevents accidental misrendering.
:::

## Highlighter per message

Override the highlighter for a specific log call:

```typescript
import { NullHighlighter } from "rich-js";

// Disable highlighting for this specific message
logger.info("Raw output: [no highlighting here]", {
  extra: { highlighter: new NullHighlighter() },
});
```

## Rich tracebacks in exceptions

Enable rich traceback formatting for exceptions logged via `logger.exception()` or `logger.error()`:

```typescript
const handler = new RichHandler({ richTracebacks: true });
```

Now when you log an exception, it renders with the full rich traceback:

```typescript
try {
  await processData();
} catch (error) {
  logger.error("Processing failed", { error });
}
```

## Suppressing frames in tracebacks

When using `richTracebacks`, suppress framework frames the same way as the standalone traceback:

```typescript
const handler = new RichHandler({
  richTracebacks: true,
  tracebacksSuppress: ["node_modules/express", "node_modules/@fastify"],
});
```

See [Tracebacks](./traceback#suppressing-frames) for details.
