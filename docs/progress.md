# Progress Bars

rich-js renders flicker-free, continuously updating progress bars for long-running tasks. Multiple tasks can run concurrently. The display refreshes automatically.

## Basic usage: `track()`

The fastest path to a progress bar — wrap any iterable:

```typescript
import { track } from "rich-js";

for (const step of track(Array.from({ length: 100 }), { description: "Processing..." })) {
  await doStep(step);
}
```

That's it. `track()` handles the rest. Use this for the majority of cases.

## Advanced usage: `Progress` class

Use `Progress` directly when you need multiple tasks, custom columns, or manual control.

### Lifecycle

`Progress` is designed as a context manager via its `run()` method:

```typescript
import { Progress } from "rich-js";

await progress.run(async () => {
  const task = progress.addTask("Downloading...", { total: 100 });
  // ... update task
});
```

For situations where a context manager cannot be used, start and stop explicitly:

```typescript
const progress = new Progress();
progress.start();

try {
  // ... work
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
progress.update(task1, { advance: 64 });

// Set the count directly
progress.update(task1, { completed: 512 });

// Store arbitrary fields for custom columns
progress.update(task1, { speed: "64 MB/s" });
```

### Hiding tasks

```typescript
progress.update(task1, { visible: false });
// Or set on creation:
const task = progress.addTask("Hidden", { total: 100, visible: false });
```

### Indeterminate progress

When the total is unknown at task start, show a pulsing animation instead:

```typescript
// total: null → pulsing bar, no percentage
const task = progress.addTask("Connecting...", { total: null });

// Once the total is known:
progress.update(task, { total: 500 });
progress.startTask(task);
```

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
} from "rich-js";

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
| `TimeElapsedColumn` | Elapsed time |
| `TimeRemainingColumn` | Estimated time remaining |
| `MofNCompleteColumn` | `completed/total` count |
| `SpinnerColumn` | Animated spinner |
| `FileSizeColumn` | Completed count as file size (e.g. `42 MB`) |
| `TotalFileSizeColumn` | Total as file size |
| `DownloadColumn` | `completed/total` as file sizes |
| `TransferSpeedColumn` | Transfer speed (e.g. `64 MB/s`) |
| `RenderableColumn` | A custom renderable per task |

### Format string columns

`TextColumn` accepts a format string with access to task data:

```typescript
new TextColumn("{task.description} [{task.completed}/{task.total}] {task.fields[speed]}")
```

## Print and log during progress

Output printed to the progress's internal console appears above the progress bars without disrupting them:

```typescript
await progress.run(async () => {
  const task = progress.addTask("Work", { total: 10 });
  for (let i = 0; i < 10; i++) {
    progress.console.print(`Step ${i} done`);
    progress.update(task, { advance: 1 });
    await sleep(100);
  }
});
```

Pass a custom `Console` to control where output goes:

```typescript
const myConsole = new Console({ stderr: true });
const progress = new Progress({ console: myConsole });
```

## Reading from a file

Track progress while reading a file:

```typescript
// From a file path
for await (const chunk of progress.open("large-file.bin", { description: "Reading..." })) {
  processChunk(chunk);
}

// From an existing file handle
const file = openFileHandle("data.bin");
for await (const chunk of progress.wrapFile(file, { total: fileSize, description: "Reading..." })) {
  processChunk(chunk);
}
```

## Nesting progress bars

Create a progress display inside an existing one — the inner bar appears below the outer:

```typescript
await outerProgress.run(async () => {
  const outerTask = outerProgress.addTask("Overall", { total: 3 });
  for (let i = 0; i < 3; i++) {
    await innerProgress.run(async () => {
      const innerTask = innerProgress.addTask("Batch", { total: 100 });
      // ...
    });
    outerProgress.update(outerTask, { advance: 1 });
  }
});
```

Inner bars refresh at the outer bar's refresh rate.

## Multiple Progress instances with different columns

A single `Progress` instance cannot have different column layouts per task. For that, use multiple `Progress` instances inside a `Live` display:

```typescript
import { Live, Group } from "rich-js";

const downloadProgress = new Progress(new BarColumn(), new DownloadColumn());
const processProgress  = new Progress(new BarColumn(), new TimeRemainingColumn());

await new Live(new Group(downloadProgress, processProgress)).run(async () => {
  // add tasks to each progress independently
});
```

See [Live Display](./live) for details.

## Customizing the display

Override the method that builds the renderable for the whole display — for example, to wrap it in a `Panel`:

```typescript
class PanelProgress extends Progress {
  getRenderable() {
    return new Panel(super.getRenderable(), { title: "[bold]Progress[/bold]", expand: true });
  }
}
```
