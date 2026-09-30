import { describe, it, expect } from "vitest";
import {
  BarColumn,
  Progress,
  TextColumn,
} from "../../src/renderables/progress.js";
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
