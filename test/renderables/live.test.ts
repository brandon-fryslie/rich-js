import { afterEach, describe, expect, it, vi } from "vitest";
import { Console } from "../../src/core/console.js";
import { RichText } from "../../src/core/text.js";
import type { Renderable } from "../../src/core/protocol.js";
import { Live, type LiveOptions } from "../../src/renderables/live.js";

const SHOW_CURSOR = "\x1b[?25h";
const EXIT_ALT_SCREEN = "\x1b[0m\x1b[?1049l";

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

  it("the alternate screen's first good frame still clears the buffer after a failed one", () => {
    const { live: display, out } = live({ autoRefresh: false, altScreen: true });
    display.update(broken);
    display.start();
    expect(() => display.refresh()).toThrow(RenderFailed);

    display.update(new RichText("good"));
    const before = out().length;
    display.refresh();
    expect(out().slice(before)).toMatch(/^\x1b\[2J\x1b\[H/);
  });

  // What each mode writes to hand the terminal back.
  const modes = [
    ["inline", false, SHOW_CURSOR],
    ["on the alternate screen", true, SHOW_CURSOR + EXIT_ALT_SCREEN],
  ] as const;

  it.each(modes)(
    "an auto-refresh failure hands the terminal back before the error escapes %s",
    (_mode, altScreen, handBack) => {
      vi.useFakeTimers();
      const { live: display, out } = live({ altScreen, refreshPerSecond: 10 });
      display.start();
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
