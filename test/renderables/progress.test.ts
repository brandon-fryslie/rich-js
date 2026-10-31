import { describe, it, expect } from "vitest";
import {
  BarColumn,
  MofNCompleteColumn,
  Progress,
  SpinnerColumn,
  TaskProgressColumn,
  TextColumn,
  TimeElapsedColumn,
  TimeRemainingColumn,
  type ProgressColumn,
  type Task,
} from "../../src/renderables/progress.js";
import { Console } from "../../src/core/console.js";
import { Animation } from "../../src/core/animation.js";
import { EASES, beat } from "../../src/core/easing.js";
import { tween } from "../../src/core/tween.js";
import { Theme } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import { render, type FrameHost, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Timeline } from "../../src/core/timeline.js";
import { App } from "../../src/host/app.js";
import { Live } from "../../src/renderables/live.js";
import { WidgetApp } from "../../src/widgets/widget-app.js";
import { scriptedHost } from "../host/scripted-host.js";
import { ColorDepth } from "../../src/core/color.js";
import { renderToString, segmentsToString } from "../../src/core/render.js";
import { fakeClock } from "../core/fake-clock.js";
import { SPINNERS } from "../../src/core/spinnerData.js";
import { ProgressBar } from "../../src/renderables/progressBar.js";
import { inFrame } from "./in-frame.js";

const OPTS: RenderOptions = {
  maxWidth: 80,
  isTerminal: false,
  asciiOnly: false,
};

const fakeTask = (description: string): Task => ({
  id: 1,
  description,
  total: 100,
  completed: 0,
  fill: Animation.constant(0),
  visible: true,
  startTime: 0,
  elapsed: 0,
  finishedTime: undefined,
  speed: undefined,
});

function joined(col: TextColumn, description: string): string {
  return col.render(fakeTask(description)).plain;
}

describe("TextColumn markup parsing (rich-core-y80)", () => {
  it("does not leak [progress.description] as literal text", () => {
    const col = new TextColumn("[progress.description]{task.description}");
    const text = joined(col, "compile");
    expect(text).toBe("compile");
    expect(text).not.toContain("[progress.description]");
  });

  it("applies a style span for the markup tag", () => {
    const col = new TextColumn("[bold]{task.description}[/]");
    const segs = [...col.render(fakeTask("hello")).render(OPTS)];
    const styled = segs.find((s) => s.text === "hello" && s.style);
    expect(styled).toBeDefined();
    expect(styled!.style!.bold).toBe(true);
  });

  it("escapes brackets in task descriptions to prevent markup injection", () => {
    const col = new TextColumn("[bold]{task.description}[/]");
    const text = joined(col, "[red]boom[/]");
    expect(text).toBe("[red]boom[/]");
  });

  it("default constructor (no markup) still works", () => {
    const col = new TextColumn();
    expect(joined(col, "task one")).toBe("task one");
  });

  it("plain format with no tags is unchanged", () => {
    const col = new TextColumn("step: {task.description}");
    expect(joined(col, "build")).toBe("step: build");
  });
});

// `Progress` lays its row out as a grid `Table` and passes `expand` straight
// through, so what the table does with it is the whole of the behaviour here.
describe("Progress expand (rich-justify-0cr.3)", () => {
  const row = (expand: boolean, maxWidth: number): string => {
    const progress = new Progress(
      new TextColumn("{task.description}"),
      new BarColumn(20),
      new TextColumn("done"),
      { expand },
    );
    const id = progress.addTask("compiling", { total: 100 });
    progress.updateTask(id, { completed: 42 });
    const lines = Segment.splitLines([...progress.render({ ...OPTS, frame: progress.frameNow(), maxWidth })]);
    expect(lines).toHaveLength(1);
    return lines[0]!.map((segment) => segment.text).join("");
  };
  const barCells = (line: string): number => [...line].filter((ch) => "━╸╺".includes(ch)).length;

  it("keeps its natural width when it does not expand, whatever it is offered", () => {
    expect(row(false, 120)).toBe(row(false, 45));
    expect(row(false, 45).length).toBeLessThan(45);
  });

  // Python Rich 9d8f9a3's `make_tasks_table` for the same columns at width 45.
  // Its grid pads no edge, so the row ends at the last column's text, or at
  // the cell `expand` stretched it to — never on a pad cell.
  it.each([
    [false, "compiling ━━━━━━━━╺━━━━━━━━━━━ done"],
    [true, "compiling    ━━━━━━━━╺━━━━━━━━━━━       done "],
  ])("lays its row out as Rich does (expand: %s)", (expand, reference) => {
    expect(row(expand, 45)).toBe(reference);
  });

  it("fills the offer when it expands and leaves the bar at its own width", () => {
    const line = row(true, 45);
    expect(line).toHaveLength(45);
    expect(line.startsWith("compiling ")).toBe(true);
    expect(barCells(line)).toBe(20);
  });
});

describe("A squeezed row narrows its bar before its description (rich-table-frxv)", () => {
  // Python Rich 9d8f9a3: `TextColumn("{task.description}")` beside
  // `BarColumn(40)` at width 30. The bar's column may wrap and the
  // description's may not, so the bar alone gives up the nine cells:
  // "download" whole and a bar of 21, as the reference draws it in colour.
  it("keeps the description whole and draws the bar 21 cells wide", () => {
    const progress = new Progress(new TextColumn("{task.description}"), new BarColumn(40));
    progress.addTask("download", { total: 10 });
    const line = Segment.splitLines([...progress.render({ ...OPTS, frame: progress.frameNow(), maxWidth: 30 })])[0]!
      .map((segment) => segment.text)
      .join("");
    expect(line).toBe(`download ${"━".repeat(21)}`);
  });
});

describe("ProgressColumn.tableColumn (rich-progress-j4lb)", () => {
  // Python Rich 9d8f9a3: a `ProgressColumn` subclass returning
  // `Text("alpha beta gamma")` beside `TextColumn("task")` at width 14. Its
  // default `Column()` may wrap, where a `TextColumn`'s is `no_wrap`.
  it("lays a column out in the grid column it names, so a plain one wraps as Rich's does", () => {
    const message: ProgressColumn = { tableColumn: {}, render: () => new RichText("alpha beta gamma") };
    const console = new Console({ width: 14, colorSystem: null, record: true, file: { write: () => {} } });
    const progress = new Progress(new TextColumn("task"), message, { console });
    progress.addTask("a", { total: 10 });
    console.print(progress, { frame: progress.frameNow() });
    expect(console.exportText()).toBe("task alpha    \n     beta     \n     gamma    \n");
  });
});

describe("A task description keeps its own end (rich-embed-1r2m)", () => {
  // Python Rich 9d8f9a3: `TextColumn("{task.description}")` beside
  // `TextColumn("end")` at width 30, tasks "foo\n" and "bar". The
  // description's trailing newline draws a blank row under its task.
  it("draws the blank row a description's trailing newline makes, as Rich does", () => {
    const console = new Console({ width: 30, colorSystem: null, record: true, file: { write: () => {} } });
    const progress = new Progress(new TextColumn("{task.description}"), new TextColumn("end"), { console });
    progress.addTask("foo\n", { total: 10 });
    progress.addTask("bar", { total: 10 });
    console.print(progress, { frame: progress.frameNow() });
    expect(console.exportText()).toBe("foo end\n       \nbar end\n");
  });
});

describe("TaskProgressColumn (rich-progress-sy9s)", () => {
  const row = (expand: boolean, total: number | undefined, completed: number): string => {
    const progress = new Progress(
      new TextColumn("{task.description}"),
      new TaskProgressColumn(),
      new TextColumn("end"),
      { expand },
    );
    const id = progress.addTask("compiling", { total });
    progress.updateTask(id, { completed });
    const lines = Segment.splitLines([...progress.render({ ...OPTS, frame: progress.frameNow(), maxWidth: 30 })]);
    return lines[0]!.map((segment) => segment.text).join("");
  };

  // Python Rich 9d8f9a3's `make_tasks_table` for the same columns at width 30.
  // 42.5 rounds half to even, as Python's `.0f` does; 150 clamps to 100; a
  // task with no total shows nothing.
  it.each([
    [false, 100, 42, "compiling  42% end"],
    [false, 100, 42.5, "compiling  42% end"],
    [false, 100, 0.5, "compiling   0% end"],
    [false, 100, 2.5, "compiling   2% end"],
    [false, 100, 100, "compiling 100% end"],
    [false, 100, 150, "compiling 100% end"],
    [false, 0, 0, "compiling   0% end"],
    [false, undefined, 7, "compiling  end"],
    [true, 100, 42, "compiling         42%     end "],
    [true, 100, 42.5, "compiling         42%     end "],
    [true, 100, 0.5, "compiling          0%     end "],
    [true, 100, 2.5, "compiling          2%     end "],
    [true, 100, 100, "compiling        100%     end "],
    [true, 100, 150, "compiling        100%     end "],
    [true, 0, 0, "compiling          0%     end "],
    [true, undefined, 7, "compiling               end   "],
  ])("lays out as Rich does (expand: %s, total: %s, completed: %s)", (expand, total, completed, reference) => {
    expect(row(expand, total, completed)).toBe(reference);
  });
});

describe("SpinnerColumn (rich-progress-sy9s)", () => {
  const draw = (column: SpinnerColumn, completed: number, theme?: Theme): string =>
    drawTask(column, { total: 10 }, [completed], theme).output;

  const drawTask = (
    column: SpinnerColumn,
    task: { total?: number; start?: boolean },
    updates: number[],
    theme?: Theme,
  ): { output: string; finished: boolean } => {
    const chunks: string[] = [];
    const console = new Console({
      file: { write: (data: string) => chunks.push(data) },
      width: 30,
      colorSystem: "256",
      forceTerminal: true,
      theme,
    });
    // On a clock at zero, so the frame drawn is the first.
    const progress = new Progress(column, new TextColumn("end"), { console, clock: fakeClock() });
    const id = progress.addTask("x", task);
    for (const completed of updates) progress.updateTask(id, { completed });
    console.print(progress, { frame: progress.frameNow() });
    return { output: chunks.join(""), finished: progress.finished };
  };

  it("styles its frame with its console's progress.spinner", () => {
    expect(draw(new SpinnerColumn(), 0)).toMatch(/^\x1b\[32m\S+\x1b\[0m end\n$/);
    const themed = draw(new SpinnerColumn(), 0, new Theme({ "progress.spinner": "magenta" }));
    expect(themed).toMatch(/^\x1b\[35m\S+\x1b\[0m end\n$/);
  });

  it("takes a style of its own", () => {
    expect(draw(new SpinnerColumn("dots", { style: "blue" }), 0)).toMatch(/^\x1b\[34m\S+\x1b\[0m end\n$/);
  });

  it("draws its finished text once the task reaches its total", () => {
    expect(draw(new SpinnerColumn(), 10)).toBe("  end\n");
    expect(draw(new SpinnerColumn("dots", { finishedText: "[green]ok[/]" }), 10)).toBe("\x1b[32mok\x1b[0m end\n");
    expect(draw(new SpinnerColumn("dots", { finishedText: new RichText("done") }), 10)).toBe("done end\n");
  });
  // Python Rich 9d8f9a3, the same columns at width 30 (its frame in progress.spinner's
  // green), with `Progress.finished`:
  // a task finishes only when an update finds it started and at its total, and
  // stays finished; one with no total never does.
  it.each([
    ["an unstarted task at its total", { total: 10, start: false }, [10], "\x1b[32m⠋\x1b[0m end\n", false],
    ["a finished task counted back", { total: 10 }, [10, 0], "ok end\n", true],
    ["a task with no total", {}, [10], "\x1b[32m⠋\x1b[0m end\n", false],
  ])("finishes as Rich does: %s", (_case, task, updates, output, finished) => {
    const drawn = drawTask(new SpinnerColumn("dots", { finishedText: "ok" }), task, updates);
    expect(drawn).toEqual({ output, finished });
  });

  it("draws a justified finished text in its cell, not across the console", () => {
    const column = new SpinnerColumn("dots", { finishedText: new RichText("done", { justify: "center" }) });
    expect(draw(column, 10)).toBe("done end\n");
  });

  // Python Rich 9d8f9a3: `SpinnerColumn("bouncingBar", finished_text=Text("ok",
  // justify=...))` and `TextColumn("end")` at width 30, one task running and one
  // finished. The running frame sets the column's width, and the finished text
  // is justified within it.
  it.each([
    ["right", "\x1b[32m[    ]\x1b[0m end\n    ok end\n"],
    ["center", "\x1b[32m[    ]\x1b[0m end\n  ok   end\n"],
  ] as const)("justifies its finished text %s within a column its frame widens, as Rich does", (justify, expected) => {
    const chunks: string[] = [];
    const console = new Console({
      file: { write: (data: string) => chunks.push(data) },
      width: 30,
      colorSystem: "256",
      forceTerminal: true,
    });
    const column = new SpinnerColumn("bouncingBar", { finishedText: new RichText("ok", { justify }) });
    const progress = new Progress(column, new TextColumn("end"), { console, clock: fakeClock() });
    progress.addTask("a", { total: 10 });
    progress.updateTask(progress.addTask("b", { total: 10 }), { completed: 10 });
    console.print(progress, { frame: progress.frameNow() });
    expect(chunks.join("")).toBe(expected);
  });

  // rich-animation-xi28.6k9: the spinner turns on the progress's clock, as
  // Rich's `self.spinner.render(task.get_time())`, never on the platform's.
  it("draws the frame for the clock's time: moved every 1/60 s, each dots frame shows for 4 or 5 samples, in order, none skipped", () => {
    const dots = SPINNERS["dots"]!.frames;
    const clock = fakeClock();
    const progress = new Progress(new SpinnerColumn("dots", { style: "none" }), { console: new Console({ file: { write: () => {} } }), clock });
    progress.addTask("x", { total: 10 });
    const frame = (): string => renderToString(progress, { width: 10, frame: progress.frameNow() }).trim();
    const samples: string[] = [];
    for (let i = 0; i < 240; i++) {
      samples.push(frame());
      clock.advance(1 / 60);
    }
    const runs: { frame: string; length: number }[] = [];
    for (const sample of samples) {
      const last = runs.at(-1);
      if (last?.frame === sample) last.length++;
      else runs.push({ frame: sample, length: 1 });
    }
    expect(runs[0]!.frame).toBe(dots[0]);
    expect(runs.length).toBeGreaterThan(40);
    for (const run of runs.slice(1, -1)) expect([4, 5]).toContain(run.length);
    for (let i = 1; i < runs.length; i++) {
      expect(dots.indexOf(runs[i]!.frame)).toBe((dots.indexOf(runs[i - 1]!.frame) + 1) % dots.length);
    }
  });

  it("draws the frame for the clock's time at one redraw a second too", () => {
    const dots = SPINNERS["dots"]!.frames;
    const clock = fakeClock(0);
    const progress = new Progress(new SpinnerColumn("dots", { style: "none" }), { console: new Console({ file: { write: () => {} } }), clock });
    clock.advance(0.5);
    progress.addTask("x", { total: 10 });
    const frame = (): string => renderToString(progress, { width: 10, frame: progress.frameNow() }).trim();
    // 80 ms frames, an 800 ms period: half-seconds land 0.5, 0.7 and 0.1 s into a pass.
    expect(frame()).toBe(dots[6]);
    clock.advance(1);
    expect(frame()).toBe(dots[8]);
    clock.advance(1);
    expect(frame()).toBe(dots[1]);
  });

  it("keeps its own copy of a finished text the caller goes on to change", () => {
    const text = new RichText("done");
    const column = new SpinnerColumn("dots", { finishedText: text });
    text.append("!");
    expect(draw(column, 10)).toBe("done end\n");
  });
});

describe("Progress.finished (rich-progress-qjm9)", () => {
  it("is true with no tasks, as Rich's `all` over none is", () => {
    expect(new Progress({ console: new Console({ file: { write: () => {} } }) }).finished).toBe(true);
  });
});

describe("BarColumn pulses (rich-effects-fxiy.3rg)", () => {
  // Python Rich 9d8f9a3: `BarColumn` pulses a task `not task.started`, and
  // `ProgressBar` one whose total is None, at the progress's `get_time()`.
  it("pulses a task not started or with no total, at the frame's moment on the progress's clock", () => {
    const clock = fakeClock();
    const progress = new Progress(new BarColumn(20), { console: new Console({ file: { write: () => {} } }), clock });
    progress.addTask("running", { total: 10 });
    progress.addTask("queued", { total: 10, start: false });
    progress.addTask("open-ended");
    clock.advance(7.5);
    // The bar Rich draws for each task, drawn in a frame for `t`.
    const bar = (total: number, pulse: boolean, t: number): string =>
      renderToString(inFrame(new ProgressBar({ total, completed: 0, width: 20, pulse }), t), { width: 20 }).trimEnd();
    // Printed, the progress draws its bars at 7.5s on its own clock: a pulse there is not the pulse at 0.
    expect(bar(10, true, 7.5)).not.toBe(bar(10, true, 0));
    expect(renderToString(progress, { width: 20, frame: progress.frameNow() }).trimEnd().split("\n")).toEqual([bar(10, false, 7.5), bar(10, true, 7.5), bar(100, true, 7.5)]);
  });

  it("moves a task with no total along as the clock does", () => {
    const clock = fakeClock();
    const progress = new Progress(new BarColumn(40), { console: new Console({ file: { write: () => {} } }), clock });
    progress.addTask("open-ended");
    const frame = (): Segment[] => [...progress.render({ ...OPTS, frame: progress.frameNow(), colorSystem: ColorDepth.TRUECOLOR })];
    clock.advance(2.5);
    const early = frame();
    clock.advance(2);
    expect(frame()).not.toEqual(early);
  });
});

describe("TimeElapsedColumn and TimeRemainingColumn (rich-progress-jj5r)", () => {
  // Python Rich 9d8f9a3 with `get_time` driven by hand, every task added at
  // 0s: `a` is started again at 3s, which keeps its first start, and reaches
  // its total at 5.7s; `q` is added with `start=False` and never started; `r`
  // is at 3 of 10 at 10s and 6 of 10 at 20s, 13.3s left; `n` has no total;
  // `z` is added at 20s already halfway, with no time to have a speed. All are
  // drawn at 20s. Each cell is the column's text and style.
  it("holds a finished task's clock at its finish, estimates a running one's in whole seconds up, and shows none for one never started, as Rich does", () => {
    const columns = [
      new TimeElapsedColumn(),
      new TimeRemainingColumn(),
      new TimeRemainingColumn({ elapsedWhenFinished: true }),
    ];
    // Draws each cell as Progress hands it, keeping the text and its style. A
    // running clock is placed, an animation of its text, read at the 20s the
    // frame is drawn for.
    const rows: string[][] = [];
    const recorder: ProgressColumn = {
      tableColumn: {},
      render: (task) => {
        rows.push(columns.map((column) => {
          const cell = column.render(task);
          const text = cell instanceof RichText ? cell : (cell as Animation<RichText>).at(20);
          return `${text.plain} ${String(text.style)}`;
        }));
        return new RichText("");
      },
    };
    const clock = fakeClock();
    const progress = new Progress(recorder, { console: new Console({ file: { write: () => {} } }), clock });
    const a = progress.addTask("a", { total: 10 });
    progress.addTask("q", { total: 10, start: false });
    const r = progress.addTask("r", { total: 10 });
    progress.addTask("n");
    clock.advance(3);
    progress.startTask(a);
    clock.advance(2.7);
    progress.updateTask(a, { completed: 10 });
    clock.advance(4.3);
    progress.updateTask(r, { completed: 3 });
    clock.advance(10);
    progress.updateTask(r, { completed: 6 });
    progress.updateTask(progress.addTask("z", { total: 10 }), { completed: 5 });
    [...progress.render({ ...OPTS, frame: progress.frameNow() })];

    expect(rows).toEqual([
      ["0:00:05 progress.elapsed", "0:00:00 progress.remaining", "0:00:05 progress.elapsed"],
      ["-:--:-- progress.elapsed", "-:--:-- progress.remaining", "-:--:-- progress.remaining"],
      ["0:00:20 progress.elapsed", "0:00:14 progress.remaining", "0:00:14 progress.remaining"],
      ["0:00:20 progress.elapsed", " progress.remaining", " progress.remaining"],
      ["0:00:00 progress.elapsed", "-:--:-- progress.remaining", "-:--:-- progress.remaining"],
    ]);
  });
});

describe("the percentage and time columns' colours (rich-progress-rihd)", () => {
  // Python Rich 9d8f9a3's `Console(color_system="truecolor").print(column.render(task), end="")`
  // for a task of 5 of 10 added with `start=False`: three columns, three colours.
  const task: Task = { ...fakeTask("x"), total: 10, completed: 5, startTime: undefined, elapsed: undefined };
  it.each([
    ["TaskProgressColumn", new TaskProgressColumn(), "\x1b[35m 50%\x1b[0m"],
    ["TimeElapsedColumn", new TimeElapsedColumn(), "\x1b[33m-:--:--\x1b[0m"],
    ["TimeRemainingColumn", new TimeRemainingColumn(), "\x1b[36m-:--:--\x1b[0m"],
  ])("%s writes Rich's bytes", (_name, column, bytes) => {
    // A task never started shows its cells as text, no clock placed in them.
    const text = column.render(task) as RichText;
    text.end = "";
    expect(renderToString(text, { colorSystem: "truecolor" })).toBe(bytes);
  });
});

describe("TimeRemainingColumn's speed (rich-progress-jj5r.ef9)", () => {
  // Python Rich 9d8f9a3 with `get_time` driven by hand. `a` (total 100) moves
  // 1/s, then 40 in 5s, stalls, and is updated again after its samples have
  // aged out of the 30s period; `q` (total 10, added unstarted) is updated
  // twice before it is started. Drawn after each moment's updates.
  it("estimates from the updates of the last 30 seconds, as of the last one, as Rich does", () => {
    const column = new TimeRemainingColumn();
    let frame: string[] = [];
    const recorder: ProgressColumn = {
      tableColumn: {},
      render: (task) => {
        frame.push(column.render(task).plain);
        return new RichText("");
      },
    };
    const clock = fakeClock();
    const progress = new Progress(recorder, { console: new Console({ file: { write: () => {} } }), clock });
    const a = progress.addTask("a", { total: 100 });
    const q = progress.addTask("q", { total: 10, start: false });
    const moments: [number, () => void][] = [
      [10, () => { progress.updateTask(a, { completed: 10 }); progress.updateTask(q, { completed: 2 }); }],
      [20, () => { progress.updateTask(a, { completed: 20 }); progress.updateTask(q, { completed: 4 }); }],
      [20, () => progress.startTask(q)],
      [25, () => progress.updateTask(a, { advance: 40 })],
      [40, () => {}],
      [70, () => progress.updateTask(a, { completed: 70 })],
      [80, () => progress.updateTask(a, { completed: 90 })],
      [105, () => progress.updateTask(a, { completed: 90 })],
    ];
    const frames = moments.map(([at, update]) => {
      clock.advance(at - clock.now());
      update();
      frame = [];
      [...progress.render({ ...OPTS, frame: progress.frameNow() })];
      return frame;
    });

    expect(frames).toEqual([
      ["-:--:--", "-:--:--"],
      ["0:01:20", "-:--:--"],
      ["0:01:20", "0:00:30"],
      ["0:00:12", "0:00:30"],
      ["0:00:12", "0:00:30"],
      ["-:--:--", "0:00:30"],
      ["0:00:05", "0:00:30"],
      ["-:--:--", "0:00:30"],
    ]);
  });

  // Python Rich 9d8f9a3, same harness: the column's text for the one task a
  // scenario drives, drawn once after it.
  function remainingAfter(scenario: (progress: Progress, clock: ReturnType<typeof fakeClock>) => void): string {
    const column = new TimeRemainingColumn();
    let text = "";
    const recorder: ProgressColumn = {
      tableColumn: {},
      render: (task) => {
        text = column.render(task).plain;
        return new RichText("");
      },
    };
    const clock = fakeClock();
    const progress = new Progress(recorder, { console: new Console({ file: { write: () => {} } }), clock });
    scenario(progress, clock);
    [...progress.render({ ...OPTS, frame: progress.frameNow() })];
    return text;
  }

  it("draws a task started past its total as Rich's floor divmod does", () => {
    const text = remainingAfter((progress, clock) => {
      const q = progress.addTask("q", { total: 10, start: false });
      progress.updateTask(q, { completed: 6 });
      clock.advance(10);
      progress.updateTask(q, { completed: 12 });
      progress.startTask(q);
    });
    expect(text).toBe("-1:59:57");
  });

  it("keeps only the newest thousand samples, as Rich's deque does", () => {
    // 500 updates of 10 then 1000 of 1, 10ms apart: with every sample kept
    // the estimate would be 0:03:56.
    const text = remainingAfter((progress, clock) => {
      const c = progress.addTask("c", { total: 100000 });
      for (let i = 0; i < 1500; i++) {
        clock.advance(i * 0.01 - clock.now());
        progress.updateTask(c, { advance: i < 500 ? 10 : 1 });
      }
    });
    expect(text).toBe("0:15:40");
  });
});

describe("MofNCompleteColumn (rich-progress-adjo)", () => {
  // Python Rich 9d8f9a3: `MofNCompleteColumn().render(task)` for a task at each
  // count, its text and style.
  it("draws both counts whole, the completed one padded to the total's width, styled progress.download, as Rich does", () => {
    const cases: [number, number | undefined, string][] = [
      [5, 1000, "   5/1000"],
      [1000, 1000, "1000/1000"],
      [5.7, 10.9, " 5/10"],
      [12, undefined, "12/?"],
      [0, 7, "0/7"],
      [-3, 100, " -3/100"],
      [-0.5, 10, " 0/10"],
      [1e21, undefined, "1000000000000000000000/?"],
    ];
    const column = new MofNCompleteColumn();
    const drawn = cases.map(([completed, total]) => {
      const text = column.render({ ...fakeTask("x"), completed, total });
      return `${text.plain}|${String(text.style)}`;
    });
    expect(drawn).toEqual(cases.map(([, , plain]) => `${plain}|progress.download`));
  });

  it("draws its separator between the counts, as Rich's separator does", () => {
    const text = new MofNCompleteColumn({ separator: " of " }).render({ ...fakeTask("x"), completed: 5, total: 100 });
    expect(text.plain).toBe("  5 of 100");
  });
});

describe("Progress counts", () => {
  it("refuses a count that is not finite where it enters, naming the field", () => {
    const progress = new Progress();
    expect(() => progress.addTask("x", { total: Infinity })).toThrow(/total must be a finite number, got Infinity/);
    const id = progress.addTask("x", { total: 10 });
    expect(() => progress.updateTask(id, { completed: NaN })).toThrow(/completed must be a finite number, got NaN/);
    expect(() => progress.updateTask(id, { advance: -Infinity })).toThrow(/advance must be a finite number, got -Infinity/);
  });

  it("leaves a task as it was when an update is refused, the sum of two finite counts included", () => {
    const progress = new Progress(new TextColumn("{task.description}"), new MofNCompleteColumn());
    const id = progress.addTask("x", { total: 10 });
    progress.updateTask(id, { completed: 3 });
    expect(() => progress.updateTask(id, { completed: 5, advance: NaN, description: "y" })).toThrow(/advance/);
    const line = () => Segment.splitLines([...progress.render({ ...OPTS, frame: progress.frameNow() })])[0]!.map((segment) => segment.text).join("").trimEnd();
    expect(line()).toBe("x  3/10");
    progress.updateTask(id, { completed: 1e308 });
    const before = line();
    expect(() => progress.updateTask(id, { advance: 1e308 })).toThrow(/completed \+ advance must be a finite number, got Infinity/);
    expect(line()).toBe(before);
  });

  it("lets a given completed win over advance, as Rich's update overwrites after adding", () => {
    const progress = new Progress(new TextColumn("{task.description}"), new MofNCompleteColumn());
    const id = progress.addTask("x", { total: 100 });
    progress.updateTask(id, { completed: 10, advance: 5 });
    const line = Segment.splitLines([...progress.render({ ...OPTS, frame: progress.frameNow() })])[0]!.map((segment) => segment.text).join("");
    expect(line.trimEnd()).toBe("x  10/100");
  });
});

describe("a bar's fill eases toward its count (rich-animation-42lg.k1g)", () => {
  const quiet = (): Console => new Console({ file: { write: () => {} } });
  const linear = { ease: EASES.linear, seconds: 1 };
  // One bar, 10 cells, as Progress draws it at the clock's now: with no
  // colour, so the back is blank and every bar glyph drawn is the fill.
  const bar = (progress: Progress, options: Partial<RenderOptions> = {}): Segment[] =>
    [...progress.render({ ...OPTS, frame: progress.frameNow(), maxWidth: 10, colorSystem: null, ...options })];
  const filled = (segments: Segment[]): number => cellsOf(segments, "━");
  function cellsOf(segments: Segment[], glyph: string): number {
    return [...segments.map((segment) => segment.text).join("")].filter((c) => c === glyph).length;
  }

  it("jumps to the count without a fill timing, as Rich's bar does", () => {
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 50 });
    expect(filled(bar(progress))).toBe(5);
    expect(Segment.nextChange(bar(progress))).toBe(Number.POSITIVE_INFINITY);
  });

  it("eases from where it was to the new count over the timing, then holds there", () => {
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: linear });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 100 });
    expect(filled(bar(progress))).toBe(0);
    clock.advance(0.5);
    expect(filled(bar(progress))).toBe(5);
    clock.advance(0.5);
    expect(filled(bar(progress))).toBe(10);
  });

  it("says it moves every frame while it eases, and nothing once it lands", () => {
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: linear });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 60 });
    clock.advance(0.25);
    expect(Segment.nextChange(bar(progress))).toBe(0.25);
    clock.advance(1);
    expect(Segment.nextChange(bar(progress))).toBe(Number.POSITIVE_INFINITY);
  });

  // The platform's clock moves between any two reads of it, which a fake one
  // does not: this one reads a hair later every time it is asked.
  it.each([false, true])("redraws an easing bar at the refresh rate on a clock that moves between reads (update refresh: %s)", (refresh) => {
    const inner = fakeClock(10);
    let reads = 0;
    const clock = { ...inner, now: () => inner.now() + ++reads * 1e-4 };
    let frames = 0;
    const console = new Console({ width: 10, colorSystem: null, forceTerminal: true, file: { write: () => void frames++ } });
    const progress = new Progress(new BarColumn(10), { console, clock, fill: { ease: EASES.linear, seconds: 2 }, refreshPerSecond: 10 });
    const id = progress.addTask("job", { total: 100 });
    progress.start();
    progress.updateTask(id, { completed: 100, refresh });
    const before = frames;
    inner.advance(1);
    expect(frames - before).toBeLessThanOrEqual(12);
    progress.stop();
  });

  it("draws a pulsing bar as the pulse it is, with the pulse's own wake", () => {
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: linear });
    progress.addTask("open-ended");
    const pulse = inFrame(new ProgressBar({ total: 100, width: 10, pulse: true }), 0);
    expect(renderToString(progress, { width: 10, frame: progress.frameNow() }).trimEnd()).toBe(renderToString(pulse, { width: 10 }).trimEnd());
    const truecolor = { ...OPTS, maxWidth: 10, colorSystem: ColorDepth.TRUECOLOR };
    expect(Segment.nextChange([...progress.render({ ...truecolor, frame: progress.frameNow() })])).toBe(Segment.nextChange([...pulse.render(truecolor)]));
  });

  // A back-out ease toward 95 passes 100 on its way: the bar is drawn full,
  // in the colour of work not yet done.
  it("colours an overshooting bar by the task's count, not the fill it draws", () => {
    const backOut = { ease: EASES["back-out"], seconds: 1 };
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: backOut });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 95 });
    const eased = tween(0, 95, backOut);
    const peak = [...Array(100).keys()].map((i) => i / 100).reduce((a, b) => (eased.at(b) > eased.at(a) ? b : a));
    expect(eased.at(peak)).toBeGreaterThan(100);
    clock.advance(peak);
    const drawn = (finished: boolean): string => renderToString(new ProgressBar({ total: 100, completed: eased.at(peak), width: 10, finished }), { width: 10 }).trimEnd();
    expect(renderToString(progress, { width: 10, frame: progress.frameNow() }).trimEnd()).toBe(drawn(false));
    expect(drawn(false)).not.toBe(drawn(true));
  });

  // Three updates inside one second. Drawn once a second or sixty times, the
  // bar at a shared moment is the same bytes, and it is the tween retargeted
  // from where it was at each update.
  it("draws the same bar for the same moment at one frame a second and sixty, through a burst of retargets", () => {
    const run = (fps: number): Map<number, string> => {
      const clock = fakeClock(10);
      const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: linear });
      const id = progress.addTask("job", { total: 100 });
      const updates = new Map([[600, 30], [618, 90], [636, 40]]); // at 10.0s, 10.3s and 10.6s, in 60ths
      const frames = new Map<number, string>();
      for (let tick = 600; tick <= 780; tick++, clock.advance(1 / 60)) {
        const to = updates.get(tick);
        if (to !== undefined) progress.updateTask(id, { completed: to });
        if (tick % (60 / fps) === 0) frames.set(tick, renderToString(progress, { width: 10, frame: progress.frameNow() }).trimEnd());
      }
      return frames;
    };
    const slow = run(1);
    const fast = run(60);
    for (const [tick, frame] of slow) expect(frame).toBe(fast.get(tick));

    const first = tween(0, 30, linear);
    const second = Animation.sequence(first, 0.3, tween(first.at(0.3), 90, linear));
    const third = Animation.sequence(second, 0.6, tween(second.at(0.6), 40, linear));
    const expected = new ProgressBar({ total: 100, completed: third.at(1), width: 10 });
    expect(slow.get(660)).toBe(renderToString(expected, { width: 10 }).trimEnd());
  });

  it("draws the new count at once under reduced motion", () => {
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: linear });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 70 });
    expect(filled(bar(progress, { reducedMotion: true }))).toBe(7);
    expect(Segment.nextChange(bar(progress, { reducedMotion: true }))).toBe(Number.POSITIVE_INFINITY);
  });

  it("leaves the bar at its count on the screen when stopped mid-ease", () => {
    const clock = fakeClock(10);
    const written: string[] = [];
    const console = new Console({ forceInteractive: false, width: 10, colorSystem: null, file: { write: (s) => void written.push(String(s)) } });
    const progress = new Progress(new BarColumn(10), { console, clock, fill: linear });
    const id = progress.addTask("job", { total: 100 });
    progress.start();
    progress.updateTask(id, { completed: 100 });
    progress.stop();
    expect(written.join("")).toContain("━".repeat(10));
  });

  // Rich colours a bar finished when its count reaches its total, whenever
  // and however it got there: an empty total, a task that reached it before
  // it started, a count taken back after it finished.
  it.each([
    { name: "an empty total", total: 0, start: true, steps: [], completed: 0, done: true },
    { name: "a count reached before the task started", total: 10, start: false, steps: [10, "start"], completed: 10, done: true },
    { name: "a count taken back after finishing", total: 10, start: true, steps: [10, 3], completed: 3, done: false },
  ] as const)("colours the bar by its count for $name", ({ total, start, steps, completed, done }) => {
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock: fakeClock(10) });
    const id = progress.addTask("job", { total, start });
    for (const step of steps) step === "start" ? progress.startTask(id) : progress.updateTask(id, { completed: step });
    const expected = new ProgressBar({ total, completed, width: 10, finished: done });
    expect(renderToString(progress, { width: 10, frame: progress.frameNow() }).trimEnd()).toBe(renderToString(expected, { width: 10 }).trimEnd());
  });

  it("keeps the ease running through an update that leaves the count alone", () => {
    const clock = fakeClock(10);
    const progress = new Progress(new BarColumn(10), { console: quiet(), clock, fill: linear });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 100 });
    clock.advance(0.5);
    progress.updateTask(id, { description: "renamed" });
    clock.advance(0.5);
    expect(filled(bar(progress))).toBe(10);
  });
});

// A Progress keeps time between frames — when each task started, each update,
// each finish — and reads all of it, and the time each frame is drawn for,
// from one host: its own Live, or the host it is drawn by.
describe("a Progress is timed on the host that draws it (rich-animation-42lg.1t6)", () => {
  const quiet = (): Console => new Console({ file: { write: () => {} } });
  const elapsedOf = (progress: Progress, options: RenderOptions = { ...OPTS, frame: progress.frameNow() }): string => [...progress.render({ ...options, maxWidth: 40 })].map((segment) => segment.text).join("").trim();
  const timed = (host: FrameHost): Progress => new Progress(new TextColumn("{task.description}"), new TimeElapsedColumn(), { drawnBy: host });
  /** A host whose time the test sets, counting the reads of it. */
  const settable = (frameTime: number) => {
    const host = { reads: 0, time: frameTime, frameNow() { host.reads++; return { time: host.time, host }; } };
    return host;
  };
  const later = () => new Promise((resolve) => setTimeout(resolve));
  const rowsOf = (frame: readonly (readonly Segment[])[]): string => frame.map((row) => row.map((segment) => segment.text).join("")).join("\n");

  it("draws a frame at the frame's time, reading nothing else", () => {
    const host = settable(10);
    const progress = timed(host);
    progress.addTask("job");
    host.reads = 0;
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 15, host } })).toBe("job 0:00:05");
    expect(host.reads).toBe(0);
  });

  // A host that draws a Progress paints its elapsed clock because the frame
  // says when the next second turns — nothing else tells it to.
  it("says its running clock holds until the next whole second, reduced or not", () => {
    const host = settable(10);
    const progress = timed(host);
    progress.addTask("job");
    for (const reducedMotion of [false, true]) {
      const segments = [...render(progress, { ...OPTS, maxWidth: 40, reducedMotion, frame: { time: 15.25, host } })];
      expect(segments.map((segment) => segment.text).join("").trim()).toBe("job 0:00:05");
      expect(Segment.lastChange(segments)).toBeCloseTo(15, 9);
      expect(Segment.nextChange(segments)).toBeCloseTo(16, 9);
    }
  });

  it("draws one time the same however its host's clock has moved since", () => {
    const host = settable(10);
    const progress = timed(host);
    progress.addTask("job");
    const frame = { time: 12, host };
    const first = elapsedOf(progress, { ...OPTS, frame });
    host.time = 50;
    expect(elapsedOf(progress, { ...OPTS, frame })).toBe(first);
  });

  // Inside a frame of its own host, the frame it draws its table in is the one it was handed, so the
  // held walk, which hands its contents that frame too, reports what a drawn frame would.
  it("in a frame of its own host, holds what it would draw", () => {
    const host = settable(0);
    const [a, b] = [new RichText("a"), new RichText("b")];
    const progress = new Progress({ tableColumn: {}, render: () => Animation.map(beat([1, 1]), (i) => (i === 0 ? a : b)) }, { drawnBy: host });
    progress.addTask("job");
    const heard = (maxWidth: number): Renderable[] => {
      const out: Renderable[] = [];
      [...render(progress, { ...OPTS, maxWidth, frame: { time: 1.5, host }, onPresent: (r) => out.push(r) })];
      return out;
    };
    expect(heard(40)).toContain(b);
    expect(heard(0)).toContain(b);
    expect(heard(0)).not.toContain(a);
  });

  it("printed, shows the time elapsed as it prints", () => {
    const clock = fakeClock(100);
    const progress = new Progress(new TextColumn("{task.description}"), new TimeElapsedColumn(), { console: quiet(), clock });
    progress.addTask("job");
    clock.advance(5);
    expect(elapsedOf(progress)).toBe("job 0:00:05");
  });

  it("throws when drawn in a frame of a host it was not made for", () => {
    const progress = timed(settable(0));
    progress.addTask("job");
    expect(() => elapsedOf(progress, { ...OPTS, frame: { time: 0, host: settable(0) } })).toThrow(/drawnBy/);
    const own = new Progress({ console: quiet(), clock: fakeClock() });
    expect(() => elapsedOf(own, { ...OPTS, frame: { time: 0, host: settable(0) } })).toThrow(/drawnBy/);
  });

  it("has nothing of its own to start when another host draws it", () => {
    const progress = timed(settable(0));
    expect(() => progress.start()).toThrow(/drawnBy/);
    expect(() => progress.refresh()).toThrow(/drawnBy/);
    expect(() => progress.console).toThrow(/drawnBy/);
  });

  it("refuses to refresh an update before it changes the task", () => {
    const host = settable(0);
    const progress = new Progress(new MofNCompleteColumn(), { drawnBy: host });
    const id = progress.addTask("job", { total: 10 });
    expect(() => progress.updateTask(id, { advance: 3, refresh: true })).toThrow(/drawnBy/);
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 0, host } })).toBe("0/10");
  });

  it("settles every bar at its count when stopped, for the next frame its host draws", () => {
    const host = settable(0);
    const progress = new Progress(new BarColumn(10), { drawnBy: host, fill: { ease: EASES.linear, seconds: 2 } });
    const id = progress.addTask("job", { total: 100 });
    progress.updateTask(id, { completed: 100 });
    progress.stop();
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 0, host } })).toBe("━".repeat(10));
  });

  it("has not finished a task when drawn for a moment before it reached its total", () => {
    const host = settable(10);
    const progress = timed(host);
    const id = progress.addTask("job", { total: 1 });
    host.time = 15;
    progress.updateTask(id, { completed: 1 });
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 12, host } })).toBe("job 0:00:02");
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 30, host } })).toBe("job 0:00:05");
  });

  it("has not started a task when drawn for a moment before its start, and keeps time that ran back non-negative", () => {
    const host = settable(10);
    const progress = new Progress(new TextColumn("{task.description}"), new TimeElapsedColumn(), new TimeRemainingColumn(), { drawnBy: host });
    const id = progress.addTask("job", { total: 100 });
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 8, host } })).toBe("job -:--:-- -:--:--");
    // Updates heard while the host's timeline runs back.
    host.time = 14;
    progress.updateTask(id, { completed: 40 });
    host.time = 12;
    progress.updateTask(id, { completed: 60 });
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 12, host } })).toBe("job 0:00:02 -:--:--");
    host.time = 11;
    progress.updateTask(id, { completed: 100 });
    expect(progress.finished).toBe(true);
    expect(elapsedOf(progress, { ...OPTS, frame: { time: 30, host } })).toBe("job 0:00:01 0:00:00");
  });

  it("does not finish a task by an update heard before it started", () => {
    const host = settable(10);
    const progress = timed(host);
    const id = progress.addTask("job", { total: 1 });
    host.time = 5;
    progress.updateTask(id, { completed: 1 });
    expect(progress.finished).toBe(false);
  });

  it("draws the same at a time whether its host drew once a second or sixty times", () => {
    const at = (rate: number): string => {
      const host = settable(0);
      const progress = new Progress(new SpinnerColumn(), new BarColumn(10), new TimeElapsedColumn(), { drawnBy: host, fill: { ease: EASES.linear, seconds: 2 } });
      const id = progress.addTask("job", { total: 100 });
      host.time = 0.5;
      progress.updateTask(id, { completed: 80 });
      let drawn = "";
      for (let frame = 0; frame <= 3 * rate; frame++) {
        drawn = segmentsToString([...progress.render({ ...OPTS, maxWidth: 30, colorSystem: ColorDepth.TRUECOLOR, frame: { time: frame / rate, host } })], { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, reducedMotion: false });
      }
      return drawn;
    };
    expect(at(1)).toBe(at(60));
  });

  it("is held by its App's paused timeline, a task added meanwhile included", async () => {
    const clock = fakeClock(0);
    let progress: Progress | undefined;
    const app = new App({ host: scriptedHost({ cols: 30, rows: 3 }), surface: "inline", view: () => progress!, clock });
    progress = timed(app);
    progress.addTask("first");
    void app.run();
    await later();
    clock.advance(2);
    app.timeline = Timeline.pause(app.timeline, clock.now());
    await later();
    progress.addTask("second");
    app.refresh();
    await later();
    const held = rowsOf(app.frame);
    expect(held).toMatch(/first +0:00:02/);
    expect(held).toMatch(/second +0:00:00/);
    clock.advance(10);
    app.refresh();
    await later();
    expect(rowsOf(app.frame)).toBe(held);
    app.stop();
  });

  // The Live is made first, with no view, so the Progress can name it; the
  // view it is then given is on the timeline, and the time is the same one.
  it("keeps its tasks' time when its Live's view moves onto the timeline", () => {
    const clock = fakeClock(1000);
    const live = new Live(undefined, { console: quiet(), clock });
    const progress = timed(live);
    progress.addTask("job");
    clock.advance(3);
    live.update(() => progress);
    expect(elapsedOf(progress, { ...OPTS, frame: live.frameNow() })).toBe("job 0:00:03");
  });

  it("is drawn by a WidgetApp it was made for", async () => {
    const clock = fakeClock(0);
    let progress: Progress | undefined;
    const app = new WidgetApp({ host: scriptedHost({ cols: 30, rows: 3 }), surface: "inline", view: () => progress!, clock });
    progress = timed(app);
    progress.addTask("job");
    void app.run();
    await later();
    clock.advance(3);
    app.refresh();
    await later();
    expect(rowsOf(app.frame)).toContain("job 0:00:03");
    app.stop();
  });
});
