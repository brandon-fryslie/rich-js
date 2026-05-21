/**
 * Contract tests for the interactive OKLCH theme explorer.
 *
 * The explorer's logic is pure (`reduce`, `renderFrame`, `previewCells`), so
 * its contract is machine-verifiable without a terminal. [LAW:verifiable-goals]
 * The user-facing promises pinned here:
 *   1. The left column lists every theme; the selected one is marked.
 *   2. Selecting a theme leaves the transposition controls untouched.
 *   3. Every preview cell clears the contrast floor (no dark-on-dark).
 *   4. The full key→state→repaint loop works through real stdin parsing.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PassThrough, Writable } from "stream";
import { runInAction, makeAutoObservable } from "mobx";
import { DefaultScreen } from "../../src/widgets/screen.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { EventRouter } from "../../src/widgets/event-router.js";
import { StaticItem } from "../../src/widgets/static-item.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import { contrastRatio, contrastFor } from "../../src/themes/colorMath.js";
import {
  THEME_NAMES,
  TONIC_VARS,
  CONTROLS,
  initialState,
  reduce,
  previewCells,
  sampleCell,
  themeWindow,
  renderFrame,
  framesToSegments,
  type ExplorerState,
  type KeyInput,
} from "../../examples/rich-themes-transposed/model.js";

function k(key: string, shift = false): KeyInput {
  return { key, character: "", shift };
}
function ch(character: string): KeyInput {
  return { key: "", character, shift: false };
}

function plainOf(state: ExplorerState, height = 30): string {
  return framesToSegments(renderFrame(state, 120, height))
    .map((s) => s.text)
    .join("");
}

describe("explorer model — reducer", () => {
  it("down/up move the theme selection and wrap", () => {
    const s0 = initialState();
    expect(reduce(s0, k("down")).themeIndex).toBe(1);
    expect(reduce(s0, k("up")).themeIndex).toBe(THEME_NAMES.length - 1);
  });

  it("changing the theme preserves every orthogonal control", () => {
    // Set up a non-default control state, then flip the theme twice.
    let s = initialState();
    s = { ...s, focusedControl: "chroma" };
    s = reduce(s, k("right")); // bump chroma
    s = reduce(s, k("right"));
    s = { ...s, focusedControl: "lightness" };
    s = reduce(s, k("left")); // drop lightness
    const before = s;
    const after = reduce(reduce(before, k("down")), k("down"));
    expect(after.themeIndex).not.toBe(before.themeIndex);
    // Everything except themeIndex is byte-identical.
    expect(after.chromaScale).toBe(before.chromaScale);
    expect(after.lightnessShift).toBe(before.lightnessShift);
    expect(after.rootHue).toBe(before.rootHue);
    expect(after.minContrast).toBe(before.minContrast);
    expect(after.tonicIndex).toBe(before.tonicIndex);
    expect(after.focusedControl).toBe(before.focusedControl);
  });

  it("tab cycles the focused control forward; shift+tab backward", () => {
    const s0 = { ...initialState(), focusedControl: CONTROLS[0]! };
    expect(reduce(s0, k("tab")).focusedControl).toBe(CONTROLS[1]);
    expect(reduce(s0, k("tab", true)).focusedControl).toBe(
      CONTROLS[CONTROLS.length - 1],
    );
  });

  it("left/right adjust the focused control and clamp/wrap", () => {
    // chroma clamps at 0 from below.
    let s = { ...initialState(), focusedControl: "chroma" as const, chromaScale: 0.02 };
    expect(reduce(s, k("left")).chromaScale).toBe(0);
    // rootHue wraps modulo 360.
    s = { ...initialState(), focusedControl: "rootHue" as const, rootHue: 2 };
    expect(reduce(s, k("left")).rootHue).toBeGreaterThan(300);
  });

  it("tonic control cycles through the tonic vars", () => {
    const s = { ...initialState(), focusedControl: "tonic" as const, tonicIndex: 0 };
    expect(reduce(s, k("right")).tonicIndex).toBe(1);
    expect(reduce(s, k("left")).tonicIndex).toBe(TONIC_VARS.length - 1);
  });

  it("r resets the transposition but keeps the contrast knob and theme", () => {
    let s = initialState();
    s = { ...s, focusedControl: "chroma", themeIndex: 3, minContrast: 6 };
    s = reduce(s, k("right")); // chroma off identity
    const reset = reduce(s, ch("r"));
    expect(reset.chromaScale).toBe(1);
    expect(reset.lightnessShift).toBe(0);
    expect(reset.themeIndex).toBe(3); // theme not reset
    expect(reset.minContrast).toBe(6); // contrast knob not reset
  });

  it("unknown keys are a no-op", () => {
    const s0 = initialState();
    expect(reduce(s0, ch("z"))).toBe(s0);
  });
});

describe("explorer model — themeWindow", () => {
  it("returns the whole range when it fits", () => {
    expect(themeWindow(10, 3, 20)).toEqual({ start: 0, end: 10 });
  });

  it("keeps the selected index inside the window when scrolling", () => {
    const { start, end } = themeWindow(40, 35, 10);
    expect(35).toBeGreaterThanOrEqual(start);
    expect(35).toBeLessThan(end);
    expect(end - start).toBe(10);
  });

  it("clamps the window at the top and bottom edges", () => {
    expect(themeWindow(40, 0, 10).start).toBe(0);
    expect(themeWindow(40, 39, 10).end).toBe(40);
  });
});

describe("explorer model — frame", () => {
  it("lists every theme in the left column", () => {
    const text = plainOf(initialState(), 40); // tall enough for all 22
    for (const name of THEME_NAMES) expect(text).toContain(name);
  });

  it("marks exactly the selected theme with the ▸ cursor", () => {
    const s = reduce(reduce(initialState(), k("down")), k("down"));
    const text = plainOf(s, 40);
    expect(text).toContain(`▸ ${THEME_NAMES[2]}`);
    expect(text).not.toContain(`▸ ${THEME_NAMES[0]}`);
    expect(text).not.toContain(`▸ ${THEME_NAMES[1]}`);
  });

  it("shows a contrast readout for the sample line", () => {
    expect(plainOf(initialState())).toMatch(/\d+\.\d+:1/);
  });
});

describe("explorer model — readability invariant", () => {
  it("every preview cell clears min(target, best-possible) across a state sweep", () => {
    const bestPossible = (bg: import("../../src/core/color.js").ColorRgba) =>
      contrastRatio(contrastFor(bg), bg);
    let checked = 0;
    for (let ti = 0; ti < THEME_NAMES.length; ti++) {
      for (const rootHue of [0, 120, 240]) {
        for (const lightnessShift of [-0.4, 0, 0.4]) {
          const s: ExplorerState = {
            ...initialState(),
            themeIndex: ti,
            rootHue,
            chromaScale: 1.3,
            lightnessShift,
            minContrast: 4.5,
          };
          for (const cell of [...previewCells(s), sampleCell(s)]) {
            checked++;
            const got = contrastRatio(cell.fg, cell.bg);
            const need = Math.min(s.minContrast, bestPossible(cell.bg)) - 1e-6;
            expect(got).toBeGreaterThanOrEqual(need);
          }
        }
      }
    }
    expect(checked).toBeGreaterThan(1000);
  });
});

// ---------------------------------------------------------------------------
// End-to-end: real stdin bytes → EventRouter → state → Screen repaint.
// Mirrors the template-bindings demo-reactivity harness.
// ---------------------------------------------------------------------------

class CapturingStream extends Writable {
  chunks: string[] = [];
  isTTY = false;
  columns = 120;
  rows = 40;
  override _write(
    chunk: Buffer | string,
    _enc: BufferEncoding,
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

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

class Store {
  state: ExplorerState = initialState();
  constructor() {
    makeAutoObservable(this);
  }
  apply(input: KeyInput): void {
    this.state = reduce(this.state, input);
  }
}

describe("explorer — key → state → repaint loop", () => {
  let stdout: CapturingStream;
  let stdin: PassThrough;
  let screen: DefaultScreen;
  let router: EventRouter;
  let store: Store;

  beforeEach(() => {
    stdout = new CapturingStream();
    stdin = new PassThrough();
    store = new Store();

    screen = new DefaultScreen({
      out: stdout,
      width: 120,
      colorSystem: null, // strip ANSI so we assert on plain text
      manageCursor: false,
      focusManager: new DefaultFocusManager(),
    });
    router = new EventRouter({
      screen,
      input: stdin as unknown as NodeJS.ReadableStream & {
        setRawMode?: (raw: boolean) => unknown;
        isTTY?: boolean;
      },
      output: stdout,
      manageMouse: false,
      manageRawMode: false,
    });

    const frame = new StaticItem({
      id: "frame",
      render: (opts: RenderOptions) =>
        framesToSegments(renderFrame(store.state, opts.maxWidth, 40)),
    });
    screen.mount(frame);

    router.onKey(
      (event) => {
        runInAction(() => {
          store.apply({ key: event.key, character: event.character, shift: event.shift });
        });
      },
      { priority: "high" },
    );
  });

  afterEach(() => {
    router.stop();
    screen.stop();
  });

  it("first frame highlights the initial theme", async () => {
    screen.start();
    router.start();
    await flush();
    expect(stdout.joined()).toContain(`▸ ${THEME_NAMES[0]}`);
  });

  it("a down-arrow byte advances the highlighted theme and repaints", async () => {
    screen.start();
    router.start();
    await flush();
    stdout.reset();

    stdin.write("\x1b[B"); // CSI B = down arrow
    await flush();

    expect(store.state.themeIndex).toBe(1);
    expect(stdout.joined()).toContain(`▸ ${THEME_NAMES[1]}`);
    expect(stdout.joined()).not.toContain(`▸ ${THEME_NAMES[0]}`);
  });
});
