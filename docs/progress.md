---
exampleContext: |
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const doStep = (_step: unknown) => sleep(20);
  const progress = new Progress();
  const batches = ["alpha", "beta", "gamma"].map((name) => ({ name, items: Array.from({ length: 20 }, (_, i) => i) }));
  const handleItem = (_item: number) => sleep(30);
---

# Progress Bars

rich-js renders flicker-free, continuously updating progress bars for long-running tasks. Multiple tasks can run concurrently. The display refreshes automatically.

## Basic usage: `track()`

The fastest path to a progress bar — wrap any iterable:

```typescript live
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

```typescript live
import { Progress } from "@promptctl/rich-js";

const progress = new Progress();
progress.start();

try {
  const task = progress.addTask("Downloading...", { total: 100 });
  for (let i = 0; i < 100; i++) {
    await sleep(20);
    progress.updateTask(task, { advance: 1 });
  }
} finally {
  progress.stop();
}
```

### Adding tasks

`addTask()` takes a description and a total number of steps. Returns a task ID:

```typescript silent
const task1 = progress.addTask("Downloading...", { total: 1024 });
const task2 = progress.addTask("Processing...",  { total: 200  });
```

The `total` is application-defined — it could be bytes, files, frames, items, or any unit.

### Updating tasks

```typescript silent
// Add to the current count
progress.updateTask(task1, { advance: 64 });

// Set the count directly
progress.updateTask(task1, { completed: 512 });

// Change the label
progress.updateTask(task1, { description: "Downloading (retry)..." });
```

`updateTask` accepts `completed`, `advance`, `description`, `visible`, and `refresh` — nothing else. A task's `total` is fixed at `addTask()`, and there is no store for custom per-task data. A `total`, `completed` or `advance` that is `NaN` or infinite throws a `RangeError` from the call that passed it.

### Hiding tasks

```typescript silent
progress.updateTask(task1, { visible: false });
// Or set on creation:
const task = progress.addTask("Hidden", { total: 100, visible: false });
```

### Deferred start

A task can be visible before its clock runs. `start: false` adds the task without
starting its timer; `startTask()` starts it when the work actually begins:

```typescript silent
const task = progress.addTask("Queued...", { total: 500, start: false });
// ... when the work begins
progress.startTask(task);
```

Until then `TimeElapsedColumn` and `TimeRemainingColumn` both show `-:--:--`. Use
this for a queue of tasks you want on screen from the beginning but timed only while
each one runs. Calling `startTask()` on a task already running leaves its start where
it was.

A task not yet started has a pulsing bar, as in Rich: bands of `bar.pulse` light cross the
empty `bar.back` track. A task with no `total` pulses for as long as it runs. It never finishes,
and `TaskProgressColumn` and `TimeRemainingColumn` show nothing for it. The pulse is
the library's [shimmer](./effects), so its light comes and goes the way the shimmer's
does, and the bar can rest unlit for several seconds between bands. It is drawn at the
`Progress` clock's time on each frame: the bands cross at the same speed whatever the
refresh rate, and a slower refresh shows them further along each frame. On an output
with no colour the pulse cannot be drawn, so a pulsing bar is blank.

### Transient display

Clear the progress display when it finishes (instead of leaving the final state):

```typescript silent
const progress = new Progress({ transient: true });
```

### Auto-refresh

The default refresh rate is 10 times per second. Tune it:

```typescript silent
const progress = new Progress({ refreshPerSecond: 2 });
```

Tasks are timed, and frames drawn, on `clock` — `systemClock()` unless you pass a
[`Clock`](/app#animating-at-a-frame-rate) of your own, which is how a test moves a
task's time by hand.

Disable auto-refresh and call manually:

```typescript live
const progress = new Progress({ autoRefresh: false });
const task = progress.addTask("Stepping...", { total: 5 });
progress.start();
for (let step = 0; step < 5; step++) {
  await sleep(500);
  progress.updateTask(task, { advance: 1 });
  progress.refresh();
}
progress.stop();
```

### Expand

Stretch the display to the full terminal width:

```typescript silent
const progress = new Progress({ expand: true });
```

## Columns

The columns shown per task are configurable via positional arguments to the `Progress` constructor:

```typescript live
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

progress.start();
const task = progress.addTask("Rendering...", { total: 100 });
for (let i = 0; i < 100; i++) {
  await sleep(40);
  progress.updateTask(task, { advance: 1 });
}
progress.stop();
```

### Built-in columns

| Column | What it shows |
|---|---|
| `BarColumn` | The progress bar, filled in half cells; on an output with no colour only the filled part is drawn, as Rich does. A task not yet started, or with no `total`, pulses |
| `TextColumn` | A format string (see below) |
| `TaskProgressColumn` | Percentage complete, right-aligned in four cells so the row holds still |
| `TimeElapsedColumn` | Elapsed time, held where it stopped once the task is finished |
| `TimeRemainingColumn` | Estimated time remaining, at the speed of the updates in the 30 seconds before the latest one — `-:--:--` until two updates that moved the task lie apart in time; `{ elapsedWhenFinished: true }` shows the time the task took once it is finished |
| `MofNCompleteColumn` | `completed/total` in whole numbers, styled `progress.download`; the count is padded to the total's width so the row holds still as it counts up to its total. `{ separator }` replaces the `/` |
| `SpinnerColumn` | Animated spinner, styled `progress.spinner`; a space once the task is finished |

### Format string columns

`TextColumn` substitutes one placeholder — `{task.description}` — and parses the
result as [markup](./markup), so tags around it style the text:

```typescript silent
new TextColumn("[progress.description]{task.description}")
```

That is the default `TextColumn`. No other task field is substituted; `{task.completed}`
and `{task.total}` would render as literal braces. For the counts use
`MofNCompleteColumn` or `TaskProgressColumn`.

### Custom columns

A column is anything with a `render(task)` that returns the cell's content and a
`tableColumn` that says how the progress grid lays that cell out — the same
options as a `Table` column. `TextColumn` and `TaskProgressColumn` are `noWrap`,
so they are cut rather than wrapped; the others take a plain column, as Rich's
do. A column that names a plain one wraps when the row runs out of room:

```typescript
import { Progress, TextColumn, RichText, type ProgressColumn } from "@promptctl/rich-js";

const status: ProgressColumn = {
  tableColumn: {},
  render: (task) => new RichText(task.completed === 0 ? "waiting for the mirror to answer" : "fetching"),
};

const progress = new Progress(new TextColumn(), status, { console });
progress.addTask("a long task description that leaves the status little room", { total: 10 });
console.print(progress);
```

## Print and log during progress

Output printed to the progress's internal console appears above the progress bars without disrupting them:

```typescript live
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

```typescript silent
const myConsole = new Console({ stderr: true });
const progress = new Progress({ console: myConsole });
```

## Multiple progress displays at once

One `Progress` gives every task the same columns, and only one display may own the terminal at a time. Both limits have the same answer: build the layout yourself. Put each `Progress` in a `Group`, wrap the group in a single `Live`, and start only the `Live`.

Different columns per group of tasks is the usual reason. A download counts files, a conversion counts seconds — one column layout cannot serve both:

```typescript live
import {
  Live, Group, Progress,
  BarColumn, MofNCompleteColumn, TimeRemainingColumn,
} from "@promptctl/rich-js";

const downloadProgress = new Progress(new BarColumn(), new MofNCompleteColumn());
const processProgress  = new Progress(new BarColumn(), new TimeRemainingColumn());

const live = new Live(new Group(downloadProgress, processProgress));
live.start();
try {
  // Each Progress takes its own tasks, drawn in its own columns.
  const files = downloadProgress.addTask("files", { total: 40 });
  const seconds = processProgress.addTask("video", { total: 40 });
  for (let i = 0; i < 40; i++) {
    await sleep(50);
    downloadProgress.updateTask(files, { advance: 1 });
    processProgress.updateTask(seconds, { advance: i % 2 });
  }
} finally {
  live.stop();
}
```

The same shape gives you an overall bar above a per-batch bar. Create the batch task once, outside the loop, and re-label it each iteration — a fresh `addTask()` per batch would leave a finished row on screen for every batch you have run. A task's `total` is fixed when the task is created, so a bar that outlives batches of differing size counts percent rather than items:

```typescript live
const overallProgress = new Progress(new TextColumn("{task.description}"), new BarColumn());
const batchProgress   = new Progress(new TextColumn("{task.description}"), new BarColumn());

const live = new Live(new Group(overallProgress, batchProgress));
live.start();
try {
  const overallTask = overallProgress.addTask("Overall", { total: batches.length });
  const batchTask = batchProgress.addTask("Starting", { total: 100 });

  for (const batch of batches) {
    batchProgress.updateTask(batchTask, { description: batch.name, completed: 0 });
    for (const [index, item] of batch.items.entries()) {
      await handleItem(item);
      batchProgress.updateTask(batchTask, {
        completed: Math.round(((index + 1) / batch.items.length) * 100),
      });
    }
    overallProgress.updateTask(overallTask, { advance: 1 });
  }
} finally {
  live.stop();
}
```

Do not call `start()` on any of them. A started `Progress` builds its own `Live` with its own refresh timer, and that timer knows nothing about the other display's output. To redraw, a `Live` moves the cursor up as many rows as it drew last, counting from wherever the cursor happens to sit, and paints its new frame from there — so the first display's next tick lands on the lines the second one just wrote and redraws itself in their place. Two started instances do not stack; the second one's bars are erased before you ever see them.

See [Live Display](./live) for details.
