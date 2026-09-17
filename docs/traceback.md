# Tracebacks

A rich traceback prints an error as its name and message, followed by one line per stack frame: the function in bold, then its file and line. It is the same information as a plain Node.js stack trace, laid out so the function names and line numbers stand out.

## Printing a caught exception

Catch an error and print a rich traceback:

```typescript
import { Console, Traceback } from "@promptctl/rich-js";

const console = new Console();

try {
  processUser(user);
} catch (error) {
  console.print(new Traceback(error));
}
```

```
TypeError: Invalid field: role

  processUser /app/src/users.ts:42
  Layer.handle /app/node_modules/express/lib/router/layer.js:95
  main /app/src/index.ts:12
```

A traceback shows only what the error's stack records. It cannot show source lines or local variables: an `Error` carries the location of each frame, not the code or the values that were in scope there.

## Installing as the global handler

Register rich tracebacks for every crash — both uncaught exceptions and unhandled promise rejections. Put this at the entry point of your application:

```typescript
import { installTraceback } from "@promptctl/rich-js/node/traceback";

// All crashes now use rich formatting
installTraceback();
```

Calling it again replaces the handler rather than adding a second one, so a process always has exactly one rich crash renderer and the last call's options are the ones in force.

A crash payload that is not an `Error` — `Promise.reject("nope")`, or `throw 42`, both of which JavaScript permits — renders under the name `NonError`, with the value inspected.

`installTraceback` lives on the `node/traceback` subpath because it calls `process.on` and `process.exit`; the `Traceback` renderable itself is pure rendering and stays in the main barrel, which remains browser-safe.

::: tip Placement
Statement position does not buy you as much as it looks like it does. ES modules evaluate all of a module's imports before any of its own top-level code, so an `installTraceback()` call at the top of your entry file still runs *after* everything that file imports has finished evaluating — a crash during module evaluation escapes it.

To cover that window too, put the call in its own module and import it first:

```typescript
// crash-reporting.ts
import { installTraceback } from "@promptctl/rich-js/node/traceback";
installTraceback();
```

```typescript
// index.ts
import "./crash-reporting.js";   // evaluated before the imports below
import { startServer } from "./server.js";
```

Node's `--import ./crash-reporting.js` flag does the same thing from outside the module graph.
:::

## Suppressing frames

Framework and library frames are noise when debugging your own code. `suppress` takes a list of strings, and any frame whose file path contains one of them loses its function name, keeping your own functions the only names on screen:

```typescript
installTraceback({ suppress: ["node_modules/express"] });
```

```
TypeError: Invalid field: role

  processUser /app/src/users.ts:42
  /app/node_modules/express/lib/router/layer.js:95
  main /app/src/index.ts:12
```

A suppressed frame keeps its place in the list, so the order of calls stays intact.

## Max frames

A traceback can only show the frames the error recorded, and V8 records 10 by default. Raise `Error.stackTraceLimit` to see deeper stacks. Once a stack has more frames than `maxFrames` (100 by default), the traceback shows the first half and the last half of that budget and counts the frames omitted between them:

```typescript
Error.stackTraceLimit = 1000;

try {
  walk(250);
} catch (error) {
  console.print(new Traceback(error, { maxFrames: 4 }));
}
```

```
RangeError: Tree too deep

  walk file:///app/src/tree.mjs:4
  walk file:///app/src/tree.mjs:5
  ... 251 frames omitted ...
  async node:internal/modules/esm/loader:650
  async asyncRunEntryPointWithESMLoader node:internal/modules/run_main:101
```

Pass `maxFrames: 0` to disable the cap and show every recorded frame.
