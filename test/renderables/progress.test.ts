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
import { Theme } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { ColorDepth } from "../../src/core/color.js";
import { fakeClock } from "../core/fake-clock.js";

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
  visible: true,
  startTime: 0,
  time: 0,
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
    const lines = Segment.splitLines([...progress.render({ ...OPTS, maxWidth })]);
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
    const line = Segment.splitLines([...progress.render({ ...OPTS, maxWidth: 30 })])[0]!
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
    console.print(progress);
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
    console.print(progress);
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
    const lines = Segment.splitLines([...progress.render({ ...OPTS, maxWidth: 30 })]);
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
    const progress = new Progress(column, new TextColumn("end"), { console });
    const id = progress.addTask("x", task);
    for (const completed of updates) progress.updateTask(id, { completed });
    console.print(progress);
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
    const progress = new Progress(column, new TextColumn("end"), { console });
    progress.addTask("a", { total: 10 });
    progress.updateTask(progress.addTask("b", { total: 10 }), { completed: 10 });
    console.print(progress);
    expect(chunks.join("")).toBe(expected);
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
    const bars = new BarColumn(20);
    const pulses: ({ readonly t: number } | undefined)[] = [];
    const recorder: ProgressColumn = {
      tableColumn: {},
      render: (task) => {
        pulses.push(bars.render(task).pulse);
        return new RichText("");
      },
    };
    const clock = fakeClock();
    const progress = new Progress(recorder, { console: new Console({ file: { write: () => {} } }), clock });
    progress.addTask("running", { total: 10 });
    progress.addTask("queued", { total: 10, start: false });
    progress.addTask("open-ended");
    clock.advance(7.5);
    [...progress.render(OPTS)];
    expect(pulses).toEqual([undefined, { t: 7.5 }, { t: 7.5 }]);
  });

  it("moves a task with no total along as the clock does", () => {
    const clock = fakeClock();
    const progress = new Progress(new BarColumn(40), { console: new Console({ file: { write: () => {} } }), clock });
    progress.addTask("open-ended");
    const frame = (): Segment[] => [...progress.render({ ...OPTS, colorSystem: ColorDepth.TRUECOLOR })];
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
    // Draws each cell as Progress hands it, keeping the text and its style.
    const rows: string[][] = [];
    const recorder: ProgressColumn = {
      tableColumn: {},
      render: (task) => {
        rows.push(columns.map((column) => {
          const text = column.render(task);
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
    [...progress.render(OPTS)];

    expect(rows).toEqual([
      ["0:00:05 progress.elapsed", "0:00:00 progress.remaining", "0:00:05 progress.elapsed"],
      ["-:--:-- progress.elapsed", "-:--:-- progress.remaining", "-:--:-- progress.remaining"],
      ["0:00:20 progress.elapsed", "0:00:14 progress.remaining", "0:00:14 progress.remaining"],
      ["0:00:20 progress.elapsed", " progress.remaining", " progress.remaining"],
      ["0:00:00 progress.elapsed", "-:--:-- progress.remaining", "-:--:-- progress.remaining"],
    ]);
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
      [...progress.render(OPTS)];
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
    [...progress.render(OPTS)];
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
    expect(() => progress.updateTask(id, { completed: 1e308, advance: 1e308 })).toThrow(/completed must be a finite number, got Infinity/);
    const line = Segment.splitLines([...progress.render(OPTS)])[0]!.map((segment) => segment.text).join("");
    expect(line.trimEnd()).toBe("x  3/10");
  });
});
