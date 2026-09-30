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

// What a first refresh wrote, after the move to the frame's first cell: home
// on the alternate screen, the start of the cursor's line inline.
function frame(renderable: Renderable, height: number, options: LiveOptions): string {
  const { console, out } = sized(height);
  const live = new Live(renderable, { console, autoRefresh: false, ...options });
  live.start();
  const before = out().length;
  live.refresh();
  return out().slice(before).replace(/^(\x1b\[H|\r)/, "");
}

// Each row is erased before it is drawn.
const erased = (text: string) => `\x1b[2K${text}`;

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
    expect(rows[0]!.replace("\x1b[2K", "").trimEnd()).toBe("top");
    expect(rows[3]!.replace("\x1b[2K", "").trimEnd()).toBe("bottom");
  });

  it("short content is padded to the screen, and tall content cropped to it", () => {
    expect(frame(new Probe(2), 4, { altScreen: true }).split("\n")).toEqual(
      ["line 0", "line 1", "", ""].map(erased),
    );
    expect(frame(new Probe(9), 3, { altScreen: true, verticalOverflow: "crop" }).split("\n")).toEqual(
      ["line 0", "line 1", "line 2"].map(erased),
    );
  });

  it("a shorter frame erases every row of the one before it", () => {
    const { console, out } = sized(4);
    const live = new Live(new Probe(4), { console, autoRefresh: false, altScreen: true });
    live.start();
    live.refresh();
    const before = out().length;
    live.update(new Probe(1), { refresh: true });
    const rows = out().slice(before).replace(/^\x1b\[H/, "").split("\n");
    expect(rows).toEqual(["line 0", "", "", ""].map(erased));
  });

  it("an unbounded console width draws a frame", () => {
    const chunks: string[] = [];
    const console = new Console({
      width: Infinity,
      height: 2,
      colorSystem: null,
      file: { write: (s: string) => void chunks.push(s) },
    });
    const live = new Live(new RichText("hi", { end: "" }), { console, autoRefresh: false, altScreen: true });
    live.start();
    const before = chunks.join("").length;
    live.refresh();
    expect(chunks.join("").slice(before).replace(/^\x1b\[H/, "").split("\n")).toEqual(["hi", ""].map(erased));
  });

  it("a transient stop leaves the buffer and erases nothing inside it", () => {
    const { console, out } = sized(4);
    const live = new Live(new Probe(2), { console, autoRefresh: false, altScreen: true, transient: true });
    live.start();
    live.refresh();
    const before = out().length;
    live.stop();
    const stopped = out().slice(before);
    expect(stopped).not.toContain("\x1b[2K");
    expect(stopped.endsWith("\x1b[?25h\x1b[0m\x1b[?1049l")).toBe(true);
  });
});

describe("inline Live frames", () => {
  // No newline after the last row: on a frame as tall as the terminal it
  // would scroll the first row into scrollback.
  it("keep their natural height under the ceiling, the cursor resting on the last row", () => {
    expect(frame(new Probe(2), 10, {}).split("\n")).toEqual(["line 0", "line 1"].map(erased));
  });

  it("crop at the ceiling, with the ellipsis by default", () => {
    expect(frame(new Probe(5), 3, {}).split("\n")).toEqual(["line 0", "line 1", "..."].map(erased));
  });
});
