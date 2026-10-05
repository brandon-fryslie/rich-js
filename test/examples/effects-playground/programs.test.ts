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
import { CURVES_FILE, KIT_FILE, KIT_MODULE, effectPrograms } from "../../../examples/effects-playground/programs.js";
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
    expect(drawn).toContain(`${effect} · 2.5s · frame 10`);
    expect(drawn).toContain("claude.ai");
    expect(drawn).toContain("Thinking about how a band of light");
  });
});
