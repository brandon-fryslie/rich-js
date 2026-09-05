# Progress Bars

rich-js renders flicker-free, continuously updating progress bars for long-running tasks. Multiple tasks can run concurrently. The display refreshes automatically.

## Basic usage: `track()`

The fastest path to a progress bar — wrap any iterable:

```typescript
import { track } from "@promptctl/rich-js";

for (const step of track(Array.from({ length: 100 }), { description: "Processing..." })) {
  await doStep(step);
}
```

That's it. `track()` handles the rest. Use this for the majority of cases.

## Advanced usage: `Progress` class

Use `Progress` directly when you need multiple tasks, custom columns, or manual control.

### Lifecycle

`start()` begins the display and `stop()` ends it. Pair them in a `try`/`finally` so the terminal is restored even when the work throws:

```typescript
import { Progress } from "@promptctl/rich-js";

const progress = new Progress();
progress.start();

try {
  const task = progress.addTask("Downloading...", { total: 100 });
  // ... update task
} finally {
  progress.stop();
}
```

### Adding tasks

`addTask()` takes a description and a total number of steps. Returns a task ID:

```typescript
const task1 = progress.addTask("Downloading...", { total: 1024 });
const task2 = progress.addTask("Processing...",  { total: 200  });
```

The `total` is application-defined — it could be bytes, files, frames, items, or any unit.

### Updating tasks

```typescript
// Add to the current count
progress.updateTask(task1, { advance: 64 });

// Set the count directly
progress.updateTask(task1, { completed: 512 });

// Change the label
progress.updateTask(task1, { description: "Downloading (retry)..." });
```

`updateTask` accepts `completed`, `advance`, `description`, `visible`, and `refresh` — nothing else. A task's `total` is fixed at `addTask()`, and there is no store for custom per-task data.

### Hiding tasks

```typescript
progress.updateTask(task1, { visible: false });
// Or set on creation:
const task = progress.addTask("Hidden", { total: 100, visible: false });
```

### Deferred start

A task can be visible before its clock runs. `start: false` adds the task without
starting its timer; `startTask()` starts it when the work actually begins:

```typescript
const task = progress.addTask("Queued...", { total: 500, start: false });
// ... when the work begins
progress.startTask(task);
```

Until then `TimeElapsedColumn` holds at `0:00:00` and `TimeRemainingColumn` at
`-:--:--`. Use this for a queue of tasks you want on screen from the beginning but
timed only while each one runs.

There is no indeterminate mode. Omitting `total` does not produce a pulsing bar; it
produces a bar stuck at 0%.

### Transient display

Clear the progress display when it finishes (instead of leaving the final state):

```typescript
const progress = new Progress({ transient: true });
```

### Auto-refresh

The default refresh rate is 10 times per second. Tune it:

```typescript
const progress = new Progress({ refreshPerSecond: 2 });
```

Disable auto-refresh and call manually:

```typescript
const progress = new Progress({ autoRefresh: false });
// ...
progress.refresh();
```

### Expand

Stretch the display to the full terminal width:

```typescript
const progress = new Progress({ expand: true });
```

## Columns

The columns shown per task are configurable via positional arguments to the `Progress` constructor:

```typescript
import {
  Progress, TextColumn, BarColumn,
  TaskProgressColumn, TimeRemainingColumn, SpinnerColumn,
} from "@promptctl/rich-js";

const progress = new Progress(
  new SpinnerColumn(),
  new TextColumn("{task.description}"),
  new BarColumn(),
  new TaskProgressColumn(),
  new TimeRemainingColumn(),
);
```

### Built-in columns

| Column | What it shows |
|---|---|
| `BarColumn` | The progress bar |
| `TextColumn` | A format string (see below) |
| `TaskProgressColumn` | Percentage complete |
| `TimeElapsedColumn` | Elapsed time |
| `TimeRemainingColumn` | Estimated time remaining |
| `MofNCompleteColumn` | `completed/total` count |
| `SpinnerColumn` | Animated spinner |

### Format string columns

`TextColumn` substitutes one placeholder — `{task.description}` — and parses the
result as [markup](./markup), so tags around it style the text:

```typescript
new TextColumn("[progress.description]{task.description}")
```

That is the default `TextColumn`. No other task field is substituted; `{task.completed}`
and `{task.total}` would render as literal braces. For the counts use
`MofNCompleteColumn` or `TaskProgressColumn`.

## Print and log during progress

Output printed to the progress's internal console appears above the progress bars without disrupting them:

```typescript
progress.start();
try {
  const task = progress.addTask("Work", { total: 10 });
  for (let i = 0; i < 10; i++) {
    progress.console.print(`Step ${i} done`);
    progress.updateTask(task, { advance: 1 });
    await sleep(100);
  }
} finally {
  progress.stop();
}
```

Pass a custom `Console` to control where output goes:

```typescript
const myConsole = new Console({ stderr: true });
const progress = new Progress({ console: myConsole });
```

## Nesting progress bars

Create a progress display inside an existing one — the inner bar appears below the outer:

```typescript
outerProgress.start();
try {
  const outerTask = outerProgress.addTask("Overall", { total: 3 });
  for (let i = 0; i < 3; i++) {
    innerProgress.start();
    try {
      const innerTask = innerProgress.addTask("Batch", { total: 100 });
      // ...
    } finally {
      innerProgress.stop();
    }
    outerProgress.updateTask(outerTask, { advance: 1 });
  }
} finally {
  outerProgress.stop();
}
```

Inner bars refresh at the outer bar's refresh rate.

## Multiple Progress instances with different columns

A single `Progress` instance cannot have different column layouts per task. For that, use multiple `Progress` instances inside a `Live` display:

```typescript
import { Live, Group } from "@promptctl/rich-js";

const downloadProgress = new Progress(new BarColumn(), new MofNCompleteColumn());
const processProgress  = new Progress(new BarColumn(), new TimeRemainingColumn());

const live = new Live(new Group(downloadProgress, processProgress));
live.start();
try {
  // add tasks to each progress independently
} finally {
  live.stop();
}
```

See [Live Display](./live) for details.
