# Live Display

A live display keeps a renderable fixed at the bottom of the terminal, refreshing it as data changes. Progress bars and status spinners are built on top of this primitive. Use it directly for custom animated output.

## Basic usage

Pass a renderable to the `Live` constructor and mutate it inside the block. The display updates automatically:

```typescript
import { Console, Live, Table } from "@promptctl/rich-js";

const console = new Console();

const table = new Table();
table.addColumn("Job");
table.addColumn("Status");

const live = new Live(table, { console });
live.start();
try {
  for (const job of jobs) {
    await runJob(job);
    table.addRow(job.name, "done");
    // table mutation triggers a refresh automatically
  }
} finally {
  live.stop();
}
```

The live region re-renders whenever the renderable is mutated (or on the auto-refresh timer).

## Replacing the renderable

When content is too dynamic to express as mutations to a single object, swap in a completely new renderable with `update()`:

```typescript
const live = new Live(buildTable(data), { console });
live.start();
try {
  while (running) {
    const freshData = await fetchData();
    live.update(buildTable(freshData));
    await sleep(500);
  }
} finally {
  live.stop();
}
```

`update()` can also force an immediate refresh:

```typescript
live.update(newRenderable, { refresh: true });
```

## Alternate screen (fullscreen)

Enter fullscreen mode with `altScreen: true`. `start()` switches to the alternate screen buffer and `stop()` restores the original:

```typescript
const live = new Live(layout, { altScreen: true });

live.start();
try {
  // terminal is in fullscreen
} finally {
  live.stop(); // terminal restored
}
```

See [Layout](./layout) for structuring complex fullscreen content.

## Transient display

Clear the live display when done instead of leaving the final frame:

```typescript
const live = new Live(renderable, { transient: true });
```

## Auto-refresh

The default refresh rate is 4 times per second. Tune it:

```typescript
const live = new Live(renderable, { refreshPerSecond: 10 });
```

Disable auto-refresh and drive it manually:

```typescript
const live = new Live(renderable, { autoRefresh: false });

live.refresh(); // manually refresh

// Or refresh when updating
live.update(newRenderable, { refresh: true });
```

## Vertical overflow

When the renderable is taller than the terminal:

| Mode | Behavior |
|---|---|
| `"crop"` | Show up to terminal height; hide the rest |
| `"ellipsis"` | Same as crop, but replace the last visible line with `...` (default) |
| `"visible"` | Show the full renderable (cannot be properly cleared in this mode) |

```typescript
const live = new Live(tallRenderable, { verticalOverflow: "crop" });
```

When the live display stops, the last frame is always shown as `visible`.

## Print and log during live display

Output printed to the live display's internal console appears above the live area without disrupting it:

```typescript
live.start();
try {
  live.console.print("[green]Step 1 complete[/green]");
  // output appears above the live region, scrolling normally
} finally {
  live.stop();
}
```

::: warning Don't use the outer console
Printing directly to an outer console while a live display is active will break the display. Always use `live.console` for output that should appear above the live area.
:::

Pass a custom Console to control where above-display output goes:

```typescript
const myConsole = new Console();
const live = new Live(renderable, { console: myConsole });
```

When a file-based console is passed, live content is only emitted once the context exits.

## Redirecting stdout/stderr

By default, built-in `process.stdout` and `process.stderr` writes are redirected so they don't break the live display. Disable this:

```typescript
const live = new Live(renderable, {
  redirectStdout: false,
  redirectStderr: false,
});
```

## One Live owns the terminal

Only one `Live` may be running at a time. Starting a second one while the first is still going corrupts both displays.

Each `Live` remembers how many lines it drew last and, on every refresh, clears that many lines upward from wherever the cursor currently sits. It has no idea another `Live` wrote anything. So the second display's lines sit inside the region the first one is about to erase, and the first one redraws its own content on top of them. What you see is one display's content, twice.

To show several renderables in one live region, put them in a `Group` and wrap that in a single `Live`:

```typescript
import { Group, Panel, Progress } from "@promptctl/rich-js";

const status = new Panel("Starting");
const progress = new Progress();

const live = new Live(new Group(status, progress), { console });
live.start();
try {
  await doWork(progress);
} finally {
  live.stop();
}
```

The `Group` renders its members in order, and the one `Live` counts every line they produce — so its clear-and-redraw covers the whole region.
