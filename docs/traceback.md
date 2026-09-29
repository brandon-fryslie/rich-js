---
exampleContext: |
  // The reader's application, standing in for code that throws. Each error
  // carries the stack Node records for it in a real app, so the paths shown
  // are the app's own rather than the docs build's.
  const withStack = <E extends Error>(error: E, frames: string[]): E => {
    error.stack = [`${error.name}: ${error.message}`, ...frames.map((frame) => `    at ${frame}`)].join("\n");
    return error;
  };
  const user = { name: "Alice", role: "owner" };
  const processUser = (_user: typeof user): void => {
    throw withStack(new TypeError("Invalid field: role"), [
      "processUser (/app/src/users.ts:42:11)",
      "Layer.handle (/app/node_modules/express/lib/router/layer.js:95:5)",
      "next (/app/node_modules/express/lib/router/route.js:149:13)",
      "main (/app/src/index.ts:12:3)",
    ]);
  };
  const walk = (depth: number): void => {
    throw withStack(new RangeError("Tree too deep"), [
      "walk (file:///app/src/tree.mjs:4:11)",
      ...Array.from({ length: depth }, () => "walk (file:///app/src/tree.mjs:5:10)"),
      "file:///app/src/tree.mjs:9:1",
      "async ModuleJob.run (node:internal/modules/esm/module_job:271:25)",
      "async asyncRunEntryPointWithESMLoader (node:internal/modules/run_main:101:5)",
    ]);
  };
---

# Tracebacks

A rich traceback prints an error as its name and message, followed by one line per stack frame: the function in bold, then its file and line. It is the same information as a plain Node.js stack trace, laid out so the function names and line numbers stand out.

## Printing a caught exception

Catch an error and print a rich traceback. Here `processUser(user)` stands for your own code, and it throws:

```typescript
import { Traceback } from "@promptctl/rich-js";

try {
  processUser(user);
} catch (error) {
  console.print(new Traceback(error as Error));
}
```

A traceback shows only what the error's stack records. It cannot show source lines or local variables: an `Error` carries the location of each frame, not the code or the values that were in scope there.

## Installing as the global handler

Register rich tracebacks for every crash — both uncaught exceptions and unhandled promise rejections. Put this at the entry point of your application:

```typescript node
import { installTraceback } from "@promptctl/rich-js/node/traceback";

// All crashes now use rich formatting
installTraceback();
```

Calling it again replaces the handler rather than adding a second one, so a process always has exactly one rich crash renderer and the last call's options are the ones in force.

A crash payload that is not an `Error` — `Promise.reject("nope")`, or `throw 42`, both of which JavaScript permits — renders under the name `NonError`, with the value inspected.

`installTraceback` lives on the `node/traceback` subpath because it calls `process.on` and `process.exit`; the `Traceback` renderable itself is pure rendering and stays in the main barrel, which remains browser-safe.

::: tip Placement
Statement position does not buy you as much as it looks like it does. ES modules evaluate all of a module's imports before any of its own top-level code, so an `installTraceback()` call at the top of your entry file still runs *after* everything that file imports has finished evaluating — a crash during module evaluation escapes it.

To cover that window too, put the call in its own module:

```typescript node
// crash-reporting.ts
import { installTraceback } from "@promptctl/rich-js/node/traceback";
installTraceback();
```

Then make `import "./crash-reporting.js";` the first import of your entry file. A module's imports evaluate in the order they are written, so every module the entry file imports after it evaluates with the handler installed. The exception is what `crash-reporting.js` itself imports — rich-js and its dependencies — which has already evaluated by then.

Node's `--import ./crash-reporting.js` flag does the same thing from outside the module graph.
:::

## Suppressing frames

Framework and library frames are noise when debugging your own code. `suppress` takes a list of strings, and any frame whose file path contains one of them loses its function name, keeping your own functions the only names on screen:

```typescript
try {
  processUser(user);
} catch (error) {
  console.print(new Traceback(error as Error, { suppress: ["node_modules/express"] }));
}
```

`installTraceback` takes the same options, so `installTraceback({ suppress: ["node_modules/express"] })` suppresses those frames in every crash report.

A suppressed frame keeps its place in the list, so the order of calls stays intact.

## Max frames

A traceback can only show the frames the error recorded, and V8 records 10 by default. Raise `Error.stackTraceLimit` (to `1000`, say) at the start of your program to see deeper stacks. Once a stack has more frames than `maxFrames` (100 by default), the traceback shows the first half and the last half of that budget and counts the frames omitted between them. Here a recursive `walk` has thrown from 250 calls deep:

```typescript
try {
  walk(250);
} catch (error) {
  console.print(new Traceback(error as Error, { maxFrames: 4 }));
}
```

Pass `maxFrames: 0` to disable the cap and show every recorded frame.
