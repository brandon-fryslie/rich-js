/**
 * BrowserTerminalHost — adapter over xterm.js's `Terminal` surface.
 *
 * [LAW:behavior-not-structure] Tests assert the TerminalHost contract
 * (subscribe / fan-out / unsubscribe / size / lifecycle), not the
 * specific calls the implementation makes. The fake terminal is a
 * test-rig — every observable behavior callers depend on flows through
 * its hooks.
 *
 * [LAW:locality-or-seam] The fake `XtermTerminal` is the same seam the
 * host depends on — declared by shape, not by importing xterm.js. Tests
 * never need an xterm.js dev-dep; the contract is the type, the type is
 * the program.
 */

import { describe, it, expect, beforeEach } from "vitest";
import {
  BrowserTerminalHost,
  type XtermTerminal,
  type XtermDisposable,
  type XtermResizeEvent,
  type TerminalSize,
} from "../../src/widgets/terminal-host.js";

// ---------------------------------------------------------------------------
// FakeXtermTerminal — a hand-built `XtermTerminal` for contract testing.
//
// Mirrors xterm.js's `onData(string)` and `onResize({cols, rows})` shape.
// Exposes `emitData` / `setSize` so tests can drive the host from outside
// the way a real xterm.js terminal would when a user types or the
// browser resizes.
// ---------------------------------------------------------------------------
class FakeXtermTerminal implements XtermTerminal {
  cols: number;
  rows: number;
  written: Array<Uint8Array | string> = [];
  private dataHandlers = new Set<(data: string) => void>();
  private resizeHandlers = new Set<(size: XtermResizeEvent) => void>();

  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
  }

  write(data: Uint8Array | string): void {
    this.written.push(data);
  }

  onData(handler: (data: string) => void): XtermDisposable {
    this.dataHandlers.add(handler);
    return { dispose: () => this.dataHandlers.delete(handler) };
  }

  onResize(handler: (size: XtermResizeEvent) => void): XtermDisposable {
    this.resizeHandlers.add(handler);
    return { dispose: () => this.resizeHandlers.delete(handler) };
  }

  emitData(data: string): void {
    for (const h of this.dataHandlers) h(data);
  }

  setSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    for (const h of this.resizeHandlers) h({ cols, rows });
  }

  get dataHandlerCount(): number {
    return this.dataHandlers.size;
  }

  get resizeHandlerCount(): number {
    return this.resizeHandlers.size;
  }
}

describe("BrowserTerminalHost", () => {
  let term: FakeXtermTerminal;
  let host: BrowserTerminalHost;

  beforeEach(() => {
    term = new FakeXtermTerminal(80, 24);
    host = new BrowserTerminalHost({ terminal: term });
  });

  describe("static surface", () => {
    it("reports isTTY = true (xterm.js is always interactive)", () => {
      expect(host.isTTY).toBe(true);
    });

    it("write() forwards verbatim to the terminal", () => {
      host.write("hello");
      host.write(new Uint8Array([0x1b, 0x5b, 0x4b]));
      expect(term.written).toEqual(["hello", new Uint8Array([0x1b, 0x5b, 0x4b])]);
    });

    it("size() reflects the current terminal dimensions", () => {
      expect(host.size()).toEqual({ cols: 80, rows: 24 });
      term.cols = 120;
      term.rows = 30;
      expect(host.size()).toEqual({ cols: 120, rows: 30 });
    });

    it("setRawMode is a no-op (xterm.js delivers raw by default)", () => {
      host.setRawMode(true);
      host.setRawMode(false);
      // No state to observe — the assertion is that no method throws and
      // no underlying terminal call was made.
      expect(term.written).toEqual([]);
    });

    it("start() is a no-op — the caller owns the terminal's DOM lifecycle", () => {
      host.start();
      host.start();
      expect(term.written).toEqual([]);
      expect(term.dataHandlerCount).toBe(0);
      expect(term.resizeHandlerCount).toBe(0);
    });
  });

  describe("onData", () => {
    it("delivers terminal-emitted data to a subscriber", () => {
      const received: Array<Uint8Array | string> = [];
      host.onData((chunk) => received.push(chunk));
      term.emitData("a");
      term.emitData("bc");
      expect(received).toEqual(["a", "bc"]);
    });

    it("fans out one terminal emission to every subscriber", () => {
      const a: string[] = [];
      const b: string[] = [];
      host.onData((c) => a.push(c as string));
      host.onData((c) => b.push(c as string));
      term.emitData("x");
      expect(a).toEqual(["x"]);
      expect(b).toEqual(["x"]);
    });

    it("attaches exactly one underlying terminal listener regardless of subscriber count", () => {
      host.onData(() => {});
      host.onData(() => {});
      host.onData(() => {});
      expect(term.dataHandlerCount).toBe(1);
    });

    it("unsubscribe detaches only that subscriber; others keep receiving", () => {
      const a: string[] = [];
      const b: string[] = [];
      const stopA = host.onData((c) => a.push(c as string));
      host.onData((c) => b.push(c as string));
      stopA();
      term.emitData("y");
      expect(a).toEqual([]);
      expect(b).toEqual(["y"]);
      // Underlying listener still attached because `b` is still subscribed.
      expect(term.dataHandlerCount).toBe(1);
    });

    it("dropping the last subscriber disposes the underlying listener", () => {
      const stop = host.onData(() => {});
      expect(term.dataHandlerCount).toBe(1);
      stop();
      expect(term.dataHandlerCount).toBe(0);
    });

    it("re-subscribing after the last unsubscribe re-attaches the underlying listener", () => {
      const stop1 = host.onData(() => {});
      stop1();
      expect(term.dataHandlerCount).toBe(0);
      const received: string[] = [];
      host.onData((c) => received.push(c as string));
      expect(term.dataHandlerCount).toBe(1);
      term.emitData("z");
      expect(received).toEqual(["z"]);
    });
  });

  describe("onResize", () => {
    it("delivers a snapshot of the new size to subscribers", () => {
      const sizes: TerminalSize[] = [];
      host.onResize((s) => sizes.push(s));
      term.setSize(100, 40);
      expect(sizes).toEqual([{ cols: 100, rows: 40 }]);
    });

    it("fans out a single resize event to every subscriber", () => {
      const a: TerminalSize[] = [];
      const b: TerminalSize[] = [];
      host.onResize((s) => a.push(s));
      host.onResize((s) => b.push(s));
      term.setSize(50, 20);
      expect(a).toEqual([{ cols: 50, rows: 20 }]);
      expect(b).toEqual([{ cols: 50, rows: 20 }]);
    });

    it("attaches exactly one underlying resize listener regardless of subscriber count", () => {
      host.onResize(() => {});
      host.onResize(() => {});
      expect(term.resizeHandlerCount).toBe(1);
    });

    it("delivers value-equivalent snapshots to every subscriber", () => {
      // [LAW:behavior-not-structure] The contract is "every subscriber
      // observes the same size value at the moment of the event." Whether
      // the host hands out one shared object or N fresh ones is an
      // implementation detail — asserting that with `toBe` would lock in
      // the current shape and break a legitimate future change to either
      // strategy. Value-equivalence is what callers actually depend on.
      const a: TerminalSize[] = [];
      const b: TerminalSize[] = [];
      host.onResize((s) => a.push(s));
      host.onResize((s) => b.push(s));
      term.setSize(70, 22);
      expect(a).toEqual([{ cols: 70, rows: 22 }]);
      expect(b).toEqual([{ cols: 70, rows: 22 }]);
    });

    it("`TerminalSize` fields are statically `readonly` — mutation is a compile error", () => {
      // [LAW:types-are-the-program] The mutation-isolation invariant
      // lives in the type, not in a runtime guard or `Object.freeze`.
      // The two `@ts-expect-error` directives below ARE the assertion:
      // they require the next line to fail type-checking. If `readonly`
      // is ever removed from `TerminalSize`, the assignments type-check
      // and the directives themselves become compile errors — `npm run
      // lint` fails, surfacing the regression before runtime.
      //
      // (No runtime expect is meaningful here: `readonly` is purely a
      // TypeScript-time constraint; the runtime assignments still
      // mutate the object. The test exists to bind the type-level
      // contract into a place that is checked on every lint run.)
      const s: TerminalSize = { cols: 1, rows: 1 };
      // @ts-expect-error — TerminalSize.cols is readonly
      s.cols = 2;
      // @ts-expect-error — TerminalSize.rows is readonly
      s.rows = 2;
      expect(s).toBeDefined();
    });

    it("unsubscribe stops further events for that subscriber", () => {
      const seen: TerminalSize[] = [];
      const stop = host.onResize((s) => seen.push(s));
      stop();
      term.setSize(60, 18);
      expect(seen).toEqual([]);
      expect(term.resizeHandlerCount).toBe(0);
    });
  });

  describe("stop / restart", () => {
    it("stop() disposes underlying subscriptions and clears handler sets", () => {
      const data: string[] = [];
      const resize: TerminalSize[] = [];
      host.onData((c) => data.push(c as string));
      host.onResize((s) => resize.push(s));
      expect(term.dataHandlerCount).toBe(1);
      expect(term.resizeHandlerCount).toBe(1);

      host.stop();
      expect(term.dataHandlerCount).toBe(0);
      expect(term.resizeHandlerCount).toBe(0);

      // Events after stop reach nobody (handlers cleared, listeners detached).
      term.emitData("ignored");
      term.setSize(10, 10);
      expect(data).toEqual([]);
      expect(resize).toEqual([]);
    });

    it("stop() is idempotent — calling twice is safe", () => {
      host.onData(() => {});
      host.stop();
      expect(() => host.stop()).not.toThrow();
    });

    it("the terminal stays usable for re-subscription after stop()", () => {
      host.onData(() => {});
      host.stop();
      const received: string[] = [];
      host.onData((c) => received.push(c as string));
      term.emitData("after-restart");
      expect(received).toEqual(["after-restart"]);
      expect(term.dataHandlerCount).toBe(1);
    });

    it("write() continues to work after stop() — the terminal is not disposed", () => {
      host.stop();
      host.write("still-writable");
      expect(term.written).toEqual(["still-writable"]);
    });
  });

  describe("structural typing — TerminalHost contract", () => {
    it("BrowserTerminalHost is assignable to TerminalHost", () => {
      // [LAW:types-are-the-program] Compile-time check via assignment. If
      // BrowserTerminalHost ever drifts from the TerminalHost contract,
      // this line stops type-checking — no runtime assertion needed.
      const asHost: import("../../src/widgets/terminal-host.js").TerminalHost = host;
      expect(asHost.isTTY).toBe(true);
    });
  });
});
