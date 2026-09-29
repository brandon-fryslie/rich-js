import { describe, it, expect, beforeEach } from "vitest";
import { PassThrough, Writable } from "stream";
import { observable, runInAction } from "mobx";
import { Segment } from "../../src/core/segment.js";
import { ColorDepth } from "../../src/core/color.js";
import type { RenderOptions } from "../../src/index.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { DefaultScreen } from "../../src/widgets/screen.js";
import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { BrowserTerminalHost, type TerminalHost } from "../../src/host/terminal-host.js";
import { widgetAt } from "../../src/widgets/hit.js";
import type { InteractiveWidget, KeyEvent } from "../../src/widgets/types.js";

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
  protected draw(_options: RenderOptions): Iterable<Segment> {
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
  // [LAW:single-enforcer] Screen reaches I/O exclusively through the host;
  // tests build one that wraps the CapturingStream so writes land in
  // `stream.chunks` instead of going to process.stdout. stdin is unused
  // (Screen never reads input) — process.stdin is fine as a placeholder.
  const host = new NodeTerminalHost({
    stdout: stream,
  });
  const screen = new DefaultScreen({
    host,
    width: 40,
    colorSystem: null, // strip color codes — tests assert plain text
    manageCursor: false,
    focusManager: new DefaultFocusManager(),
  });
  return { screen, stream };
}

// The rectangle of the painted frame whose cells `widget` drew, or null when
// it drew none — where the screen put it, read the way the router reads it.
function rectOf(
  screen: DefaultScreen,
  widget: InteractiveWidget,
): { x: number; y: number; width: number; height: number } | null {
  const cells: { x: number; y: number }[] = [];
  screen.frame.forEach((line, y) => {
    const width = line.reduce((n, segment) => n + segment.cellLength, 0);
    for (let x = 0; x < width; x++) {
      if (widgetAt(screen.frame, x, y)?.widget === widget) cells.push({ x, y });
    }
  });
  if (cells.length === 0) return null;
  const xs = cells.map((c) => c.x);
  const ys = cells.map((c) => c.y);
  const x = Math.min(...xs);
  const y = Math.min(...ys);
  return { x, y, width: Math.max(...xs) - x + 1, height: Math.max(...ys) - y + 1 };
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

  it("mounts only a WidgetBase, the one kind of widget hit-testing can find", () => {
    const plain = {} as InteractiveWidget;
    // @ts-expect-error an InteractiveWidget not built on WidgetBase stamps no cells
    const mountPlain = (): void => screen.mount(plain);
    expect(mountPlain).toBeTypeOf("function");
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

    it("renders widgets at the depth it encodes the frame at", async () => {
      // A renderable that decides on drawn colours (the powerline seam) must
      // see the depth this screen draws, not an unset one read as truecolor.
      const seen: RenderOptions["colorSystem"][] = [];
      class DepthWidget extends StubWidget {
        override render(options: RenderOptions): Iterable<Segment> {
          seen.push(options.colorSystem);
          return super.render(options);
        }
      }
      const host = new NodeTerminalHost({
        stdout: new CapturingStream(),
      });
      const at256 = new DefaultScreen({
        host,
        width: 40,
        colorSystem: "256",
        manageCursor: false,
        focusManager: new DefaultFocusManager(),
      });
      at256.mount(new DepthWidget("d", "Depth"));
      at256.start();
      await flush();
      at256.stop();
      expect(seen.length).toBeGreaterThan(0);
      expect(new Set(seen)).toEqual(new Set([ColorDepth.EIGHT_BIT]));
    });

    it("under auto, draws at the depth its host's environment names", async () => {
      // The depth is the host's to state. Read off the ambient `process`
      // instead, a browser screen on xterm.js saw an unnamed TTY and drew
      // every colour at 16-colour depth.
      async function depthSeen(host: TerminalHost): Promise<RenderOptions["colorSystem"]> {
        const seen: RenderOptions["colorSystem"][] = [];
        class DepthWidget extends StubWidget {
          override render(options: RenderOptions): Iterable<Segment> {
            seen.push(options.colorSystem);
            return super.render(options);
          }
        }
        const s = new DefaultScreen({
          host,
          width: 40,
          manageCursor: false,
          focusManager: new DefaultFocusManager(),
        });
        s.mount(new DepthWidget("d", "Depth"));
        s.start();
        await flush();
        s.stop();
        expect(new Set(seen).size).toBe(1);
        return seen[0];
      }
      const xterm = {
        cols: 80,
        rows: 24,
        write: () => {},
        onData: () => ({ dispose: () => {} }),
        onResize: () => ({ dispose: () => {} }),
      };
      const tty = { isTTY: true };
      const node = (env: NodeJS.ProcessEnv): NodeTerminalHost =>
        new NodeTerminalHost({
          stdin: Object.assign(new PassThrough(), tty),
          stdout: Object.assign(new CapturingStream(), tty),
          env,
        });

      expect(await depthSeen(new BrowserTerminalHost({ terminal: xterm }))).toBe(
        ColorDepth.TRUECOLOR,
      );
      expect(await depthSeen(node({ NO_COLOR: "1" }))).toBeNull();
      expect(await depthSeen(node({ TERM: "xterm-256color" }))).toBe(ColorDepth.EIGHT_BIT);
    });

    it("first frame writes no cursor-up sequence", async () => {
      const a = new StubWidget("a", "Alpha");
      screen.mount(a);
      screen.start();
      await flush();
      // No \x1b[<n>A on the very first frame — there is nothing to move up to.
      expect(stream.joined()).not.toMatch(/\x1b\[\d+A/);
    });

    it("single-line frames emit no cursor-up on the next frame either", async () => {
      // [LAW:types-are-the-program] Some terminals treat `\x1b[0A` as one
      // row up — equivalent to no CSI but with a surprise off-by-one if the
      // frame was a single line. The redraw path skips the CSI when
      // lastLineCount ≤ 1; pin that here so the boundary case stays
      // covered.
      const a = new StubWidget("a", "Alpha");
      screen.mount(a);
      screen.start();
      await flush();

      stream.reset();
      // Force a re-render with state that changes between frames. blur
      // mutates `focused` (observable) so the autorun fires.
      screen.focusManager.blur();
      await flush();

      const out = stream.joined();
      expect(out).not.toMatch(/\x1b\[\d+A/);
      // The re-render still has to erase-to-end-of-line and write content.
      expect(out).toMatch(/\x1b\[K/);
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

  describe("layout", () => {
    it("paints each widget where its placement puts it", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      expect(rectOf(screen, a)).toBeNull();
      screen.start();
      await flush();

      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      // "Alpha" with prefix "*" focused → 6 cells → b is at y=1
      expect(rectOf(screen, b)).toEqual({ x: 0, y: 1, width: 5, height: 1 });
    });

    it("hidden widgets paint nothing and take no rows", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      runInAction(() => {
        a.visible = false;
      });
      screen.start();
      await flush();
      expect(rectOf(screen, a)).toBeNull();
      // b should now sit at y=0 since a took zero rows.
      expect(rectOf(screen, b)).toEqual({ x: 0, y: 0, width: 5, height: 1 });
    });
  });

  describe("overlay z-order", () => {
    // OverlayStub implements OverlayRenderable. `expanded` toggles whether
    // it contributes overlay rows; mutating it (via runInAction) triggers
    // the autorun. The overlay paints two rows below its inline footprint.
    class OverlayStub extends WidgetBase {
      // WidgetBase declares `focusable` abstract; this stub never did, so every
      // instance carried `undefined` where a boolean was required and read as
      // not-focusable everywhere it was tested. `false` states what was already
      // true — an overlay under z-order test takes no focus.
      readonly focusable = false;
      // Observable so toggling `expanded` after start() triggers the
      // autorun → recompute → draw cycle. Without observability the
      // OverlayStub would render the wrong way once and never recover.
      @observable accessor expanded: boolean = false;
      constructor(readonly id: string, readonly inline: string) {
        super();
      }
      setExpanded(value: boolean): void {
        runInAction(() => {
          this.expanded = value;
        });
      }
      handleKey(_event: KeyEvent): void {}
      protected draw(_options: RenderOptions): Iterable<Segment> {
        return [new Segment(this.inline)];
      }
      renderOverlay(_options: RenderOptions): Iterable<Segment> | null {
        if (!this.expanded) return null;
        return [
          new Segment(`${this.id}-row1`),
          new Segment("\n"),
          new Segment(`${this.id}-row2`),
        ];
      }
      measure(_options: RenderOptions): { minimum: number; maximum: number } {
        return { minimum: this.inline.length, maximum: this.inline.length };
      }
    }

    it("an overlay row is its owner's, at the row below its footprint", async () => {
      // A is mounted FIRST and its overlay covers B's row. Paint order is
      // z-order: the overlay pass runs last, so the frame names A there and
      // a click on the overlay reaches A, not B mounted underneath.
      const a = new OverlayStub("a", "AAA");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      a.setExpanded(true);
      screen.start();
      await flush();

      expect(widgetAt(screen.frame, 0, 0)).toEqual({ widget: a, col: 0, row: 0 });
      expect(widgetAt(screen.frame, 2, 1)).toEqual({ widget: a, col: 2, row: 1 });
      expect(widgetAt(screen.frame, 0, 2)).toEqual({ widget: a, col: 0, row: 2 });
    });

    it("collapsing the overlay hands its rows back to what lies beneath", async () => {
      const a = new OverlayStub("a", "AAA");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, b);
      a.setExpanded(true);
      screen.start();
      await flush();
      expect(widgetAt(screen.frame, 0, 1)?.widget).toBe(a);

      a.setExpanded(false);
      await flush();
      expect(widgetAt(screen.frame, 0, 1)).toEqual({ widget: b, col: 0, row: 0 });
    });
  });

  describe("cursor management", () => {
    it("emits hide-cursor on start when manageCursor is true", () => {
      const stream2 = new CapturingStream();
      const host2 = new NodeTerminalHost({ stdout: stream2 });
      const s = new DefaultScreen({
        host: host2,
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
      const host2 = new NodeTerminalHost({ stdout: stream2 });
      const s = new DefaultScreen({
        host: host2,
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
      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(rectOf(screen, b)).toEqual({ x: 0, y: 1, width: 5, height: 1 });
    });

    it("inline placement packs widget on the row of its predecessor", async () => {
      const a = new StubWidget("a", "Alpha");
      const b = new StubWidget("b", "Beta");
      screen.mount(a, { widget: b, placement: { kind: "inline" } });
      screen.start();
      await flush();

      // a flows at (0, 0), width 6 (" Alpha" — first widget auto-focuses → "*Alpha").
      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      // b inlines: x = a.right + 1 cell gap = 7, y = 0.
      expect(rectOf(screen, b)).toEqual({ x: 7, y: 0, width: 5, height: 1 });

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

      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(rectOf(screen, b)).toEqual({ x: 7, y: 0, width: 5, height: 1 });
      expect(rectOf(screen, c)).toEqual({ x: 13, y: 0, width: 6, height: 1 });
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

      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(rectOf(screen, b)).toEqual({ x: 7, y: 0, width: 5, height: 1 });
      // c flows at y=1 — directly below the inline row.
      expect(rectOf(screen, c)).toEqual({ x: 0, y: 1, width: 6, height: 1 });
    });

    it("rejects fixed placements with negative or non-integer coords", () => {
      // [LAW:types-are-the-program] mount is the trust boundary for
      // placements; negative or fractional coordinates would index out of
      // bounds in paintLines. Reject at construction so the layout pipeline
      // can assume non-negative integers everywhere downstream.
      const w = new StubWidget("w", "x");
      expect(() =>
        screen.mount({ widget: w, placement: { kind: "fixed", x: -1, y: 0 } }),
      ).toThrow(RangeError);
      expect(() =>
        screen.mount({ widget: w, placement: { kind: "fixed", x: 0, y: -3 } }),
      ).toThrow(RangeError);
      expect(() =>
        screen.mount({ widget: w, placement: { kind: "fixed", x: 1.5, y: 2 } }),
      ).toThrow(RangeError);
    });

    it("fixed placement anchors at absolute coords", async () => {
      const a = new StubWidget("a", "Alpha");
      const status = new StubWidget("s", "Status", false);
      screen.mount(a, { widget: status, placement: { kind: "fixed", x: 10, y: 5 } });
      screen.start();
      await flush();

      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(rectOf(screen, status)).toEqual({ x: 10, y: 5, width: 7, height: 1 });

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
      expect(rectOf(screen, a)).toEqual({ x: 0, y: 0, width: 6, height: 1 });
      expect(rectOf(screen, fixed)).toEqual({ x: 20, y: 10, width: 6, height: 1 });
      expect(rectOf(screen, b)).toEqual({ x: 0, y: 1, width: 5, height: 1 });
    });

    it("fixed placement is hit-testable at its absolute coords", async () => {
      const fixed = new StubWidget("f", "Fixed", false);
      screen.mount({ widget: fixed, placement: { kind: "fixed", x: 12, y: 7 } });
      screen.start();
      await flush();

      // " Fixed" is 6 cells wide at x=12 → covers cols 12..17.
      expect(widgetAt(screen.frame, 12, 7)).toEqual({ widget: fixed, col: 0, row: 0 });
      expect(widgetAt(screen.frame, 17, 7)).toEqual({ widget: fixed, col: 5, row: 0 });
      expect(widgetAt(screen.frame, 18, 7)).toBeUndefined();
      expect(widgetAt(screen.frame, 11, 7)).toBeUndefined();
      expect(widgetAt(screen.frame, 15, 6)).toBeUndefined();
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
