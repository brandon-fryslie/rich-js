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
// Imported from the public surface on purpose: this also asserts the WCAG
// contrast toolkit is exported for downstream clients.
import { contrastRatio, contrastFor, Oklch } from "../../src/index.js";
import {
  THEME_NAMES,
  CONTROLS,
  initialState,
  reduce,
  previewCells,
  sampleCell,
  themeWindow,
  renderFrame,
  framesToSegments,
  appMock,
  renderShowcase,
  sourcePalette,
  transposedPalette,
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

  it("shows a contrast readout", () => {
    expect(plainOf(initialState())).toMatch(/\d+\.\d+:1/);
  });

  it("renders the application mock with its chrome and service rows (app view)", () => {
    const text = plainOf({ ...initialState(), view: "app" }, 40);
    expect(text).toContain("aurora-api");
    expect(text).toContain("auth-gateway");
    expect(text).toContain("down"); // the failing-service status label
    expect(text).toContain("Deploy");
  });

  it("renders the dense showcase by default", () => {
    const text = plainOf(initialState(), 50);
    expect(text).toContain("Tonal ramps");
    expect(text).toContain("Heading level 1");
    expect(text).toContain("Navigation");
  });

  it("v toggles between the showcase and the app dashboard", () => {
    const start = initialState();
    expect(start.view).toBe("showcase");
    const toggled = reduce(start, ch("v"));
    expect(toggled.view).toBe("app");
    expect(plainOf(toggled, 40)).toContain("aurora-api  ·  dashboard");
    expect(reduce(toggled, ch("v")).view).toBe("showcase");
  });
});

describe("explorer model — app mock", () => {
  it("returns a multi-line dashboard", () => {
    const lines = appMock(transposedPalette(initialState()), 4.5, 90);
    expect(lines.length).toBeGreaterThan(8);
  });

  it("paints the surface background on content rows for a light theme", () => {
    // Regression: foreground-only segments used to fall through to the
    // terminal's ambient background, so light themes rendered text rows on a
    // dark page. Every cell of a content row must carry an explicit bg.
    const light = transposedPalette({
      ...initialState(),
      themeIndex: THEME_NAMES.indexOf("solarized-light"),
    });
    const lines = appMock(light, 4.5, 90);
    const row = lines.find((l) => l.map((s) => s.text).join("").includes("auth-gateway"));
    expect(row).toBeDefined();
    for (const seg of row!) {
      if (seg.text.length === 0) continue;
      // Panel border glyphs sit on the page background by design — only the
      // interior surface must be stamped.
      if (/^[│╭╮╰╯─]+$/.test(seg.text.trim())) continue;
      expect(seg.style?.bgcolor).toBeDefined();
    }
  });

  it("keeps the failing-service status red-hued across every root rotation", () => {
    // The 'down' status draws from the anchored `error` var. Its hue must
    // hold no matter where the decorative root note is rotated — the demo's
    // whole point: chrome rotates, meaning stays put.
    const srcErr = Oklch.fromRgba(sourcePalette(initialState()).get("error")!).h;
    for (const rootHue of [0, 60, 120, 180, 240, 300]) {
      const palette = transposedPalette({ ...initialState(), rootHue });
      const errHue = Oklch.fromRgba(palette.get("error")!).h;
      const drift = Math.min(
        Math.abs(errHue - srcErr),
        360 - Math.abs(errHue - srcErr),
      );
      expect(drift).toBeLessThan(2);
    }
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

describe("explorer model — root hue offset", () => {
  it("defaults to 0° offset — every theme opens as authored", () => {
    const s0 = initialState();
    expect(s0.rootHue).toBe(0);
    for (let i = 0; i < THEME_NAMES.length; i++) {
      const s = { ...s0, themeIndex: i };
      const src = sourcePalette(s).get("primary")!;
      const out = transposedPalette(s).get("primary")!;
      const drift =
        Math.abs(out.red - src.red) +
        Math.abs(out.green - src.green) +
        Math.abs(out.blue - src.blue);
      expect(drift).toBeLessThanOrEqual(6); // round-trip only
    }
  });

  it("the offset is an offset: same value rotates each theme from its own root", () => {
    // At +90° every theme's tonic should sit 90° from where that theme placed
    // it — i.e. the *effective* hue differs per theme, but the offset doesn't.
    const off90 = { ...initialState(), rootHue: 90 };
    for (const theme of ["nord", "gruvbox", "dracula"]) {
      const s = { ...off90, themeIndex: THEME_NAMES.indexOf(theme) };
      const natural = Oklch.fromRgba(sourcePalette(s).get("primary")!).h;
      const rotated = Oklch.fromRgba(transposedPalette(s).get("primary")!).h;
      const delta = ((rotated - natural) % 360 + 360) % 360;
      expect(Math.min(Math.abs(delta - 90), 360 - Math.abs(delta - 90))).toBeLessThan(3);
    }
  });

  it("changing theme preserves the stored offset", () => {
    const before = { ...initialState(), rootHue: 137 };
    const after = reduce(reduce(before, k("down")), k("down"));
    expect(after.rootHue).toBe(137);
  });

  it("the root-hue display is one signed offset, unchanged across theme switches", () => {
    const rootHueText = (st: ExplorerState): string | undefined =>
      framesToSegments(renderFrame(st, 120, 40))
        .map((s) => s.text)
        .join("")
        .match(/Root hue:\s*([+\-]?\d+°)/)?.[1];
    let s: ExplorerState = { ...initialState(), focusedControl: "rootHue" };
    for (let n = 0; n < 5; n++) s = reduce(s, k("right")); // +30°
    const v1 = rootHueText(s);
    const v2 = rootHueText(reduce(reduce(s, k("down")), k("down")));
    expect(v1).toBe("+30°");
    expect(v2).toBe(v1); // does not change when the theme changes
  });

  it("reset returns the offset to 0°", () => {
    let s: ExplorerState = { ...initialState(), focusedControl: "rootHue" };
    s = reduce(s, k("right"));
    expect(reduce(s, ch("r")).rootHue).toBe(0);
  });
});

describe("explorer model — dense showcase", () => {
  it("exercises a large fraction of the theme's vars (dozens and dozens)", () => {
    // Wrap the palette so we can record every var the showcase reads.
    const base = transposedPalette(initialState());
    const seen = new Set<string>();
    const recording = new Proxy(base, {
      get(target, prop, receiver) {
        if (prop === "get") {
          return (k: string) => {
            seen.add(k);
            return target.get(k);
          };
        }
        return Reflect.get(target, prop, receiver);
      },
    });
    renderShowcase(recording, 4.5, 150);
    expect(seen.size).toBeGreaterThanOrEqual(100);
  });

  it("renders without throwing for every theme, light and dark", () => {
    for (let i = 0; i < THEME_NAMES.length; i++) {
      const palette = transposedPalette({ ...initialState(), themeIndex: i });
      expect(() => renderShowcase(palette, 4.5, 150)).not.toThrow();
    }
  });

  it("every readable cell clears the contrast floor across all themes", () => {
    // Walk the rendered segments; for any cell with real text and both fg+bg
    // resolved to RGBA, the WCAG ratio must meet the floor. Solid color blocks
    // (█) and separators carry no readable text and are skipped.
    const min = 4.5;
    let checked = 0;
    for (let i = 0; i < THEME_NAMES.length; i++) {
      const palette = transposedPalette({ ...initialState(), themeIndex: i, rootHue: 120 });
      for (const line of renderShowcase(palette, min, 150)) {
        for (const seg of line) {
          if (!/[A-Za-z0-9]/.test(seg.text)) continue;
          const fg = seg.style?.color?.value;
          const bg = seg.style?.bgcolor?.value;
          if (!fg || !bg) continue;
          checked++;
          expect(contrastRatio(fg, bg)).toBeGreaterThanOrEqual(min - 0.05);
        }
      }
    }
    expect(checked).toBeGreaterThan(500);
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
