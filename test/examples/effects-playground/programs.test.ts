/**
 * The effects playground's programs: each is the demo's own code from
 * curves.ts, and each runs as the playground runs it — the docs' playground
 * script on the live library with the kit added — and draws the demo's
 * subjects. The page, its terminals and its editors are not exercised here.
 */
import { readFileSync } from "node:fs";
import stripAnsi from "strip-ansi";
import { afterEach, describe, expect, it, vi } from "vitest";
import { libraryModule, liveLibraryOnce } from "../../../docs/.vitepress/example-runner.js";
import { runInTerminal } from "../../../docs/.vitepress/simulated-process.js";
import { playgroundScript } from "../../../docs/.vitepress/theme/playground-program.js";
import { CONTROL_DEFAULTS, type Controls } from "../../../examples/effects-playground/controls.js";
import { KIT_MODULE, edit, started, told } from "../../../examples/effects-playground/edits.js";
import { CURVES_FILE, KIT_FILE, effectPrograms } from "../../../examples/effects-playground/programs.js";
import { EFFECTS, EFFECT_DEFAULTS } from "../../../examples/effects-feel/vocabulary.js";

const programs = effectPrograms();
const curves = readFileSync(CURVES_FILE, "utf-8");
const library = liveLibraryOnce();

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("an effect's program", () => {
  it("carries the effect's function as curves.ts spells it, and what it reaches", () => {
    const dissolve = programs.dissolve;
    const fn = curves.slice(curves.indexOf("export function dissolveOut("), curves.indexOf("\n}\n", curves.indexOf("export function dissolveOut(")) + 2);
    expect(dissolve).toContain(fn.replace(/^export /, ""));
    for (const reached of ["const DISSOLVE_SHAPE", "function order(", "function veiled(", "const OWN = 0.45;"]) expect(dissolve).toContain(reached);
    // Not what it does not reach.
    expect(dissolve).not.toContain("function shimmer(");
  });

  it("opens on the curve the demo defaults to", () => {
    for (const effect of EFFECTS) {
      const d = EFFECT_DEFAULTS[effect];
      expect(programs[effect]).toContain(`const CURVE: Curve = { seconds: ${d.seconds}, ease: EASES["${d.ease}"], swing: ${d.swing} };`);
    }
  });

  it.each(EFFECTS)("%s runs on the live library and the kit, drawing the demo's strip and status line", { timeout: 120_000 }, async (effect) => {
    const [shared, kit] = await Promise.all([library(), libraryModule(KIT_MODULE, KIT_FILE)]);
    const output: string[] = [];
    vi.useFakeTimers();
    await runInTerminal(playgroundScript(programs[effect], shared.script + kit.code), {
      columns: 108,
      rows: 6,
      isTTY: true,
      env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
      write: (chunk) => void output.push(String(chunk)),
      onInput: () => {},
      exit: () => {},
    });
    // Ten frames at the demo's 30 a second.
    vi.advanceTimersByTime(340);
    const drawn = stripAnsi(output.join(""));
    expect(drawn).toContain(`${effect} · frame 10 · curve time 2.50`);
    expect(drawn).toContain("claude.ai");
    expect(drawn).toContain("Thinking about how a band of light");
  });
});

describe("what is typed at a running program", () => {
  /** `source` started under `controls`, then `typed` typed at it after ten frames; the bytes of the ten frames after that. */
  async function framesAfter(source: string, typed: string | undefined, controls: Controls = CONTROL_DEFAULTS, ms = 340): Promise<string> {
    const [shared, kit] = await Promise.all([library(), libraryModule(KIT_MODULE, KIT_FILE)]);
    const output: string[] = [];
    let type: (chunk: string | Uint8Array) => void = () => {};
    vi.useFakeTimers();
    await runInTerminal(started(source, shared.script + kit.code, controls), {
      columns: 108,
      rows: 20,
      isTTY: true,
      env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
      write: (chunk) => void output.push(String(chunk)),
      onInput: (deliver) => void (type = deliver),
      exit: () => {},
    });
    await vi.advanceTimersByTimeAsync(ms);
    if (typed !== undefined) type(typed);
    output.length = 0;
    await vi.advanceTimersByTimeAsync(ms);
    vi.clearAllTimers();
    return output.join("");
  }

  it("an edit changes the effect in place: the clock carries on", { timeout: 120_000 }, async () => {
    // Pulse, whose swing shows in the first seconds; shimmer's first pass comes later.
    const source = programs.pulse;
    const still = source.replace(/swing: [\d.]+ \}/, "swing: 0 }");
    expect(still).not.toBe(source);
    const kept = await framesAfter(source, edit(source));
    const changed = await framesAfter(source, edit(still));
    // The clock carried on through the edit.
    for (const frames of [kept, changed]) expect(stripAnsi(frames)).toContain("pulse · frame 20 · curve time 5.00");
    // The same frames, under the edited swing, are drawn as a program begun with it draws them.
    expect(changed).not.toBe(kept);
    expect(changed).toBe(await framesAfter(still, undefined));
  });

  it("a control changes the run in place, as one started under it draws it", { timeout: 120_000 }, async () => {
    const source = programs.pulse;
    const quieter = { ...CONTROL_DEFAULTS, magnitude: 0.25 };
    const kept = await framesAfter(source, undefined);
    const changed = await framesAfter(source, told({ kind: "controls", controls: quieter }));
    expect(stripAnsi(changed)).toContain("pulse · frame 20 · curve time 5.00 · 0.7s real · 30 fps · rate ×1 · magnitude ×0.25");
    expect(changed).not.toBe(kept);
    expect(changed).toBe(await framesAfter(source, undefined, quieter));
  });

  it("the rate moves the demo's time on faster from where it stands", { timeout: 120_000 }, async () => {
    const changed = await framesAfter(programs.pulse, told({ kind: "controls", controls: { ...CONTROL_DEFAULTS, rate: 2 } }));
    // From the frame after the change, each moves the demo's time half a second.
    const drawn = stripAnsi(changed);
    expect(drawn).toContain("pulse · frame 19 · curve time 6.75");
    expect(drawn).toContain("pulse · frame 20 · curve time 7.25");
  });

  it("another effect's program plays as a scene of its own, on its own clock, under the first", { timeout: 120_000 }, async () => {
    const drawn = stripAnsi(await framesAfter(programs.pulse, edit(programs.fade)));
    expect(drawn).toContain("pulse · frame 20 · curve time 5.00");
    expect(drawn).toContain("fade · frame 9 · curve time 2.25");
    expect(drawn.lastIndexOf("pulse ·")).toBeLessThan(drawn.lastIndexOf("fade ·"));
  });

  it("a frame is drawn the same whatever the frame rate: the rate sets only how often one comes", { timeout: 120_000 }, async () => {
    // Each frame's own synchronized update, its heading (which names the rate) and the padding it moves taken out.
    const frames = (drawn: string): string[] =>
      drawn
        .split("\x1b[?2026h")
        .slice(1)
        .map((frame) => frame.replace(/pulse · frame [^\x1b]*/, "").replace(/ +/g, " "));
    const fast = frames(await framesAfter(programs.pulse, undefined));
    // At 2 fps, ten frames take five seconds.
    const slow = frames(await framesAfter(programs.pulse, undefined, { ...CONTROL_DEFAULTS, fps: 2 }, 5000));
    expect(fast).toHaveLength(10);
    expect(slow).toEqual(fast);
  });

  it("a restart starts the clock over in place", { timeout: 120_000 }, async () => {
    const restarted = stripAnsi(await framesAfter(programs.pulse, told({ kind: "restart", scene: "pulse" })));
    expect(restarted).toContain("pulse · frame 9 · curve time 2.25");
    expect(restarted).not.toContain("frame 20");
  });

  it("a replay starts the transition over from now", { timeout: 120_000 }, async () => {
    const replayed = await framesAfter(programs.fade, told({ kind: "replay", scene: "fade" }));
    expect(replayed).not.toBe(await framesAfter(programs.fade, undefined));
  });
});
