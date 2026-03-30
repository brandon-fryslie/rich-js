# Doc Spec: Traceback

The traceback doc explains how to render error stack traces with syntax highlighting and additional context.

## Sections

### What it provides

One paragraph: rich tracebacks show the code that caused the error, syntax-highlighted, with more context than a plain stack trace. They are easier to read, especially for deeply nested errors.

### Printing a caught exception

Show catching an exception and printing a traceback for it. Show the `showLocals` option which displays a table of local variable values for each stack frame — useful for debugging.

### Installing as the global handler

Show registering the library's traceback handler so that all uncaught exceptions use rich formatting automatically. Show the `showLocals` option here too.

### Suppressing frames

Explain the use case: when using a framework (e.g., a web framework, CLI library), the framework's internal frames are noise. Show the `suppress` option, which accepts a list of modules or path strings. Suppressed frames show only the file and line, without code.

### Max frames

Explain that deep recursion can produce hundreds of frames. Explain the default cap and the first-N/last-N behavior when the cap is exceeded. Show the `maxFrames` option for tuning. Mention that `maxFrames: 0` disables the cap.

## Constraints

- The `showLocals` option must be shown early — it is the most impactful feature for debugging
- The global handler installation section must include a note about where to put it (entry point of the application)
- Do not describe the frame data structure internally
