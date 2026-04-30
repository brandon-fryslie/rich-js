import { describe, it, expect } from "vitest";
import { TextColumn } from "../../src/renderables/progress.js";
import type { RenderOptions } from "../../src/core/protocol.js";

const OPTS: RenderOptions = {
  maxWidth: 80,
  isTerminal: false,
  encoding: "utf-8",
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
