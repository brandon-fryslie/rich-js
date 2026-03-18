# Tracebacks

Rich tracebacks show the code that caused an error, syntax-highlighted, with more context than a plain Node.js stack trace. They are especially useful for deeply nested errors where the plain trace gives you file names and line numbers but not the surrounding code.

## Printing a caught exception

Catch an error and print a rich traceback:

```typescript
import { Console, Traceback } from "rich-js";

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

Register rich tracebacks for all unhandled exceptions. Put this at the entry point of your application:

```typescript
import { Traceback } from "rich-js";

// All uncaught exceptions now use rich formatting
Traceback.install({ showLocals: true });
```

::: tip Placement
Call `Traceback.install()` as early as possible in your application entry point — before any other imports that might throw.
:::

## Suppressing frames

Framework and library frames are noise when debugging your own code. The `suppress` option hides implementation details, showing only the file and line without code:

```typescript
import express from "express";

Traceback.install({
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
