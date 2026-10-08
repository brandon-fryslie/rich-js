/**
 * The effects playground page's programs and cards: each program is the
 * library's own code from src/renderables/effects.ts, and each card runs it
 * as the page does — its files on the live library, under the docs'
 * simulated process — drawing the demo's subjects. The page itself is
 * e2e/effects-playground.spec.ts's.
 */
import { readFileSync } from "node:fs";
import stripAnsi from "strip-ansi";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { cardLibrary } from "../../../docs/.vitepress/demo-card.js";
import { programFiles, withCodes, type CardProgram } from "../../../docs/.vitepress/example-card.js";
import { effectCards, type EffectCard } from "../../../docs/.vitepress/effect-cards.js";
import { decodeProgram } from "../../../docs/.vitepress/playground-hash.js";
import { runInTerminal } from "../../../docs/.vitepress/simulated-process.js";
import { playgroundScript } from "../../../docs/.vitepress/theme/playground-program.js";
import { EFFECTS_FILE, effectPrograms } from "../../../examples/effects-playground/programs.js";
import { EFFECTS, EFFECT_DEFAULTS, RUN_DEFAULTS, STEP } from "../../../examples/effects-feel/vocabulary.js";

const programs = effectPrograms();
const effects = readFileSync(EFFECTS_FILE, "utf-8");

afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});

describe("an effect's program", () => {
  it("carries the effect's function as the library spells it, and what it reaches there, noise included", () => {
    const dissolve = programs.dissolve;
    const fn = effects.slice(effects.indexOf("export function dissolveOut("), effects.indexOf("\n}\n", effects.indexOf("export function dissolveOut(")) + 2);
    expect(dissolve).toContain(fn.replace(/^export /, ""));
    for (const reached of ["const DISSOLVE_SHAPE", "function order(", "function veiled(", "const OWN = 0.45;", "function fbm(", "function noise("]) expect(dissolve).toContain(reached);
    // Nothing is imported from a module the package does not export.
    expect(dissolve).not.toContain("noise.js");
    // Not what it does not reach.
    expect(dissolve).not.toContain("function shimmer(");
    // Nor a file's header, which leads the first declaration it reaches there.
    for (const file of [EFFECTS_FILE, new URL("../../../src/core/noise.ts", import.meta.url)]) {
      const header = /^\/\*\*[\s\S]*?\*\//.exec(readFileSync(file, "utf-8"))![0];
      expect(dissolve).not.toContain(header);
    }
  });

  it("opens on the curve the library defaults to and the pace the demo plays at, each a named number a slider is over", () => {
    for (const effect of EFFECTS) {
      const d = EFFECT_DEFAULTS[effect];
      expect(programs[effect]).toContain(`const CURVE: Curve = { seconds: ${d.seconds}, ease: EASES["${d.ease}"], swing: ${d.swing} };`);
      expect(programs[effect]).toContain(`const FPS = ${RUN_DEFAULTS.fps};`);
      expect(programs[effect]).toContain(`const STEP = ${STEP};`);
    }
  });
});

describe("an effect's card", { timeout: 120_000 }, () => {
  let cards: readonly EffectCard[];
  // Made where a failure is reported against this block, not as a rejection nobody awaits yet.
  beforeAll(async () => {
    cards = await effectCards();
  });

  /** The bytes `program` writes in its first `ms` of running in its card's terminal. */
  async function drawn(program: CardProgram, ms = 340): Promise<string> {
    const output: string[] = [];
    const library = (await cardLibrary()).script;
    vi.useFakeTimers();
    await runInTerminal(playgroundScript(programFiles(program), library), {
      ...program.terminal,
      isTTY: true,
      env: { TERM: "xterm-256color", COLORTERM: "truecolor" },
      write: (chunk) => void output.push(String(chunk)),
      onInput: () => {},
      exit: () => {},
    });
    await vi.advanceTimersByTimeAsync(ms);
    vi.clearAllTimers();
    return output.join("");
  }

  const cardOf = (effect: string) => cards.find((c) => c.effect === effect)!.card;

  it("is every effect's, in the demo's order, each with sliders and every colour as drawn", () => {
    expect(cards.map((c) => c.effect)).toEqual([...EFFECTS]);
    for (const { effect, card } of cards) {
      expect(card.program.files.map((file) => file.name)).toEqual([`${effect}.ts`, "kit.ts", "../effects-feel/subjects.ts"]);
      expect(card.program.files[0].code).toBe(programs[effect]);
      expect(card.program.contrast).toBe("as drawn");
      expect(card.options).toEqual({ sliders: true });
    }
  });

  it("carries every colour as drawn to the playground, where the effect is shown as on the card", async () => {
    for (const { card } of cards) expect((await decodeProgram(card.tryIt.program)).contrast).toBe("as drawn");
  });

  it.each(EFFECTS)("%s runs in its card, drawing the demo's strip and status line", async (effect) => {
    const shown = stripAnsi(await drawn(cardOf(effect).program));
    // Ten frames at the demo's 30 a second, the first numbered 0.
    expect(shown).toContain("frame 9 · curve time 2.25 · 30 fps");
    expect(shown).toContain("claude.ai");
    expect(shown).toContain("Thinking about how a band of light");
  });

  it("a frame is drawn the same whatever FPS says: it sets only how often one comes", async () => {
    const { program } = cardOf("pulse");
    const atFps = (fps: number): CardProgram => withCodes(program, [programs.pulse.replace(/const FPS = \d+;/, `const FPS = ${fps};`), ...program.files.slice(1).map((f) => f.code)]);
    // Each frame's own synchronized update, its heading (which names the rate) and the padding it moves taken out.
    const frames = (bytes: string): string[] =>
      bytes
        .split("\x1b[?2026h")
        .slice(1)
        .map((frame) => frame.replace(/frame [^\x1b]*/, "").replace(/ +/g, " "));
    const fast = frames(await drawn(atFps(30)));
    // At 2 a second, ten frames take five seconds.
    const slow = frames(await drawn(atFps(2), 5000));
    expect(fast).toHaveLength(10);
    expect(slow).toEqual(fast);
  });

  it("a curve edited in the code is the curve it plays", async () => {
    const { program } = cardOf("pulse");
    const still = programs.pulse.replace(/swing: [\d.]+ \}/, "swing: 0 }");
    expect(still).not.toBe(programs.pulse);
    const edited = await drawn(withCodes(program, [still, ...program.files.slice(1).map((f) => f.code)]));
    expect(edited).not.toBe(await drawn(program));
  });

  it("a transition starts over every CURVE.seconds × 1.25 of curve time, from where it began", async () => {
    const { program } = cardOf("fade");
    // A second's curve starts over each 1.25 of curve time: every five frames at STEP 0.25.
    const brief = programs.fade.replace(/seconds: [\d.]+,/, "seconds: 1,");
    expect(brief).not.toBe(programs.fade);
    const frames = (await drawn(withCodes(program, [brief, ...program.files.slice(1).map((f) => f.code)])))
      .split("\x1b[?2026h")
      .slice(1)
      .map((frame) => frame.replace(/frame [^\x1b]*/, "").replace(/ +/g, " "));
    expect(frames).toHaveLength(10);
    // It moves within a pass, and each frame of the second pass is the first's.
    expect(frames[2]).not.toBe(frames[0]);
    expect(frames.slice(5)).toEqual(frames.slice(0, 5));
  });
});
