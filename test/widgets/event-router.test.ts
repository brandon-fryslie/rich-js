import { describe, it, expect, beforeEach } from "vitest";
import { PassThrough, Writable } from "stream";
import { runInAction } from "mobx";
import { Segment } from "../../src/core/segment.js";
import type { RenderOptions } from "../../src/index.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { EventRouter } from "../../src/widgets/event-router.js";
import type {
  KeyEvent,
  WidgetMouseEvent,
  WidgetBounds,
  Screen,
  InteractiveWidget,
} from "../../src/widgets/types.js";

class StubWidget extends WidgetBase {
  keyEvents: KeyEvent[] = [];
  mouseEvents: WidgetMouseEvent[] = [];
  hoverChanges: boolean[] = [];

  constructor(
    readonly id: string,
    readonly focusable: boolean = true,
  ) {
    super();
  }

  setBounds(b: WidgetBounds): void {
    runInAction(() => {
      this.bounds = b;
    });
  }

  setHovered(value: boolean): void {
    runInAction(() => {
      this.hovered = value;
    });
    this.hoverChanges.push(value);
  }

  override handleKey(event: KeyEvent): void {
    this.keyEvents.push(event);
  }

  override handleMouse(event: WidgetMouseEvent): void {
    this.mouseEvents.push(event);
  }

  render(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(this.id)];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: this.id.length, maximum: this.id.length };
  }
}

class CapturingStream extends Writable {
  chunks: string[] = [];
  isTTY = false;

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
}

interface Harness {
  router: EventRouter;
  stdin: PassThrough;
  stdout: CapturingStream;
  fm: DefaultFocusManager;
  widgets: StubWidget[];
  screen: Screen;
  keyEvents: KeyEvent[];
  mouseEvents: WidgetMouseEvent[];
  setWidgets: (widgets: StubWidget[]) => void;
}

function makeHarness(initial: StubWidget[] = []): Harness {
  const stdin = new PassThrough();
  const stdout = new CapturingStream();
  const fm = new DefaultFocusManager();
  let widgets = initial;
  for (const w of widgets) fm.register(w);

  const screen: Screen = {
    mount: () => {},
    unmount: () => {},
    start: () => {},
    stop: () => {},
    focusManager: fm,
    running: true,
    get widgets(): readonly InteractiveWidget[] {
      return widgets;
    },
  } as Screen & { widgets: readonly InteractiveWidget[] };

  const router = new EventRouter({
    screen,
    input: stdin as unknown as NodeJS.ReadableStream & { isTTY?: boolean },
    output: stdout,
    manageMouse: false,
    manageRawMode: false,
  });

  const keyEvents: KeyEvent[] = [];
  const mouseEvents: WidgetMouseEvent[] = [];
  router.onKey((e) => keyEvents.push(e));
  router.onMouse((e) => mouseEvents.push(e));

  return {
    router,
    stdin,
    stdout,
    fm,
    widgets,
    screen,
    keyEvents,
    mouseEvents,
    setWidgets: (next) => {
      widgets = next;
      for (const w of next) fm.register(w);
    },
  };
}

describe("EventRouter — key parsing", () => {
  let h: Harness;

  beforeEach(() => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    h = makeHarness([a, b]);
  });

  it("parses a printable character into a key event", () => {
    h.router.feed("x");
    expect(h.keyEvents).toEqual([
      { key: "x", character: "x", shift: false, ctrl: false, meta: false },
    ]);
  });

  it("dispatches printable keys to the focused widget", () => {
    h.router.feed("z");
    expect(h.widgets[0]!.keyEvents).toHaveLength(1);
    expect(h.widgets[0]!.keyEvents[0]!.character).toBe("z");
    expect(h.widgets[1]!.keyEvents).toHaveLength(0);
  });

  it("emits ctrl=true for control bytes", () => {
    h.router.feed("\x01"); // Ctrl+A
    expect(h.keyEvents[0]).toMatchObject({ key: "a", ctrl: true });
  });

  it("emits Ctrl+C as { key:'c', ctrl:true } without swallowing", () => {
    h.router.feed("\x03");
    expect(h.keyEvents[0]).toEqual({
      key: "c",
      character: "",
      ctrl: true,
      shift: false,
      meta: false,
    });
    // Caller (focused widget) still receives it — router does not exit.
    expect(h.widgets[0]!.keyEvents[0]).toMatchObject({ key: "c", ctrl: true });
  });

  it("recognises enter, tab, backspace, space", () => {
    h.router.feed("\r");
    h.router.feed("\n");
    h.router.feed("\t");
    h.router.feed("\x7f");
    h.router.feed(" ");
    expect(h.keyEvents.map((e) => e.key)).toEqual([
      "enter",
      "enter",
      "tab",
      "backspace",
      "space",
    ]);
  });

  it("recognises arrow keys via CSI", () => {
    h.router.feed("\x1b[A");
    h.router.feed("\x1b[B");
    h.router.feed("\x1b[C");
    h.router.feed("\x1b[D");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["up", "down", "right", "left"]);
  });

  it("recognises home/end/pageup/pagedown/delete via CSI tilde", () => {
    h.router.feed("\x1b[1~");
    h.router.feed("\x1b[3~");
    h.router.feed("\x1b[4~");
    h.router.feed("\x1b[5~");
    h.router.feed("\x1b[6~");
    expect(h.keyEvents.map((e) => e.key)).toEqual([
      "home",
      "delete",
      "end",
      "pageup",
      "pagedown",
    ]);
  });

  it("recognises F1–F12", () => {
    h.router.feed("\x1bOP"); // F1 via SS3
    h.router.feed("\x1b[15~"); // F5
    h.router.feed("\x1b[24~"); // F12
    expect(h.keyEvents.map((e) => e.key)).toEqual(["f1", "f5", "f12"]);
  });

  it("treats lone ESC as the escape key (after flush)", () => {
    h.router.feed("\x1b");
    expect(h.keyEvents).toHaveLength(0); // deferred
    h.router.flush();
    expect(h.keyEvents).toEqual([
      { key: "escape", character: "", shift: false, ctrl: false, meta: false },
    ]);
  });

  it("does not emit lone ESC when followed by a CSI sequence in a later chunk", () => {
    h.router.feed("\x1b");
    h.router.feed("[A");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["up"]);
  });

  it("collapses ESC ESC into a single escape event (consumes both bytes)", () => {
    h.router.feed("\x1b\x1b");
    // Both bytes consumed in one shot; no lone-ESC timer arms.
    expect(h.keyEvents).toEqual([
      { key: "escape", character: "", shift: false, ctrl: false, meta: false },
    ]);
    // Flushing is a no-op — buffer is empty, no second escape leaks out.
    h.router.flush();
    expect(h.keyEvents).toHaveLength(1);
  });

  it("handles a CSI sequence split across multiple chunks", () => {
    h.router.feed("\x1b[");
    h.router.feed("3");
    h.router.feed("~");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["delete"]);
  });
});

describe("EventRouter — tab navigation", () => {
  it("tab calls focusManager.next()", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const h = makeHarness([a, b]);
    expect(h.fm.current).toBe(a);
    h.router.feed("\t");
    expect(h.fm.current).toBe(b);
    h.router.feed("\t");
    expect(h.fm.current).toBe(a);
  });

  it("shift+tab (ESC[Z) calls focusManager.prev()", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const c = new StubWidget("c");
    const h = makeHarness([a, b, c]);
    expect(h.fm.current).toBe(a);
    h.router.feed("\x1b[Z");
    expect(h.fm.current).toBe(c);
  });

  it("does not deliver tab to the focused widget", () => {
    const a = new StubWidget("a");
    const h = makeHarness([a]);
    h.router.feed("\t");
    expect(a.keyEvents).toHaveLength(0);
  });
});

describe("EventRouter — mouse parsing", () => {
  it("parses SGR press / release", () => {
    const a = new StubWidget("a");
    a.setBounds({ x: 0, y: 0, width: 10, height: 1 });
    const h = makeHarness([a]);
    h.router.feed("\x1b[<0;5;1M"); // press at col 5 (0-based: 4), row 1 (0-based: 0)
    h.router.feed("\x1b[<0;5;1m"); // release
    expect(h.mouseEvents).toEqual([
      { type: "mouse_down", x: 4, y: 0, button: 0, shift: false, ctrl: false },
      { type: "mouse_up", x: 4, y: 0, button: 0, shift: false, ctrl: false },
    ]);
  });

  it("parses SGR motion", () => {
    const a = new StubWidget("a");
    a.setBounds({ x: 0, y: 0, width: 10, height: 1 });
    const h = makeHarness([a]);
    // cb=35 = 3 (release-any) + 32 (motion bit) = no-button motion
    h.router.feed("\x1b[<35;3;1M");
    expect(h.mouseEvents).toEqual([
      { type: "mouse_move", x: 2, y: 0, button: 3, shift: false, ctrl: false },
    ]);
  });

  it("parses SGR scroll wheel", () => {
    const h = makeHarness();
    h.router.feed("\x1b[<64;1;1M"); // scroll up
    h.router.feed("\x1b[<65;1;1M"); // scroll down
    expect(h.mouseEvents.map((e) => e.type)).toEqual(["scroll_up", "scroll_down"]);
  });

  it("parses X10 mouse fallback", () => {
    const h = makeHarness();
    // ESC [ M cb cx cy where each byte = value + 32 (1-based)
    // cb=32 (button 0 press), cx=33 (col 1), cy=33 (row 1) → x=0, y=0
    const buf = Buffer.from([0x1b, 0x5b, 0x4d, 32, 33, 33]);
    h.router.feed(buf);
    expect(h.mouseEvents).toEqual([
      { type: "mouse_down", x: 0, y: 0, button: 0, shift: false, ctrl: false },
    ]);
  });

  it("dispatches click to the topmost (last) widget under the pointer", () => {
    const lower = new StubWidget("lower");
    const upper = new StubWidget("upper");
    lower.setBounds({ x: 0, y: 0, width: 10, height: 3 });
    upper.setBounds({ x: 0, y: 0, width: 10, height: 3 });
    const h = makeHarness([lower, upper]);
    h.router.feed("\x1b[<0;3;2M");
    expect(upper.mouseEvents).toHaveLength(1);
    expect(lower.mouseEvents).toHaveLength(0);
  });

  it("does not dispatch to invisible widgets", () => {
    const a = new StubWidget("a");
    a.setBounds({ x: 0, y: 0, width: 10, height: 1 });
    runInAction(() => {
      a.visible = false;
    });
    const h = makeHarness([a]);
    h.router.feed("\x1b[<0;3;1M");
    expect(a.mouseEvents).toHaveLength(0);
  });
});

describe("EventRouter — mouse capture", () => {
  // After mouse_down on a widget, subsequent mouse_move and mouse_up events
  // are routed to that widget regardless of bounds, until release. This is
  // what makes Slider drag and Dropdown outside-click collapse work.

  it("routes mouse_move to the captured widget when pointer leaves bounds", () => {
    const a = new StubWidget("a");
    a.setBounds({ x: 0, y: 0, width: 5, height: 1 });
    const h = makeHarness([a]);

    h.router.feed("\x1b[<0;3;1M"); // mouse_down at (2,0) — inside a
    h.router.feed("\x1b[<32;20;1M"); // mouse_move at (19,0) — outside a (bit 32 = motion)
    h.router.feed("\x1b[<0;20;1m"); // mouse_up at (19,0) — outside a

    const types = a.mouseEvents.map((e) => e.type);
    expect(types).toEqual(["mouse_down", "mouse_move", "mouse_up"]);
  });

  it("releases capture on mouse_up so the next mouse_move is hit-tested again", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.setBounds({ x: 0, y: 0, width: 5, height: 1 });
    b.setBounds({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    // Press inside a → capture a, then release outside → capture cleared.
    h.router.feed("\x1b[<0;3;1M");
    h.router.feed("\x1b[<0;20;1m");

    // A subsequent move into b should go to b normally.
    h.router.feed("\x1b[<32;7;1M");
    const bTypes = b.mouseEvents.map((e) => e.type);
    expect(bTypes).toContain("mouse_move");
  });

  it("delivers click outside the dropdown's bounds when capture seeded a press inside", () => {
    // Simulates the Dropdown outside-click-collapse pattern: a press starts
    // inside the expanded list, the user drags out and releases — capture
    // ensures the dropdown still receives mouse_up to act on the gesture.
    const dd = new StubWidget("dd");
    dd.setBounds({ x: 0, y: 0, width: 10, height: 5 });
    const h = makeHarness([dd]);

    h.router.feed("\x1b[<0;3;1M"); // press inside
    h.router.feed("\x1b[<0;20;10m"); // release way outside

    expect(dd.mouseEvents.map((e) => e.type)).toEqual(["mouse_down", "mouse_up"]);
  });

  it("dispatches mouse_down by hit-test when no capture exists (capture seeded for the new gesture)", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.setBounds({ x: 0, y: 0, width: 5, height: 1 });
    b.setBounds({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    // First gesture: press in a, release in a.
    h.router.feed("\x1b[<0;3;1M");
    h.router.feed("\x1b[<0;3;1m");

    // Second gesture: press in b. With capture cleared, b receives it.
    h.router.feed("\x1b[<0;7;1M");
    expect(b.mouseEvents.map((e) => e.type)).toContain("mouse_down");
  });
});

describe("EventRouter — hover dispatch", () => {
  it("sets hovered=true when mouse enters bounds and false when it leaves", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    a.setBounds({ x: 0, y: 0, width: 5, height: 1 });
    b.setBounds({ x: 5, y: 0, width: 5, height: 1 });
    const h = makeHarness([a, b]);

    // Move into a — only a should change to hovered=true
    h.router.feed("\x1b[<35;2;1M");
    expect(a.hovered).toBe(true);
    expect(b.hovered).toBe(false);

    // Move from a into b — both change
    h.router.feed("\x1b[<35;7;1M");
    expect(a.hovered).toBe(false);
    expect(b.hovered).toBe(true);

    // Move outside both
    h.router.feed("\x1b[<35;20;1M");
    expect(a.hovered).toBe(false);
    expect(b.hovered).toBe(false);
  });

  it("does not call setHovered when state is unchanged", () => {
    const a = new StubWidget("a");
    a.setBounds({ x: 0, y: 0, width: 10, height: 1 });
    const h = makeHarness([a]);

    h.router.feed("\x1b[<35;2;1M");
    h.router.feed("\x1b[<35;3;1M");
    h.router.feed("\x1b[<35;4;1M");
    // All three moves are inside a → only the first transition should record.
    expect(a.hoverChanges).toEqual([true]);
  });
});

describe("EventRouter — start/stop", () => {
  it("attaches a data listener on start and detaches on stop", () => {
    const stdin = new PassThrough();
    const stdout = new CapturingStream();
    const fm = new DefaultFocusManager();
    const a = new StubWidget("a");
    fm.register(a);
    const screen: Screen = {
      mount: () => {},
      unmount: () => {},
      start: () => {},
      stop: () => {},
      focusManager: fm,
      running: true,
      get widgets(): readonly InteractiveWidget[] {
        return [a];
      },
    } as Screen & { widgets: readonly InteractiveWidget[] };

    const router = new EventRouter({
      screen,
      input: stdin as unknown as NodeJS.ReadableStream,
      output: stdout,
      manageMouse: false,
      manageRawMode: false,
    });

    router.start();
    expect(stdin.listenerCount("data")).toBe(1);
    stdin.write("x");
    // Microtask: PassThrough delivers synchronously after .write here
    expect(a.keyEvents).toHaveLength(1);

    router.stop();
    expect(stdin.listenerCount("data")).toBe(0);
  });

  it("writes mouse-tracking sequences when manageMouse is true", () => {
    const stdin = new PassThrough();
    const stdout = new CapturingStream();
    const fm = new DefaultFocusManager();
    const screen: Screen = {
      mount: () => {},
      unmount: () => {},
      start: () => {},
      stop: () => {},
      focusManager: fm,
      running: true,
      get widgets(): readonly InteractiveWidget[] {
        return [];
      },
    } as Screen & { widgets: readonly InteractiveWidget[] };

    const router = new EventRouter({
      screen,
      input: stdin as unknown as NodeJS.ReadableStream,
      output: stdout,
      manageMouse: true,
      manageRawMode: false,
    });

    router.start();
    expect(stdout.joined()).toContain("\x1b[?1006h");
    expect(stdout.joined()).toContain("\x1b[?1000h");
    router.stop();
    expect(stdout.joined()).toContain("\x1b[?1000l");
    expect(stdout.joined()).toContain("\x1b[?1006l");
  });

  it("is idempotent — repeated start() / stop() are safe", () => {
    const h = makeHarness();
    h.router.start();
    h.router.start();
    h.router.stop();
    h.router.stop();
    // No throw, no extra listeners.
    expect(h.stdin.listenerCount("data")).toBe(0);
  });
});
