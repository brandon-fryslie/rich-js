import { afterEach, describe, expect, it, vi } from "vitest";
import xterm from "@xterm/headless";
import { Console } from "../../src/core/console.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import type { Renderable } from "../../src/core/protocol.js";
import { Live, type LiveOptions } from "../../src/renderables/live.js";
import { Panel } from "../../src/renderables/panel.js";
import { Progress } from "../../src/renderables/progress.js";
import { Status } from "../../src/renderables/status.js";
import { fakeClock } from "../core/fake-clock.js";

const SHOW_CURSOR = "\x1b[0m\x1b[?25h";
const EXIT_ALT_SCREEN = "\x1b[?1049l";

class RenderFailed extends Error {}

// A renderable whose render throws, as one naming a style the theme lacks does.
const broken: Renderable = {
  render() {
    throw new RenderFailed("render failed");
  },
};

function live(options: LiveOptions): { live: Live; out: () => string } {
  const chunks: string[] = [];
  const console = new Console({
    width: 20,
    height: 5,
    colorSystem: null,
    forceTerminal: true,
    hyperlinks: false,
    file: { write: (s: string) => void chunks.push(s) },
  });
  return { live: new Live(new RichText("good"), { console, ...options }), out: () => chunks.join("") };
}

describe("Live when a frame's render throws", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it.each([
    ["inline", false],
    ["on the alternate screen", true],
  ])("refresh() leaves the last frame on the terminal %s", (_mode, altScreen) => {
    const { live: display, out } = live({ autoRefresh: false, altScreen });
    display.start();
    display.refresh();
    const drawn = out();

    display.update(broken);
    expect(() => display.refresh()).toThrow(RenderFailed);
    expect(out()).toBe(drawn);
  });

  it("the alternate screen's first good frame still covers the screen after a failed one", async () => {
    const term = terminal(20, 5);
    const display = new Live(broken, { console: term.console, autoRefresh: false, altScreen: true });
    display.start();
    term.console.file.write("left\nover");
    expect(() => display.refresh()).toThrow(RenderFailed);

    display.update(new RichText("good"));
    display.refresh();
    expect(await term.rows()).toEqual(["good"]);
  });

  // What each mode writes to hand the terminal back with a frame on it: inline,
  // the line under the frame, where the program's next output belongs.
  const modes = [
    ["inline", false, SHOW_CURSOR + "\n"],
    ["on the alternate screen", true, SHOW_CURSOR + EXIT_ALT_SCREEN],
  ] as const;

  it.each(modes)(
    "an auto-refresh failure hands the terminal back before the error escapes %s",
    (_mode, altScreen, handBack) => {
      vi.useFakeTimers();
      const { live: display, out } = live({ altScreen, refreshPerSecond: 10 });
      display.start();
      display.refresh();
      display.update(broken);

      expect(() => vi.advanceTimersByTime(100)).toThrow(RenderFailed);
      expect(out().endsWith(handBack)).toBe(true);

      // The terminal is no longer this Live's: no timer, no frame, no second hand-back.
      const after = out();
      vi.advanceTimersByTime(1000);
      display.update(new RichText("good"), { refresh: true });
      display.stop();
      expect(out()).toBe(after);
    },
  );

  it("an auto-refresh failure before any frame hands the terminal back with no line under it", () => {
    vi.useFakeTimers();
    const { live: display, out } = live({ refreshPerSecond: 10 });
    display.update(broken);
    display.start();

    expect(() => vi.advanceTimersByTime(100)).toThrow(RenderFailed);
    expect(out().endsWith(SHOW_CURSOR)).toBe(true);
  });

  it.each(modes)(
    "stop() surfaces a failed final frame and still hands the terminal back %s",
    (_mode, altScreen, handBack) => {
      const { live: display, out } = live({ autoRefresh: false, altScreen });
      display.start();
      display.refresh();
      const drawn = out();
      display.update(broken);

      expect(() => display.stop()).toThrow(RenderFailed);
      expect(out()).toBe(drawn + handBack);
    },
  );
});

describe("Live outside start() and stop()", () => {
  it.each([
    ["inline", false],
    ["on the alternate screen", true],
  ])("draws no frame %s", (_mode, altScreen) => {
    const { live: display, out } = live({ autoRefresh: false, altScreen });
    display.refresh();
    expect(out()).toBe("");

    display.start();
    display.stop();
    const stopped = out();
    display.refresh();
    expect(out()).toBe(stopped);
  });
});

/**
 * A terminal `cols` by `rows` — xterm's own model of one, so what is asserted
 * is what a user would see and scroll back through, not the bytes that drew
 * it — and a console writing to it. `\n` is a newline as a tty's output
 * processing delivers it, a carriage return included.
 */
function terminal(cols: number, rows: number): { console: Console; rows: () => Promise<string[]> } {
  const term = new xterm.Terminal({ cols, rows, convertEol: true, allowProposedApi: true });
  let written = Promise.resolve();
  const write = (data: string): void => {
    written = written.then(() => new Promise<void>((resolve) => term.write(data, resolve)));
  };
  const console = new Console({ width: cols, height: rows, colorSystem: null, hyperlinks: false, forceTerminal: true, file: { write } });
  // Every line of scrollback and screen, to the last one written.
  const lines = async (): Promise<string[]> => {
    await written;
    const buffer = term.buffer.active;
    const all = Array.from({ length: buffer.length }, (_, i) => buffer.getLine(i)!.translateToString(true));
    while (all.length > 0 && all.at(-1) === "") all.pop();
    return all;
  };
  return { console, rows: lines };
}

function numbered(count: number): RichText {
  return new RichText(Array.from({ length: count }, (_, i) => `line ${i}`).join("\n"));
}

describe("Live inline on a terminal", () => {
  it("refreshes a frame as tall as the terminal in place, with nothing added to scrollback", async () => {
    const term = terminal(20, 10);
    const display = new Live(numbered(30), { console: term.console, autoRefresh: false });
    display.start();
    for (let i = 0; i < 4; i++) display.refresh();
    display.stop();
    term.console.file.write("after\n");

    const kept = Array.from({ length: 9 }, (_, i) => `line ${i}`);
    expect(await term.rows()).toEqual([...kept, "...", "after"]);
  });

  it("starts the program's next output on its own line after stop()", async () => {
    const term = terminal(20, 10);
    term.console.file.write("before\n");
    const display = new Live(new RichText("a\nb"), { console: term.console, autoRefresh: false });
    display.start();
    display.refresh();
    display.stop();
    term.console.file.write("after\n");

    expect(await term.rows()).toEqual(["before", "a", "b", "after"]);
  });

  it("blanks the rows a shorter frame leaves, and follows it from its own height", async () => {
    const term = terminal(20, 10);
    const display = new Live(new RichText("a\nb\nc"), { console: term.console, autoRefresh: false });
    display.start();
    display.refresh();
    display.update(new RichText("z"), { refresh: true });
    display.stop();
    term.console.file.write("after\n");

    expect(await term.rows()).toEqual(["z", "after"]);
  });

  it("leaves nothing behind when transient, and the next output takes the frame's place", async () => {
    const term = terminal(20, 10);
    term.console.file.write("before\n");
    const display = new Live(new RichText("a\nb\nc"), { console: term.console, autoRefresh: false, transient: true });
    display.start();
    display.refresh();
    display.stop();
    term.console.file.write("after\n");

    expect(await term.rows()).toEqual(["before", "after"]);
  });

  it("keeps the frame it handed back when started again", async () => {
    const term = terminal(20, 10);
    const display = new Live(new RichText("a\nb\nc"), { console: term.console, autoRefresh: false });
    display.start();
    display.refresh();
    display.stop();
    display.update(new RichText("x\ny\nz"));
    display.start();
    display.refresh();
    display.stop();

    expect(await term.rows()).toEqual(["a", "b", "c", "x", "y", "z"]);
  });

  it("crops a row wider than the terminal, so refreshing does not drift the frame down", async () => {
    const term = terminal(20, 10);
    const wide: Renderable = {
      *render() {
        yield new Segment("w".repeat(30));
        yield new Segment("\n");
        yield new Segment("b");
      },
    };
    const display = new Live(wide, { console: term.console, autoRefresh: false });
    display.start();
    for (let i = 0; i < 3; i++) display.refresh();
    display.stop();
    term.console.file.write("after\n");

    expect(await term.rows()).toEqual(["w".repeat(20), "b", "after"]);
  });

  it("leaves the cursor's line alone when handed back before any frame", async () => {
    const term = terminal(20, 10);
    term.console.file.write("before: ");
    const display = new Live(new RichText("a"), { console: term.console, autoRefresh: false, transient: true });
    display.start();
    display.stop();
    term.console.file.write("after\n");

    expect(await term.rows()).toEqual(["before: after"]);
  });
});

describe("Printing through live.console", () => {
  const panel = (): Panel => new Panel("working", { expand: false });
  const PANEL = ["╭─────────╮", "│ working │", "╰─────────╯"];

  it("lands above the frame, and refreshing keeps it", async () => {
    const term = terminal(20, 10);
    const display = new Live(panel(), { console: term.console, autoRefresh: false });
    display.start();
    display.console.print("step one complete");
    display.refresh();
    display.console.print("step two complete");
    display.refresh();
    display.stop();
    term.console.file.write("after\n");

    expect(await term.rows()).toEqual(["step one complete", "step two complete", ...PANEL, "after"]);
  });

  it("lands above the frame for every way the console writes", async () => {
    const term = terminal(30, 10);
    const display = new Live(panel(), {
      console: new Console({
        width: 30,
        height: 10,
        colorSystem: null,
        forceTerminal: true,
        hyperlinks: false,
        file: term.console.file,
        getDatetime: () => new Date(2026, 8, 30, 12, 0, 0),
      }),
      autoRefresh: false,
    });
    display.start();
    display.refresh();
    display.console.print("one\ntwo");
    display.console.log("logged");
    display.console.rule("ruled");
    display.stop();

    const rows = await term.rows();
    expect(rows.slice(0, 2)).toEqual(["one", "two"]);
    expect(rows[2]).toMatch(/^\[12:00:00\] logged/);
    expect(rows[3]).toContain(" ruled ");
    expect(rows.slice(4)).toEqual(PANEL);
  });

  it("goes above the frame's place before the first refresh, and the frame follows it", async () => {
    const term = terminal(20, 10);
    const display = new Live(panel(), { console: term.console, autoRefresh: false });
    display.start();
    display.console.print("early");
    display.stop();

    expect(await term.rows()).toEqual(["early", ...PANEL]);
  });

  it("reaches the terminal as one write, so the frame is never seen gone", () => {
    const chunks: string[] = [];
    const console = new Console({
      width: 20,
      height: 5,
      colorSystem: null,
      forceTerminal: true,
      hyperlinks: false,
      file: { write: (s: string) => void chunks.push(s) },
    });
    const display = new Live(new RichText("good"), { console, autoRefresh: false });
    display.start();
    display.refresh();
    const before = chunks.length;
    display.console.print("printed");

    expect(chunks.slice(before)).toEqual([expect.stringMatching(/printed\n.*good$/s)]);
    display.stop();
  });

  it("keeps a print that stops mid-line, ending its line before the frame", async () => {
    const term = terminal(20, 10);
    const display = new Live(panel(), { console: term.console, autoRefresh: false });
    display.start();
    display.refresh();
    display.console.print("Downloading", { end: "" });
    display.console.print("done");
    display.stop();

    expect(await term.rows()).toEqual(["Downloading", "done", ...PANEL]);
  });

  it("is written plainly once the Live has stopped", async () => {
    const term = terminal(20, 10);
    const display = new Live(panel(), { console: term.console, autoRefresh: false });
    display.start();
    display.refresh();
    display.stop();
    display.console.print("after");

    expect(await term.rows()).toEqual([...PANEL, "after"]);
  });

  it("refuses a second Live on a console one is already running on", () => {
    const term = terminal(20, 10);
    const first = new Live(panel(), { console: term.console, autoRefresh: false });
    const second = new Live(panel(), { console: term.console, autoRefresh: false });
    first.start();
    expect(() => second.start()).toThrow(/already/);
    first.stop();
    second.start();
    second.stop();
  });

  it("keeps a region claimed when a stale release is called again", () => {
    const term = terminal(20, 10);
    const release = term.console.claimLiveRegion({ around: (text) => text });
    release();
    const display = new Live(panel(), { console: term.console, autoRefresh: false });
    display.start();
    release();
    expect(() => new Live(panel(), { console: term.console, autoRefresh: false }).start()).toThrow(/already/);
    display.stop();
  });
});

describe("Live refresh rate", () => {
  it.each([0, -4, Number.NaN, Number.POSITIVE_INFINITY])("refuses %s frames a second where it is constructed", (refreshPerSecond) => {
    expect(() => live({ refreshPerSecond })).toThrow(RangeError);
    expect(() => live({ refreshPerSecond, autoRefresh: false })).toThrow(RangeError);
  });

  it("paints a frame every two seconds at 0.5, on the clock it is given, and leaves no timer once stopped", () => {
    const clock = fakeClock();
    const { live: display, out } = live({ refreshPerSecond: 0.5, clock });
    display.start();
    const frames = (): number => out().split("good").length - 1;

    clock.advance(1.9);
    expect(frames()).toBe(0);
    clock.advance(4.1);
    expect(frames()).toBe(3);

    display.stop();
    expect(clock.timers()).toBe(0);
  });
});

// A file, a pipe, a CI log: what Rich's Live writes there is what was printed,
// plain, and the frame once at stop — never a frame per refresh with the
// escape sequences that move over it.
describe("Live on a console that is not interactive", () => {
  const consoles = [
    ["a file", {}],
    ["a terminal told it is not interactive", { forceTerminal: true, forceInteractive: false }],
    ["a dumb terminal", { forceTerminal: true, environment: { env: { TERM: "dumb" } } }],
  ] as const;

  function plain(console: object, options: LiveOptions): { live: Live; out: () => string; clock: ReturnType<typeof fakeClock> } {
    const chunks: string[] = [];
    const clock = fakeClock();
    const target = new Console({
      width: 20,
      height: 5,
      colorSystem: null,
      hyperlinks: false,
      file: { write: (s: string) => void chunks.push(s) },
      ...console,
    });
    const display = new Live(new RichText("frame\nlast row"), { console: target, clock, ...options });
    return { live: display, out: () => chunks.join(""), clock };
  }

  it.each(consoles)("on %s, writes printed lines plain and the frame once at stop", (_name, console) => {
    for (const altScreen of [false, true]) {
      const { live: display, out, clock } = plain(console, { altScreen });
      display.start();
      clock.advance(1);
      display.console.print("one");
      display.refresh();
      display.console.print("two");
      clock.advance(1);
      display.stop();

      expect(out()).toBe("one\ntwo\nframe\nlast row\n");
    }
  });

  it.each(consoles)("on %s, a transient display writes only what was printed", (_name, console) => {
    const { live: display, out, clock } = plain(console, { transient: true });
    display.start();
    display.console.print("one");
    clock.advance(1);
    display.stop();

    expect(out()).toBe("one\n");
  });

  // Rich draws no frame off a terminal until the last, so a refresh or a
  // print costs no render there; the one render is the frame left at stop.
  it("draws the frame once, at stop, however often it refreshes or prints", () => {
    const chunks: string[] = [];
    const clock = fakeClock();
    let renders = 0;
    const counted: Renderable = {
      render() {
        renders += 1;
        return [new Segment("frame")];
      },
    };
    const target = new Console({ width: 20, height: 5, colorSystem: null, file: { write: (s: string) => void chunks.push(s) } });
    const display = new Live(counted, { console: target, clock });
    display.start();
    clock.advance(3);
    display.refresh();
    display.console.print("one");
    expect(renders).toBe(0);

    display.stop();

    expect(renders).toBe(1);
    expect(chunks.join("")).toBe("one\nframe\n");
  });

  it("prints the frame through the console, so a recording and a capture hold it", () => {
    const chunks: string[] = [];
    const target = new Console({ width: 20, height: 5, colorSystem: null, record: true, file: { write: (s: string) => void chunks.push(s) } });
    const recorded = new Live(new RichText("frame"), { console: target, autoRefresh: false });
    recorded.start();
    recorded.console.print("one");
    recorded.stop();
    expect(target.exportText()).toBe("one\nframe\n");

    target.beginCapture();
    const captured = new Live(new RichText("again"), { console: target, autoRefresh: false });
    captured.start();
    captured.stop();
    expect(target.endCapture()).toBe("again\n");
    expect(chunks.join("")).toBe("one\nframe\n");
  });
});

// Rich's Live, Progress and Status take the console `get_console()` gives,
// which detects the terminal — so piped, none of them paints.
describe("The console a display makes for itself", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("is interactive exactly when a console made with no options is", () => {
    for (const term of ["xterm-256color", "dumb"]) {
      vi.stubEnv("TERM", term);
      const detected = new Console().isInteractive;
      expect(new Live().console.isInteractive).toBe(detected);
      expect(new Progress().console.isInteractive).toBe(detected);
      expect(new Status("working").console.isInteractive).toBe(detected);
    }
  });
});
