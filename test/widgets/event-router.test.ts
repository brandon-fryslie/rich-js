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
  // High priority: this is an "observe every key" hook for assertions. If
  // it sat at normal priority, FocusManager's Tab handler would stop the
  // event first and the observer would miss Tab events. Note this also
  // runs ahead of any user-level high-priority handlers registered later
  // by individual tests — fine for the few tests that need it, since
  // those tests don't rely on the observer for their assertions.
  router.onKey((e) => keyEvents.push(e), { priority: "high" });
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
    expect(h.keyEvents).toMatchObject([
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
    expect(h.keyEvents[0]).toMatchObject({
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

  it("emits Alt+letter for ESC + printable byte in a single chunk", () => {
    h.router.feed("\x1bb");
    expect(h.keyEvents).toMatchObject([
      { key: "b", character: "", shift: false, ctrl: false, meta: true },
    ]);
  });

  it("Alt+Backspace decodes ESC + 0x7f", () => {
    h.router.feed("\x1b\x7f");
    expect(h.keyEvents).toMatchObject([
      { key: "backspace", character: "", shift: false, ctrl: false, meta: true },
    ]);
  });

  it("Alt+uppercase carries shift=true", () => {
    h.router.feed("\x1bF");
    expect(h.keyEvents).toMatchObject([
      { key: "f", character: "", shift: true, ctrl: false, meta: true },
    ]);
  });

  it("treats lone ESC as the escape key (after flush)", () => {
    h.router.feed("\x1b");
    expect(h.keyEvents).toHaveLength(0); // deferred
    h.router.flush();
    expect(h.keyEvents).toMatchObject([
      { key: "escape", character: "", shift: false, ctrl: false, meta: false },
    ]);
  });

  it("does not emit lone ESC when followed by a CSI sequence in a later chunk", () => {
    h.router.feed("\x1b");
    h.router.feed("[A");
    expect(h.keyEvents.map((e) => e.key)).toEqual(["up"]);
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

  it("delivers tab to the focused widget; falls through to focus traversal when not stopped", () => {
    const a = new StubWidget("a");
    const b = new StubWidget("b");
    const h = makeHarness([a, b]);
    h.router.feed("\t");
    // StubWidget.handleKey does not call event.stop() → FocusManager (registered
    // as a normal-priority chain handler) runs and moves focus.
    expect(a.keyEvents).toHaveLength(1);
    expect(a.keyEvents[0]!.key).toBe("tab");
    expect(h.fm.current).toBe(b);
  });

  it("a widget that stops the tab event prevents focus traversal", () => {
    class TabConsumer extends StubWidget {
      override handleKey(event: KeyEvent): void {
        this.keyEvents.push(event);
        if (event.key === "tab") event.stop();
      }
    }
    const a = new TabConsumer("a");
    const b = new StubWidget("b");
    const h = makeHarness([a, b]);
    h.router.feed("\t");
    expect(h.fm.current).toBe(a); // focus did not move
  });

  it("a high-priority handler runs before the focused widget and can stop the event", () => {
    const a = new StubWidget("a");
    const h = makeHarness([a]);
    let highSawIt = false;
    h.router.onKey(
      (event) => {
        if (event.key === "c" && event.ctrl) {
          highSawIt = true;
          event.stop();
        }
      },
      { priority: "high" },
    );
    h.router.feed("\x03"); // Ctrl+C
    expect(highSawIt).toBe(true);
    // Focused widget never saw it because the high handler stopped the event.
    expect(a.keyEvents.find((e) => e.ctrl && e.key === "c")).toBeUndefined();
  });

  it("normal-priority handlers run after the focused widget", () => {
    const order: string[] = [];
    class Observer extends StubWidget {
      override handleKey(event: KeyEvent): void {
        super.handleKey(event);
        order.push("widget");
      }
    }
    const observed = new Observer("o");
    const h = makeHarness([observed]);
    h.router.onKey(() => order.push("normal")); // default priority = "normal"
    h.router.feed("x");
    expect(order).toEqual(["widget", "normal"]);
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
