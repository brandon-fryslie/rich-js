# Doc Spec: Progress Display

The progress doc explains how to show continuously updating progress information for long-running tasks.

## Sections

### What it does

One paragraph: shows a live-updating display with progress bars, percentages, and time estimates. Supports multiple concurrent tasks. The display refreshes automatically without flickering.

### Basic usage: track function

Show `track()` wrapping any iterable. The reader should be able to add progress to an existing loop by wrapping the iterable and adding a description. Show a minimal example.

### Advanced usage: Progress class

Explain that `Progress` is needed for multiple tasks, custom columns, or manual control.

#### Lifecycle

Explain that `Progress` is designed as a context manager that starts and stops the display automatically. Also show the explicit `start()`/`stop()` form with a try/finally for situations where a context manager cannot be used.

#### Adding tasks

Explain `addTask()`: takes a description and a total number of steps. Returns a task ID. Explain what "total" means (application-defined steps — could be bytes, items, frames, etc.).

#### Updating tasks

Explain `update()` using the task ID. Cover:
- `advance` — add to the current completion count
- `completed` — set the completion count directly
- Arbitrary keyword arguments stored in `task.fields`, accessible in custom columns

#### Hiding tasks

Show making a task invisible via `visible: false` in `update()` or `addTask()`.

#### Indeterminate progress

Explain the case where the total is unknown at task start. Show `start: false` or `total: null` on `addTask()` which shows a pulsing animation instead of a percentage. Show calling `startTask()` once the total is known.

#### Transient display

Explain `transient: true` on the Progress constructor — the display disappears when the context exits rather than leaving the final state in the terminal.

#### Auto-refresh

Explain the default refresh rate (10 times per second). Show `refreshPerSecond` to change it. Show `autoRefresh: false` and the manual `refresh()` call for infrequent updates.

#### Expand

Explain `expand: true` to stretch the progress display to the full terminal width.

### Columns

Explain that the columns displayed per task are configurable via positional arguments to the Progress constructor.

Show the default column set: description, bar, percentage, time remaining.

Explain format string columns: a string with `{task.description}`, `{task.completed}`, `{task.total}`, `{task.fields[name]}`.

List the built-in column types:
- `BarColumn`
- `TextColumn`
- `TimeElapsedColumn`
- `TimeRemainingColumn`
- `MofNCompleteColumn`
- `FileSizeColumn`, `TotalFileSizeColumn` (for byte-count tasks)
- `DownloadColumn`, `TransferSpeedColumn` (for download tasks)
- `SpinnerColumn`
- `RenderableColumn`

Show extending the default columns with additional columns (e.g., adding a spinner before the defaults).

Explain `table_column` for controlling how the underlying table allocates width to a column, including the ratio approach for proportional sizing.

### Print and log during progress

Explain that output printed to the Progress's internal console appears above the progress display without disrupting it. Show using `progress.console.print()`. Show passing a custom Console instance.

### Reading from a file

Show `open()` (wraps a file path) and `wrapFile()` (wraps an existing file handle) for tracking progress while reading. Explain the `total` parameter needed for `wrapFile()`.

### Nesting progress bars

Explain that creating a progress display inside an existing one shows the inner bar below the outer. Show a simple nested example. Note that inner bars refresh at the outer bar's refresh rate.

### Multiple independent Progress instances

Explain that a single Progress instance cannot have different column layouts per task. For that, use multiple Progress instances inside a Live display. Cross-reference the Live doc.

### Customizing

Show overriding the method that produces the renderable for the whole display, to wrap it in a Panel or add other content around the progress bars.

## Constraints

- The `track()` example must be the very first example shown — it covers the majority of use cases
- The column list must describe what each column shows, not its constructor signature
- Do not describe the internal Task data structure in detail
