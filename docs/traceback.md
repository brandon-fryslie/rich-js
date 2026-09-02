# Tracebacks

Rich tracebacks show the code that caused an error, syntax-highlighted, with more context than a plain Node.js stack trace. They are especially useful for deeply nested errors where the plain trace gives you file names and line numbers but not the surrounding code.

## Printing a caught exception

Catch an error and print a rich traceback:

```typescript
import { Console, Traceback } from "@promptctl/rich-js";

const console = new Console();

try {
  riskyOperation();
} catch (error) {
  console.print(new Traceback(error));
}
```

The `showLocals` option displays a table of local variable values for each stack frame — this is the most impactful feature for debugging:

```typescript
try {
  processUser(user);
} catch (error) {
  console.print(new Traceback(error, { showLocals: true }));
}
```

```
╭─ TypeError ──────────────────────────────────────────────────────────╮
│                                                                      │
│  processUser (src/users.ts:42)                                       │
│                                                                      │
│  40 │   const result = validate(user);                               │
│  41 │   if (!result.ok) {                                            │
│ ❱42 │     throw new TypeError(`Invalid field: ${result.field}`);     │
│  43 │   }                                                            │
│                                                                      │
│  ╭─ locals ───────────────────────────────────────────────────────╮  │
│  │  user    = User { id: 42, name: 'Alice', role: undefined }     │  │
│  │  result  = { ok: False, field: 'role' }                        │  │
│  ╰────────────────────────────────────────────────────────────────╯  │
╰──────────────────────────────────────────────────────────────────────╯
```

## Installing as the global handler

Register rich tracebacks for every crash — both uncaught exceptions and unhandled promise rejections. Put this at the entry point of your application:

```typescript
import { installTraceback } from "@promptctl/rich-js/node/traceback";

// All crashes now use rich formatting
installTraceback();
```

Calling it again replaces the handler rather than adding a second one, so a process always has exactly one rich crash renderer and the last call's options are the ones in force.

A crash payload that is not an `Error` — `Promise.reject("nope")`, or `throw 42`, both of which JavaScript permits — renders under the name `NonError` with the value inspected and no stack frames, because there are none to report.

`installTraceback` lives on the `node/traceback` subpath because it calls `process.on` and `process.exit`; the `Traceback` renderable itself is pure rendering and stays in the main barrel, which remains browser-safe.

::: tip Placement
Call `installTraceback()` as early as possible in your application entry point — before any other imports that might throw.
:::

## Suppressing frames

Framework and library frames are noise when debugging your own code. The `suppress` option hides implementation details, showing only the file and line without code:

```typescript
import express from "express";

installTraceback({
  suppress: [express, "node_modules/express"],
});
```

Suppressed frames collapse to a single dim line showing the location, keeping the traceback focused on your code.

## Max frames

Deep recursion can produce hundreds of frames. By default, only the first and last N frames are shown with a count of the omitted middle:

```
... 248 frames omitted ...
```

Adjust the cap:

```typescript
new Traceback(error, { maxFrames: 20 })
```

Pass `maxFrames: 0` to disable the cap and show every frame (use with caution for recursive errors).
