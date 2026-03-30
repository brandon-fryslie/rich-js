# Doc Spec: Logging Handler

The logging doc explains how to integrate the library's formatting with the platform's built-in logging infrastructure.

## Sections

### What it provides

One paragraph: a logging handler that formats log records with colors and layout matching the library's output. Log lines get timestamps, level indicators, and the message is highlighted. It slots into the standard logging configuration.

### Basic setup

Show the minimal configuration: create a handler, pass it to the logging basicConfig (or equivalent), get a logger, and log a message. Show a real, runnable snippet.

### Markup in log messages

Explain that markup is disabled by default in log messages (because most code that calls into a logger is not markup-aware and may produce unintended tag interpretation). Show how to enable markup:
- Per-handler: `markup: true` on the handler
- Per-message: passing an extra option on the individual log call

### Highlighter per message

Show overriding the highlighter on a per-message basis (e.g., disabling it for a specific log call).

### Rich tracebacks in exceptions

Show `richTracebacks: true` on the handler constructor so that exceptions logged via `log.exception()` or `log.error()` are rendered with rich traceback formatting.

### Suppressing frames

Explain that when using `richTracebacks`, framework frames can be suppressed with the `tracebacksSuppress` option, same as the standalone traceback. Cross-reference the traceback doc.

## Constraints

- Must show the basic setup as a complete, runnable snippet — logging configuration is error-prone and readers need a copy-paste starting point
- Explain why markup is off by default — this is a common source of confusion when migrating from plain logging
