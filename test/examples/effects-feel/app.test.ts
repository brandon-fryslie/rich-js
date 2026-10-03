// The effects demo hands the terminal back on every way out, keeps drawing
// frames at the rate it was given until then, and moves a strip's colour
// wherever the strip shows it.

import { describe, expect, it, vi } from "vitest";
import {
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MOCHA,
  Console,
  ColorRgba,
  EASES,
  Effected,
  Style,
  type Renderable,
  type TerminalTheme,
} from "../../../src/index.js";
import { graphemes } from "../../../src/core/cells.js";
import { drawnSubject, runDemo, stripSubject } from "../../../examples/effects-feel/app.js";
import { onColors, pulse } from "../../../examples/effects-feel/curves.js";
import { envAtDepth, parseSettings } from "../../../examples/effects-feel/settings.js";
import { scriptedHost } from "../../host/scripted-host.js";

const HAND_BACK = "\x1b[?1049l";

function started(argv: string[] = []) {
  const settings = parseSettings(["--fps", "30", ...argv])!;
  const base = scriptedHost({ cols: 110, rows: 40 });
  const host = { ...base, env: envAtDepth(base.env, settings.depth) };
  return { host: base, demo: runDemo(host, settings) };
}

/** Until the screen has shown `text`, however long the frames take. */
const shown = (host: { output(): string }, text: string | RegExp) =>
  vi.waitFor(() => expect(host.output()).toMatch(text), { timeout: 5000, interval: 10 });

const FIRST_FRAME = "effects feel";

describe("effects-feel", () => {
  it.each([["q"], ["\x03"]])("stops on %j and hands the terminal back", async (key) => {
    const { host, demo } = started();
    await shown(host, FIRST_FRAME);
    host.type(key);
    await demo.done;
    expect(host.output().endsWith(HAND_BACK)).toBe(true);
    expect(host.raw()).toBe(false);
  });

  it("draws every effect, with the worst contrast of each loop", async () => {
    const { host, demo } = started();
    await shown(host, FIRST_FRAME);
    host.type("q");
    await demo.done;
    const out = host.output();
    for (const name of ["shimmer", "pulse", "drift", "sparkle", "fade", "dissolve"]) expect(out).toContain(name);
    expect(out.match(/worst contrast \d+\.\d\d:1 \(at rest \d+\.\d\d:1\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("says no colour is drawn when there is none to measure", async () => {
    const { host, demo } = started(["--depth", "none"]);
    await shown(host, FIRST_FRAME);
    host.type("q");
    await demo.done;
    expect(host.output()).toContain("no colour drawn");
    // No colour parameter in any SGR: a reset is not a colour.
    expect(host.output()).not.toMatch(/\x1b\[(?:[0-9]+;)*(?:38|48|3[0-7]|4[0-7]|9[0-7]|10[0-7])[;m]/);
  });

  it("replays the fade-in on f: running again after it had settled", async () => {
    const { host, demo } = started(["--fade-duration", "0.1"]);
    await shown(host, "done — f replays");
    const before = host.output().length;
    host.type("f");
    await vi.waitFor(() => expect(host.output().slice(before)).toMatch(/fade\s.*running/), { timeout: 5000, interval: 10 });
    host.type("q");
    await demo.done;
  });
});

describe("a strip under a pulse", () => {
  const options = new Console({ width: 200, colorSystem: "truecolor" }).options;

  /** Each cell's two colours by hex, `"ground"` where the terminal's shows. */
  function colorsByCell(renderable: Renderable, theme: TerminalTheme): [string, string][] {
    return [...renderable.render(options)].flatMap((segment) => {
      const drawn = (segment.style ?? Style.null()).drawnColors(options.colorSystem ?? undefined);
      const fg = drawn.color?.getTruecolor(theme, true).hex ?? "ground";
      const bg = drawn.bgcolor?.getTruecolor(theme, false).hex ?? "ground";
      return graphemes(segment.text).map((): [string, string] => [fg, bg]);
    });
  }

  it.each([["dark", CATPPUCCIN_MOCHA, new ColorRgba(255, 228, 176)], ["light", CATPPUCCIN_LATTE, new ColorRgba(92, 58, 12)]] as const)(
    "on a %s ground moves each fill to one colour, in every cell that shows it, and nothing else",
    (_, theme, light) => {
      const strip = drawnSubject(stripSubject(theme), options, theme);
      const lit = onColors(strip.colors, pulse({ seconds: 2, ease: EASES.linear, swing: 0.3 }, light));
      const before = colorsByCell(strip.renderable, theme);
      const after = colorsByCell(new Effected(strip.renderable, lit, { t: 1, key: "strip", theme }), theme);
      expect(after).toHaveLength(before.length);

      // Each colour drawn before, to every colour it is drawn as after: an
      // arrow's ink moves with the fill it carries, so each is one colour.
      const becomes = new Map<string, Set<string>>();
      before.forEach((pair, i) =>
        pair.forEach((was, slot) => becomes.set(was, (becomes.get(was) ?? new Set()).add(after[i]![slot]!))),
      );
      const fills = new Set(before.map(([, bg]) => bg).filter((bg) => bg !== "ground"));
      for (const [was, now] of becomes) {
        expect([was, [...now]]).toEqual([was, [fills.has(was) ? expect.not.stringMatching(was) : was]]);
      }
    },
  );
});
