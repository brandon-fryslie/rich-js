import { describe, it, expect, beforeEach } from "vitest";
import { Writable } from "stream";
import { runInAction } from "mobx";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/index.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { DefaultScreen } from "../../src/widgets/screen.js";
import type { KeyEvent } from "../../src/widgets/types.js";

class StubWidget extends WidgetBase {
  constructor(
    readonly id: string,
    private text: string,
    readonly focusable = true,
  ) {
    super();
  }

  setText(value: string): void {
    runInAction(() => {
      this.text = value;
    });
    this.emitChange();
  }

  // Make text observable indirectly via render(): we re-read `this.text` and
  // the focused state, but for simplicity we expose mutation via setText
  // wrapped in runInAction. Tests that need reactivity flip an observable
  // (focused) instead.
  handleKey(_event: KeyEvent): void {}
  render(_options: RenderOptions): Iterable<Segment> {
    const prefix = this.focused ? "*" : " ";
    return [new Segment(`${prefix}${this.text}`)];
  }
  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: this.text.length + 1, maximum: this.text.length + 1 };
  }
}

class CapturingStream extends Writable {
  chunks: string[] = [];
  isTTY = false;
  columns = 80;
  rows = 24;

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    cb: (err?: Error | null) => void,
  ): void {
    this.chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    cb();
  }

  joined(): string {
    return this.chunks.join("");
  }

  reset(): void {
    this.chunks = [];
  }
}

function makeScreen(opts: { stream?: CapturingStream } = {}): {
  screen: DefaultScreen;
  stream: CapturingStream;
} {
  const stream = opts.stream ?? new CapturingStream();
  const screen = new DefaultScreen({
    out: stream,
    width: 40,
    colorSystem: null, // strip color codes — tests assert plain text
    manageCursor: false,
    focusManager: new DefaultFocusManager(),
  });
  return { screen, stream };
}

// Wait for the next microtask. Screen schedules draws via queueMicrotask, so
// flushing one tick is enough to drain a single render.
async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("DefaultScreen", () => {
  let screen: DefaultScreen;
  let stream: CapturingStream;

  beforeEach(() => {
    const made = makeScreen();
    screen = made.screen;
    stream = made.stream;
  });

  it("starts not running", () => {
    expect(screen.running).toBe(false);
  });

  it("running flips to true on start, false on stop", () => {
    screen.start();
    expect(screen.running).toBe(true);
    screen.stop();
    expect(screen.running).toBe(false);
  });

  it("idempotent start/stop", () => {
    screen.start();
    screen.start();
    expect(screen.running).toBe(true);
    screen.stop();
    screen.stop();
    expect(screen.running).toBe(false);
  });

  describe("mount/unmount", () => {
    it("mount adds widgets and registers with focus manager", () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      expect(screen.focusManager.widgets).toHaveLength(2);
      expect(screen.focusManager.current).toBe(a);
    });

    it("mount is idempotent for the same widget", () => {
      const a = new StubWidget("a", "Alpha");
      screen.mount(a);
      screen.mount(a);
      expect(screen.focusManager.widgets).toHaveLength(1);
    });

    it("unmount removes widgets and unregisters from focus manager", () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      screen.unmount(a);
      expect(screen.focusManager.widgets).toHaveLength(1);
      expect(screen.focusManager.current).toBe(b);
    });
  });

  describe("rendering", () => {
    it("draws all mounted widgets, one per line", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      screen.start();
      await flush();
      const output = stream.joined();
      // First mounted widget auto-focuses, so it gets the "*" prefix.
      expect(output).toContain("*Alpha");
      expect(output).toContain(" Beta");
    });

    it("first frame writes no cursor-up sequence", async () => {
      const a = new StubWidget("a", "Alpha");
      screen.mount(a);
      screen.start();
      await flush();
      // No \x1b[<n>A on the very first frame — there is nothing to move up to.
      expect(stream.joined()).not.toMatch(/\x1b\[\d+A/);
    });

    it("subsequent frames emit cursor-up to overwrite previous frame", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      screen.start();
      await flush();

      stream.reset();
      // Trigger a re-render by toggling focus on a registered widget.
      screen.focusManager.next();
      await flush();

      const out = stream.joined();
      // 2 widgets → 2 lines drawn last frame. Cursor sits on row 2 (no
      // trailing newline), so rewinding to the top is 1 row up.
      expect(out).toMatch(/\x1b\[1A/);
      // Erase-to-end-of-line on each line.
      expect(out).toMatch(/\x1b\[K/);
    });

    it("never emits clear-screen or per-line clear-up sequences", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      screen.start();
      await flush();
      screen.focusManager.next();
      await flush();
      const out = stream.joined();
      // The clear-then-redraw pattern Live uses (\x1b[1A\x1b[2K per line) is
      // forbidden here. We only emit \x1b[<n>A once and \x1b[K per line.
      expect(out).not.toMatch(/\x1b\[2J/);
      expect(out).not.toMatch(/\x1b\[1A\x1b\[2K/);
    });

    it("re-renders when an observable widget property changes", async () => {
      const a = new StubWidget("a", "Alpha");
      screen.mount(a);
      screen.start();
      await flush();
      stream.reset();

      // focused is observable on WidgetBase → toggling re-fires the autorun.
      a.blur();
      a.focus();
      await flush();

      expect(stream.chunks.length).toBeGreaterThan(0);
    });

    it("debounces multiple state changes within one tick into one frame", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      screen.start();
      await flush();
      stream.reset();

      // Three observable mutations in the same tick.
      runInAction(() => {
        a.blur();
        a.focus();
        b.handleFocus({ type: "focus" });
      });
      await flush();

      // queueMicrotask coalesces: one write, not three.
      expect(stream.chunks.length).toBe(1);
    });

    it("shrinking frame clears trailing lines", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      const c = new StubWidget("c", "Gamma");
      screen.mount(a, b, c);
      screen.start();
      await flush();
      stream.reset();

      screen.unmount(c);
      await flush();
      const out = stream.joined();
      // After shrinking 3→2 lines, drawCount = 3, so we still emit \x1b[K
      // for the third (now-empty) line to wipe it.
      const eraseCount = (out.match(/\x1b\[K/g) ?? []).length;
      expect(eraseCount).toBeGreaterThanOrEqual(3);
    });

    it("hidden widgets occupy zero rows", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      runInAction(() => {
        a.visible = false;
      });
      screen.start();
      await flush();
      const out = stream.joined();
      expect(out).not.toContain("Alpha");
      expect(out).toContain("Beta");
    });
  });

  describe("layout / bounds", () => {
    it("assigns bounds to each widget at draw time", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      expect(a.bounds).toBeNull();
      screen.start();
      await flush();

      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      // "Alpha" with prefix "*" focused → 6 cells → b is at y=1
      expect(b.bounds).toEqual({ x: 0, y: 1, width: 5, height: 1 });
    });

    it("hidden widgets get zero-size bounds", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      runInAction(() => {
        a.visible = false;
      });
      screen.start();
      await flush();
      expect(a.bounds).toEqual({ x: 0, y: 0, width: 0, height: 0 });
      // b should now sit at y=0 since a took zero rows.
      expect(b.bounds).toEqual({ x: 0, y: 0, width: 5, height: 1 });
    });
  });

  describe("cursor management", () => {
    it("emits hide-cursor on start when manageCursor is true", () => {
      const stream2 = new CapturingStream();
      const s = new DefaultScreen({
        out: stream2,
        width: 40,
        colorSystem: null,
        manageCursor: true,
      });
      s.start();
      expect(stream2.joined()).toContain("\x1b[?25l");
      s.stop();
    });

    it("emits show-cursor on stop when manageCursor is true", () => {
      const stream2 = new CapturingStream();
      const s = new DefaultScreen({
        out: stream2,
        width: 40,
        colorSystem: null,
        manageCursor: true,
      });
      s.start();
      stream2.reset();
      s.stop();
      expect(stream2.joined()).toContain("\x1b[?25h");
    });

    it("does not touch the cursor when manageCursor is false", () => {
      screen.start();
      screen.stop();
      expect(stream.joined()).not.toContain("\x1b[?25l");
      expect(stream.joined()).not.toContain("\x1b[?25h");
    });
  });

  it("stop after start with no widgets does not crash", () => {
    expect(() => {
      screen.start();
      screen.stop();
    }).not.toThrow();
  });

  describe("placements", () => {
    it("default placement (bare widget) flows vertically (back-compat)", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      screen.start();
      await flush();

      // Same as the existing flow test — bare mount() args still produce
      // the historical single-column layout.
      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(b.bounds).toEqual({ x: 0, y: 1, width: 5, height: 1 });
    });

    it("inline placement packs widget on the row of its predecessor", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, { widget: b, placement: { kind: "inline" } });
      screen.start();
      await flush();

      // a flows at (0, 0), width 6 (" Alpha" — first widget auto-focuses → "*Alpha").
      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      // b inlines: x = a.right + 1 cell gap = 7, y = 0.
      expect(b.bounds).toEqual({ x: 7, y: 0, width: 5, height: 1 });

      // Both widgets share the row; the rendered line should contain both
      // labels left-to-right with the gap between them.
      const out = stream.joined();
      expect(out).toMatch(/\*Alpha\s+ Beta/);
    });

    it("multiple inline placements pack onto the same row in order", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      const c = new StubWidget("c", "Gamma");
      screen.mount(
        a,
        { widget: b, placement: { kind: "inline" } },
        { widget: c, placement: { kind: "inline" } },
      );
      screen.start();
      await flush();

      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(b.bounds).toEqual({ x: 7, y: 0, width: 5, height: 1 });
      expect(c.bounds).toEqual({ x: 13, y: 0, width: 6, height: 1 });
    });

    it("a flow placement after inlines starts a new row", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      const c = new StubWidget("c", "Gamma");
      screen.mount(
        a,
        { widget: b, placement: { kind: "inline" } },
        c, // back to flow
      );
      screen.start();
      await flush();

      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(b.bounds).toEqual({ x: 7, y: 0, width: 5, height: 1 });
      // c flows at y=1 — directly below the inline row.
      expect(c.bounds).toEqual({ x: 0, y: 1, width: 6, height: 1 });
    });

    it("fixed placement anchors at absolute coords", async () => {
      const a = new StubWidget("a", "Alpha");
      const status = new StubWidget("s", "Status", false);
      screen.mount(a, { widget: status, placement: { kind: "fixed", x: 10, y: 5 } });
      screen.start();
      await flush();

      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(status.bounds).toEqual({ x: 10, y: 5, width: 7, height: 1 });

      // Frame extends to row 5 (the fixed item's y); intermediate rows are
      // padded blanks. The total line count should be 6.
      // (2 chunks: cursor positioning + content. Lines after the cursor-up
      // are all separated by \n, so we can count newlines + 1.)
      const out = stream.joined();
      // The "Status" string lives at column 10 of the 6th line.
      // Easier check: it must appear in the output.
      expect(out).toContain(" Status");
    });

    it("fixed placement does not advance the flow cursor", async () => {
      const a = new StubWidget("a", "Alpha");
      const fixed = new StubWidget("f", "Fixed", false);
      const b = new StubWidget("b", "Beta");
      screen.mount(
        a,
        { widget: fixed, placement: { kind: "fixed", x: 20, y: 10 } },
        b,
      );
      screen.start();
      await flush();

      // a at (0, 0), fixed at (20, 10) — but b still flows at y=1
      // (immediately after a), independent of the fixed item.
      expect(a.bounds).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(fixed.bounds).toEqual({ x: 20, y: 10, width: 6, height: 1 });
      expect(b.bounds).toEqual({ x: 0, y: 1, width: 5, height: 1 });
    });

    it("fixed placement is hit-testable at its absolute coords", async () => {
      const fixed = new StubWidget("f", "Fixed", false);
      screen.mount({ widget: fixed, placement: { kind: "fixed", x: 12, y: 7 } });
      screen.start();
      await flush();

      // " Fixed" is 6 cells wide; bounds x=12, width=6 → covers cols 12..17.
      expect(fixed.containsPoint(12, 7)).toBe(true);
      expect(fixed.containsPoint(17, 7)).toBe(true);
      expect(fixed.containsPoint(18, 7)).toBe(false);
      expect(fixed.containsPoint(11, 7)).toBe(false);
      expect(fixed.containsPoint(15, 6)).toBe(false);
    });
  });

  it("does not draw after stop", async () => {
    const a = new StubWidget("a", "Alpha");
    screen.mount(a);
    screen.start();
    await flush();
    screen.stop();
    stream.reset();

    a.blur();
    a.focus();
    await flush();
    expect(stream.chunks).toHaveLength(0);
  });
});
