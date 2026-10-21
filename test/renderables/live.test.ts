import { afterEach, describe, expect, it, vi } from "vitest";
import xterm from "@xterm/headless";
import { Console } from "../../src/core/console.js";
import { RichText } from "../../src/core/text.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import type { Renderable } from "../../src/core/protocol.js";
import { FrameSequence } from "../../src/renderables/frames.js";
import { Live, type LiveOptions } from "../../src/renderables/live.js";
import { Panel } from "../../src/renderables/panel.js";
import { Progress } from "../../src/renderables/progress.js";
import { Status } from "../../src/renderables/status.js";
import { fakeClock, type FakeClock } from "../core/fake-clock.js";
import { Animation } from "../../src/core/animation.js";
import { Timeline } from "../../src/core/timeline.js";
import type { View } from "../../src/core/view.js";

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

  it("a print whose frame fails leaves the next frame painting over the last", async () => {
    const term = terminal(20, 5);
    const display = new Live(new RichText("a\nb\nc"), { console: term.console, autoRefresh: false });
    display.start();
    display.refresh();

    display.update(broken);
    expect(() => display.console.print("hi")).toThrow(RenderFailed);
    display.update(new RichText("a\nb\nc"));
    display.refresh();

    expect(await term.rows()).toEqual(["a", "b", "c"]);
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

    expect(chunks.slice(before)).toEqual([expect.stringMatching(/printed\n.*good\x1b\[\?2026l$/s)]);
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

  // rich-animation-xi28.6k9: a view is asked for each frame with the frame's
  // time on the Live's clock, as an App's is, so what it draws reads none.
  // The default timeline plays from 0 when the Live is made, so on a clock
  // that began long before — the platform's reads from process start — what
  // the view is handed is the time the Live has been showing it.
  it("asks a view for each frame with the time since the Live was made, on a clock that began before it", () => {
    const chunks: string[] = [];
    const clock = fakeClock(10);
    const times: number[] = [];
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: (s: string) => void chunks.push(s) } });
    const display = new Live(
      (t) => {
        times.push(t);
        return new RichText(`t=${t}`);
      },
      { console: target, clock, refreshPerSecond: 2 },
    );
    display.start();
    clock.advance(1);
    display.update((t) => new RichText(`later t=${t}`), { refresh: true });
    display.stop();
    expect(times).toEqual([0.5, 1]);
    expect(chunks.join("")).toContain("later t=1");
    expect(chunks.join("")).toContain("t=0.5");
  });

  // rich-animation-xi28.6rs: a Live draws each frame of what it shows, not a
  // sample of them — it reads when the frame next changes off the frame it
  // drew and wakes then, or at its rate, whichever is sooner.
  it("draws each frame of a sequence whose holds are shorter than its interval, in order, none skipped", () => {
    const clock = fakeClock();
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const seq = new FrameSequence(["a", "b", "c"].map((glyph) => ({ text: new RichText(glyph), seconds: 0.1 })));
    const drawn: { t: number; frame: string }[] = [];
    const display = new Live(
      (t) => {
        drawn.push({ t, frame: seq.at(t).plain });
        return seq;
      },
      { console: target, clock, refreshPerSecond: 4 },
    );
    display.start();
    clock.advance(1);
    display.stop();
    // The first frame at the rate, with nothing drawn yet to say sooner; then
    // every frame start; last, the final frame `stop()` draws at the clock's now.
    expect(drawn.map(({ t }) => t).map((t) => Math.round(t * 1000))).toEqual([250, 300, 400, 500, 600, 700, 800, 900, 1000, 1000]);
    expect(drawn.slice(0, -1).map(({ frame }) => frame).join("")).toBe("cabcabcab");
    expect(clock.timers()).toBe(0);
  });

  it("draws content that changes every frame at its rate, not faster", () => {
    const clock = fakeClock();
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const times: number[] = [];
    const moving = (t: number): Renderable => ({ render: () => [new Segment("x", new Style({ hold: { lastChange: t, nextChange: t } }))] });
    const display = new Live(
      (t) => {
        times.push(t);
        return moving(t);
      },
      { console: target, clock, refreshPerSecond: 4 },
    );
    display.start();
    clock.advance(1);
    expect(times).toEqual([0.25, 0.5, 0.75, 1]);
    display.stop();
  });

  // A frame costs time to draw. The next one is measured from the frame's
  // own time, not from when the paint finished, so the rate holds however
  // heavy the frame — and a change that fell due while it was painting is
  // drawn at once, not a whole interval late.
  it("holds its rate when a frame costs time to draw", () => {
    const clock = fakeClock();
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const times: number[] = [];
    const display = new Live(
      (t) => {
        times.push(t);
        clock.advance(0.1);
        return new RichText("heavy");
      },
      { console: target, clock, refreshPerSecond: 4, autoRefresh: true },
    );
    display.start();
    clock.advance(0.9);
    expect(times).toEqual([0.25, 0.5, 0.75]);
    display.stop();
  });

  it("draws a change that fell due while the frame was being drawn at once", () => {
    const clock = fakeClock();
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const times: number[] = [];
    // A frame that changes 0.02 s after it is drawn and costs 0.025 s to draw.
    const display = new Live(
      (t) => {
        times.push(t);
        clock.advance(0.025);
        return { render: () => [new Segment("x", new Style({ hold: { lastChange: t, nextChange: t + 0.02 } }))] };
      },
      { console: target, clock, refreshPerSecond: 4 },
    );
    display.start();
    clock.advance(0.4);
    // The first frame at the rate; from then on each frame as soon as the one before is drawn, never a rate interval apart.
    expect(times[0]).toBe(0.25);
    expect(times.length).toBeGreaterThan(5);
    for (let i = 1; i < times.length; i++) expect(times[i]! - times[i - 1]!).toBeCloseTo(0.025, 9);
    display.stop();
  });

  it("wakes for a change that comes before the rate's next frame, then returns to the rate", () => {
    const clock = fakeClock();
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const times: number[] = [];
    // A frame that changes 0.3 s after it is drawn, then holds.
    const settled = (t: number): Renderable => ({ render: () => [new Segment("x", new Style({ hold: { lastChange: t <= 1 ? 0 : 1.3, nextChange: t <= 1 ? 1.3 : Number.POSITIVE_INFINITY } }))] });
    const display = new Live(
      (t) => {
        times.push(t);
        return settled(t);
      },
      { console: target, clock, refreshPerSecond: 1 },
    );
    display.start();
    clock.advance(4);
    expect(times).toEqual([1, 1.3, 2.3, 3.3]);
    display.stop();
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

// rich-animation-42lg.04v: a Live draws its view at the time its timeline
// maps the clock to, and wakes when what it drew says it changes, carried
// back onto the clock — faster, backwards, or not at all.
describe("Live on a timeline", () => {
  /** A Live of `view` on `clock` at `perSecond`, and every frame's text with the time it was drawn for. */
  function playing(view: ((t: number) => Renderable) | Animation<Renderable>, perSecond: number, clock: FakeClock, timeline?: Timeline): { display: Live; drawn: { t: number; text: string }[] } {
    const drawn: { t: number; text: string }[] = [];
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const record = (t: number, renderable: Renderable): Renderable => {
      drawn.push({ t, text: renderable instanceof RichText ? renderable.plain : "?" });
      return renderable;
    };
    // The view of the shape it was given, so a function stays a function.
    const recorded: View =
      typeof view === "function"
        ? (t) => record(t, view(t))
        : Animation.of({ at: (t: number) => record(t, view.at(t)), nextChange: (t: number) => view.nextChange(t), lastChange: (t: number) => view.lastChange(t), reduced: () => view.reduced() });
    return { display: new Live(recorded, { console: target, clock, refreshPerSecond: perSecond, timeline }), drawn };
  }
  const word = (text: string): Renderable => new RichText(text);
  // "A" until 3 s, then "B" for good.
  const switching = (): Animation<Renderable> => Animation.sequence(Animation.constant(word("A")), 3, Animation.constant(word("B")));

  it.each([1, 60])("at %s fps, draws each frame for the time a timeline at twice the clock's pace maps it to", (perSecond) => {
    const clock = fakeClock();
    const { display, drawn } = playing((t) => word(`t=${t}`), perSecond, clock, Timeline.play(0, 2));
    display.start();
    clock.advance(3);
    display.stop();
    // A frame a tick, then the one stop() draws at the clock's now.
    expect(drawn).toHaveLength(3 * perSecond + 1);
    drawn.slice(0, -1).forEach(({ t }, i) => expect(t).toBeCloseTo((2 * (i + 1)) / perSecond, 9));
    expect(drawn.at(-1)!.t).toBe(6);
  });

  it.each([1, 60])("at %s fps, draws a held view's switch at the clock moment the timeline reaches it", (perSecond) => {
    const clock = fakeClock();
    const { display, drawn } = playing(switching(), perSecond, clock, Timeline.play(0, 2));
    display.start();
    clock.advance(3);
    display.stop();
    // The switch at 3 is host 1.5: drawn there, and nothing before it shows B.
    const first = drawn.findIndex(({ text }) => text === "B");
    expect(drawn[first]!.t).toBeCloseTo(3, 9);
    expect(drawn.slice(0, first).every(({ text }) => text === "A")).toBe(true);
  });

  // An animation is a renderable, and a renderable view may read state the
  // Live cannot see, so the auto-refresh polls it at the rate; a switch
  // between two ticks is still drawn when it falls due.
  it("at 1 fps wakes for a switch between two frames, and polls at the rate once the view holds for good", () => {
    const clock = fakeClock();
    const { display, drawn } = playing(switching(), 1, clock, Timeline.play(0, 2));
    display.start();
    clock.advance(3);
    expect(clock.timers()).toBe(1);
    display.stop();
    expect(drawn.map(({ t, text }) => `${text}@${t}`)).toEqual(["A@2", "B@3", "B@5", "B@6"]);
  });

  // A function view may read state the Live cannot see, so the auto-refresh
  // polls it at the rate even paused; each frame is drawn at the held time.
  it.each([1, 60])("at %s fps, paused, still polls a function view at its rate, each frame at the held time", (perSecond) => {
    const clock = fakeClock();
    const { display, drawn } = playing((t) => word(`t=${t}`), perSecond, clock);
    display.start();
    clock.advance(1);
    display.timeline = Timeline.pause(display.timeline, clock.now());
    const paused = drawn.length;
    clock.advance(2);
    expect(drawn.length - paused).toBe(2 * perSecond);
    expect(drawn.slice(paused).every(({ t }) => t === 1)).toBe(true);
    display.stop();
  });

  it.each([1, 60])("at %s fps, draws a view updated faster than the rate at the rate", (perSecond) => {
    const clock = fakeClock();
    const { display } = playing((t) => word(`t=${t}`), perSecond, clock);
    let renders = 0;
    display.start();
    // Five updates a frame, none of which draws.
    for (let i = 0; i < 10; i++) {
      clock.advance(1 / perSecond / 5);
      display.update({ render: () => (renders++, [new Segment("row")]) });
    }
    expect(renders).toBe(2);
    display.stop();
  });

  it.each([1, 60])("at %s fps, started on a paused timeline, polls an animation at its rate, every frame at the held time", (perSecond) => {
    const clock = fakeClock();
    const { display, drawn } = playing(Animation.continuous((t) => word(`t=${t}`)), perSecond, clock, Timeline.pause(Timeline.play(0), 0));
    display.start();
    clock.advance(2);
    // A frame a tick from the start on, none sooner.
    expect(drawn).toHaveLength(2 * perSecond);
    expect(drawn.every(({ t }) => t === 0)).toBe(true);
    display.stop();
  });

  it.each([1, 60])("at %s fps, paused, draws an animation at its held time, at the rate and when a caller asks", (perSecond) => {
    const clock = fakeClock();
    const { display, drawn } = playing(Animation.continuous((t) => word(`t=${t}`)), perSecond, clock);
    display.start();
    clock.advance(1);
    const before = drawn.length;
    display.timeline = Timeline.pause(display.timeline, clock.now());
    expect(drawn).toHaveLength(before + 1);
    clock.advance(5);
    expect(drawn).toHaveLength(before + 1 + 5 * perSecond);
    display.refresh();
    expect(drawn.slice(before).every(({ t }) => t === 1)).toBe(true);
    display.stop();
  });

  it.each([1, 60])("at %s fps, a seek while paused draws the sought time, and resuming plays on from it", (perSecond) => {
    const clock = fakeClock();
    const { display, drawn } = playing(Animation.continuous((t) => word(`t=${t}`)), perSecond, clock, Timeline.pause(Timeline.play(0), 0));
    display.start();
    display.timeline = Timeline.seek(display.timeline, clock.now(), 7);
    expect(drawn.map(({ t }) => t)).toEqual([7]);
    clock.advance(2);
    expect(drawn.every(({ t }) => t === 7)).toBe(true);
    const held = drawn.length;

    display.timeline = Timeline.resume(display.timeline, clock.now());
    clock.advance(1);
    // The resumed frame, then a tick's worth for the second that followed.
    expect(drawn).toHaveLength(held + 1 + perSecond);
    expect(drawn.at(-1)!.t).toBeCloseTo(8, 9);
    display.stop();
  });

  it("run backwards, shows the earlier value from the first moment under the switch, not a frame later", () => {
    const clock = fakeClock();
    const { display, drawn } = playing(switching(), 1, clock, Timeline.seek(Timeline.play(0, -1), 0, 5.5));
    display.start();
    clock.advance(3);
    display.stop();
    // The frames at the rate, at 4.5 and 3.5, say B began at the switch; time 3
    // is host 2.5, sooner than the next tick, and A is drawn the first moment
    // after it. A frame landing exactly on 3 would be drawn at the rate
    // instead: there `lastChange(3) === 3`, which the Animation contract reads as moving.
    const first = drawn.findIndex(({ text }) => text === "A");
    expect(drawn.slice(0, first).map(({ t }) => t)).toEqual([4.5, 3.5]);
    expect(drawn[first]!.t).toBeLessThan(3);
    expect(drawn[first]!.t).toBeCloseTo(3, 9);
  });

  // A renderable mutated in place may change without saying so: pausing the
  // timeline holds the time it is drawn for, and a table's new row is not that.
  it.each([1, 60])("at %s fps, paused, still refreshes a renderable view at its rate", (perSecond) => {
    const clock = fakeClock();
    let renders = 0;
    const counted: Renderable = { render: () => (renders++, [new Segment("row")]) };
    const target = new Console({ width: 20, height: 5, colorSystem: null, forceTerminal: true, file: { write: () => {} } });
    const display = new Live(counted, { console: target, clock, refreshPerSecond: perSecond });
    display.start();
    display.timeline = Timeline.pause(display.timeline, clock.now());
    const paused = renders;
    clock.advance(2);
    expect(renders - paused).toBe(2 * perSecond);
    display.stop();
  });

  it.each([1, 60])("at %s fps, paused, refreshes a renderable handed over by update at its rate", (perSecond) => {
    const clock = fakeClock();
    const { display } = playing(switching(), perSecond, clock);
    display.start();
    display.timeline = Timeline.pause(display.timeline, clock.now());
    let renders = 0;
    display.update({ render: () => (renders++, [new Segment("row")]) });
    clock.advance(2);
    expect(renders).toBe(2 * perSecond);
    display.stop();
  });

  it("run backwards, draws a view that says nothing itself at its rate", () => {
    const clock = fakeClock();
    const { display, drawn } = playing((t) => word(`t=${t}`), 4, clock, Timeline.seek(Timeline.play(0, -1), 0, 10));
    display.start();
    clock.advance(1);
    display.stop();
    expect(drawn.map(({ t }) => t)).toEqual([9.75, 9.5, 9.25, 9, 9]);
  });
});
