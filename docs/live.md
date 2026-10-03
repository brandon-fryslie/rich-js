---
exampleContext: |
  const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));
  const jobs = ["lint", "test", "build", "package", "deploy"].map((name) => ({ name }));
  const runJob = (_job: { name: string }) => sleep(700);
  const services = ["api", "web", "worker", "cron"];
  const fetchData = async () => services.map((name) => ({ name, load: Math.round(Math.random() * 100) }));
  const buildTable = (rows: Array<{ name: string; load: number }>) => {
    const table = new Table({ box: ROUNDED, borderStyle: "blue" });
    table.addColumn("Service");
    table.addColumn("Load", { justify: "right" });
    for (const { name, load } of rows) {
      const color = load > 80 ? "red" : load > 50 ? "yellow" : "green";
      table.addRow(`[bold]${name}[/]`, `[${color}]${load}%[/]`);
    }
    return table;
  };
  const doWork = async (progress: Progress) => {
    const task = progress.addTask("Migrating...", { total: 40 });
    for (let i = 0; i < 40; i++) {
      await sleep(60);
      progress.updateTask(task, { advance: 1 });
    }
  };
  const renderable = new Panel("[bold]status[/]");
---

# Live Display

A live display keeps a renderable fixed at the bottom of the terminal, refreshing it as data changes. Progress bars and status spinners are built on top of this primitive. Use it directly for custom animated output.

The examples on this page run live. In them, `sleep(ms)` waits, and `jobs`, `runJob()`, `fetchData()`, `buildTable()` and `doWork()` stand for your own work and the data it produces.

## Basic usage

Pass a renderable to the `Live` constructor and mutate it inside the block. The display updates automatically:

```typescript live
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
    table.addRow(job.name, "[green]done[/green]");
    // table mutation triggers a refresh automatically
  }
} finally {
  live.stop();
}
```

The live region re-renders whenever the renderable is mutated (or on the auto-refresh timer).

## Replacing the renderable

When content is too dynamic to express as mutations to a single object, swap in a completely new renderable with `update()`:

```typescript live
const live = new Live(buildTable(await fetchData()), { console });
live.start();
try {
  for (let i = 0; i < 20; i++) {
    const freshData = await fetchData();
    live.update(buildTable(freshData));
    await sleep(500);
  }
} finally {
  live.stop();
}
```

`update()` can also force an immediate refresh: `live.update(newRenderable, { refresh: true })`.

## Alternate screen (fullscreen)

Enter fullscreen mode with `altScreen: true`. `start()` switches to the alternate screen buffer and `stop()` restores the original. Each frame is the whole screen: the renderable is handed the terminal's rows as a region, so a `Layout` divides all of them, and a shorter frame is padded to the bottom row:

```typescript live
const layout = new Layout(undefined, { name: "root" });
layout.splitColumn(
  new Layout(new Panel("[bold magenta]deploy[/] [dim]·[/] production", { expand: true, borderStyle: "magenta" }), { size: 3 }),
  new Layout(undefined, { name: "body" }),
);

const live = new Live(layout, { altScreen: true, console });
live.start();
try {
  // the terminal is in fullscreen
  for (let left = 5; left > 0; left--) {
    layout.getByName("body")!.update(
      new Panel(`[bold]Fullscreen[/] — back to the page in [yellow]${left}[/]`, { expand: true, borderStyle: "cyan" }),
    );
    live.refresh();
    await sleep(1000);
  }
} finally {
  live.stop(); // terminal restored
}
console.print("[green]:check_mark:[/] back on the main screen, where the page's output was");
```

See [Layout](./layout) for structuring complex fullscreen content.

## Transient display

Clear the live display when done instead of leaving the final frame. Here the table vanishes and only the line printed after it stays:

```typescript live
const table = new Table({ box: ROUNDED, borderStyle: "cyan" });
table.addColumn("Job");
table.addColumn("Status");

const live = new Live(table, { transient: true, console });
live.start();
try {
  for (const job of jobs) {
    await runJob(job);
    table.addRow(job.name, "[green]done[/]");
  }
} finally {
  live.stop();
}
console.print(`[bold green]:check_mark: ${jobs.length} jobs done[/]`);
```

## Auto-refresh

The default refresh rate is 4 times per second. Tune it with `refreshPerSecond` — any positive, finite number, so `0.5` refreshes once every two seconds; anything else throws when the `Live` is constructed. `clock` is what the refresh ticks on, `systemClock()` unless you pass a [`Clock`](/app#animating-at-a-frame-rate) of your own. Or turn auto-refresh off and draw each frame yourself with `refresh()` — or with `update(newRenderable, { refresh: true })`. A frame is drawn only between `start()` and `stop()`; outside them `refresh()` draws nothing, because the screen is no longer `Live`'s:

```typescript live
const counter = new Panel("", { expand: false, borderStyle: "magenta" });
const live = new Live(counter, { autoRefresh: false, console });
live.start();
try {
  for (let n = 1; n <= 50; n++) {
    live.update(new Panel(`frame [bold magenta]${n}[/] of 50`, { expand: false, borderStyle: "magenta" }), { refresh: true });
    await sleep(100);
  }
} finally {
  live.stop();
}
```

## When a frame fails to render

`Live` renders each frame in full before it writes anything, so a renderable whose `render` throws leaves the last good frame on the terminal, and the error goes to whoever called `refresh()`. The renderable stays installed, so every later frame, the timer's included, fails the same way until `update` replaces it. If the auto-refresh timer is what called it, there is no caller: `Live` stops, shows the cursor and leaves the alternate screen, then lets the error go on uncaught; after that `refresh()` draws nothing and `stop()` has nothing left to do. If the final frame `stop()` draws throws, `stop()` hands the terminal back the same way and then rethrows.

## Vertical overflow

When the renderable is taller than the terminal:

| Mode | Behavior |
|---|---|
| `"crop"` | Show up to terminal height; hide the rest |
| `"ellipsis"` | Same as crop, but replace the last visible line with `...` (default) |
| `"visible"` | Show the full renderable (cannot be properly cleared in this mode). On the alternate screen a frame never grows past the screen, so this crops too |

This terminal is 24 rows tall, and the table grows to 40:

```typescript live
const tall = new Table({ box: ROUNDED });
tall.addColumn("Line");
const live = new Live(tall, { verticalOverflow: "ellipsis", console });
live.start();
try {
  for (let i = 1; i <= 40; i++) {
    tall.addRow(`[cyan]row ${i}[/]`);
    await sleep(80);
  }
} finally {
  live.stop();
}
```

## Print and log during live display

Output printed through `live.console` — the console the live display draws on — appears above the live area without disrupting it:

```typescript live
const progress = new Panel("[yellow]working…[/]", { expand: false });
const live = new Live(progress, { console });
live.start();
try {
  for (const job of jobs) {
    await runJob(job);
    live.console.print(`[green]:check_mark:[/] ${job.name} complete`);
    // output appears above the live region, scrolling normally
  }
} finally {
  live.stop();
}
```

::: warning Print through the console the Live draws on
Only `live.console` steps around the frame. Anything else that writes to the same terminal while the display runs — another `Console`, or `process.stdout.write` — lands on the frame, and the next refresh erases it.
:::

Pass a custom Console to control where above-display output goes:

```typescript silent
const myConsole = new Console();
const live = new Live(renderable, { console: myConsole });
```

`Live` never checks whether that console is a terminal, so pointing one at a file writes every frame it draws — four a second by default — with the cursor and erase-line escape sequences in between as literal bytes.

## One Live owns the terminal

Only one `Live` may be running at a time. Starting a second one on the same console while the first is still going throws; starting it on another console that writes to the same terminal corrupts both displays.

Each `Live` remembers how many lines it drew last and, on every refresh, moves that many lines up from wherever the cursor currently sits and paints the new frame over them. It has no idea a `Live` on another console wrote anything. So the second display's lines sit inside the region the first one is about to erase, and the first one redraws its own content on top of them. What you see is one display's content, twice.

To show several renderables in one live region, put them in a `Group` and wrap that in a single `Live`:

```typescript live
import { Group, Panel, Progress } from "@promptctl/rich-js";

const status = new Panel("[bold]Starting[/]", { borderStyle: "cyan" });
const progress = new Progress();

const live = new Live(new Group(status, progress), { console });
live.start();
try {
  await doWork(progress);
} finally {
  live.stop();
}
```

The `Group` renders its members in order, and the one `Live` counts every line they produce — so each redraw covers the whole region.
