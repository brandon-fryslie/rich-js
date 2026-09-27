import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import { Segment } from "../../src/core/segment.js";
import type { Height, Renderable, RenderOptions } from "../../src/core/protocol.js";
import { Layout } from "../../src/renderables/layout.js";
import { Live, type LiveOptions } from "../../src/renderables/live.js";
import { RichText } from "../../src/core/text.js";

// The budget each render was handed, and the lines it draws.
class Probe implements Renderable {
  readonly seen: (Height | undefined)[] = [];
  constructor(private readonly lines: number) {}
  *render(options: RenderOptions): Iterable<Segment> {
    this.seen.push(options.height);
    for (let i = 0; i < this.lines; i++) {
      yield new Segment(`line ${i}`);
      yield Segment.line();
    }
  }
}

function sized(height: number): { console: Console; out: () => string } {
  const chunks: string[] = [];
  const console = new Console({
    width: 20,
    height,
    colorSystem: null,
    hyperlinks: false,
    file: { write: (s: string) => void chunks.push(s) },
  });
  return { console, out: () => chunks.join("") };
}

// What one refresh wrote, after the cursor control Live issues around it.
function frame(renderable: Renderable, height: number, options: LiveOptions): string {
  const { console, out } = sized(height);
  const live = new Live(renderable, { console, autoRefresh: false, ...options });
  live.refresh();
  return out().replace(/^\x1b\[2J\x1b\[H/, "");
}

describe("the Height a renderable receives", () => {
  it("Console.print hands each block the terminal's rows as a ceiling", () => {
    const { console } = sized(7);
    const probe = new Probe(1);
    console.print(probe);
    expect(probe.seen).toEqual([{ rows: 7, exact: false }]);
  });

  it("inline Live hands the ceiling; alt-screen Live hands the screen as a region", () => {
    const inline = new Probe(1);
    frame(inline, 5, {});
    expect(inline.seen).toEqual([{ rows: 5, exact: false }]);

    const full = new Probe(1);
    frame(full, 5, { altScreen: true });
    expect(full.seen).toEqual([{ rows: 5, exact: true }]);
  });
});

describe("alt-screen Live frames", () => {
  it("a Layout fills the screen with no wrapper, and the last row ends without a newline", () => {
    const layout = new Layout();
    layout.splitColumn(
      new Layout(new RichText("top", { end: "" })),
      new Layout(new RichText("bottom", { end: "" })),
    );
    const rows = frame(layout, 6, { altScreen: true }).split("\n");
    // Six rows, not seven: a trailing newline would leave an empty seventh
    // element here, and on a terminal it scrolls the first row off the top.
    expect(rows).toHaveLength(6);
    expect(rows[0]!.trimEnd()).toBe("top");
    expect(rows[3]!.trimEnd()).toBe("bottom");
  });

  it("short content is padded to the screen, and tall content cropped to it", () => {
    expect(frame(new Probe(2), 4, { altScreen: true }).split("\n")).toEqual(["line 0", "line 1", "", ""]);
    expect(frame(new Probe(9), 3, { altScreen: true, verticalOverflow: "crop" }).split("\n")).toEqual([
      "line 0",
      "line 1",
      "line 2",
    ]);
  });
});

describe("inline Live frames", () => {
  it("keep their natural height under the ceiling and end with a newline", () => {
    expect(frame(new Probe(2), 10, {})).toBe("line 0\nline 1\n");
  });

  it("crop at the ceiling, with the ellipsis by default", () => {
    expect(frame(new Probe(5), 3, {})).toBe("line 0\nline 1\n...\n");
  });
});
