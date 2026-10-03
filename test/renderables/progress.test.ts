import { describe, it, expect } from "vitest";
import {
  BarColumn,
  Progress,
  SpinnerColumn,
  TaskProgressColumn,
  TextColumn,
} from "../../src/renderables/progress.js";
import { Console } from "../../src/core/console.js";
import { Theme } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/core/protocol.js";

const OPTS: RenderOptions = {
  maxWidth: 80,
  isTerminal: false,
  asciiOnly: false,
};

const fakeTask = (description: string) => ({
  id: 1,
  description,
  total: 100,
  completed: 0,
  started: true,
  visible: true,
  startTime: 0,
  elapsed: 0,
});

function joined(col: TextColumn, description: string): string {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const segs = [...col.render(OPTS, fakeTask(description) as any)];
  return segs.map((s) => s.text).join("");
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const segs = [...col.render(OPTS, fakeTask("hello") as any)];
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
  // Filled and empty cells share one glyph and differ only in style.
  const barCells = (line: string): number => [...line].filter((ch) => ch === "━").length;

  it("keeps its natural width when it does not expand, whatever it is offered", () => {
    expect(row(false, 120)).toBe(row(false, 45));
    expect(row(false, 45).length).toBeLessThan(45);
  });

  // Python Rich 9d8f9a3's `make_tasks_table` for the same columns at width 45.
  // Its grid pads no edge, so the row ends at the last column's text, or at
  // the cell `expand` stretched it to — never on a pad cell. Every bar glyph
  // reads as one: the reference draws a half cell at 42% where this port does
  // not, and what is pinned here is where the columns sit.
  it.each([
    [false, "compiling ━━━━━━━━╺━━━━━━━━━━━ done"],
    [true, "compiling    ━━━━━━━━╺━━━━━━━━━━━       done "],
  ])("lays its row out as Rich does (expand: %s)", (expand, reference) => {
    const cells = (line: string): string => line.replace(/[━╸╺]/g, "#");
    expect(cells(row(expand, 45))).toBe(cells(reference));
  });

  it("fills the offer when it expands and leaves the bar at its own width", () => {
    const line = row(true, 45);
    expect(line).toHaveLength(45);
    expect(line.startsWith("compiling ")).toBe(true);
    expect(barCells(line)).toBe(20);
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
