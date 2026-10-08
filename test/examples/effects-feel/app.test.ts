// The effects demo hands the terminal back on every way out, keeps drawing
// frames at the rate it was given until then, and moves a strip's colour
// wherever the strip shows it.

import { describe, expect, it, vi } from "vitest";
import {
  CATPPUCCIN_LATTE,
  CATPPUCCIN_MOCHA,
  ColorDepth,
  ColorSpec,
  Console,
  EASES,
  Effected,
  Oklch,
  Style,
  contrastRatio,
  EFFECT_LIGHTS,
  SHIMMER_WIDTH,
  pulse,
  shares,
  shimmer,
  sparkle,
  type Renderable,
  type TerminalTheme,
} from "../../../src/index.js";
import { cellLen, graphemes } from "../../../src/core/cells.js";
import { drawnSubject, runDemo, stripSubject, subjectUnder, textSubject } from "../../../examples/effects-feel/app.js";
import { parseSettings } from "../../../examples/effects-feel/settings.js";
import { envAtDepth } from "../../../examples/effects-feel/vocabulary.js";
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

  it("draws every effect, with the worst contrast of each loop measured between the frames", async () => {
    const { host, demo } = started();
    await shown(host, FIRST_FRAME);
    // The first frame is up before any loop's contrast is, since measuring
    // one takes hundreds of frames and holding the screen for them is what
    // the demo is not allowed to do.
    expect(host.output()).toContain("measuring contrast…");
    // Measuring every loop is a second or two of work spread between the frames; more under a loaded suite.
    await vi.waitFor(() => expect(host.output()).toMatch(/wheel .*worst contrast \d+\.\d\d:1 over \d+s \(at rest \d+\.\d\d:1\)/), { timeout: 30_000, interval: 50 });
    host.type("q");
    await demo.done;
    const out = host.output();
    for (const name of ["shimmer", "pulse", "sparkle", "wheel", "fade", "dissolve"]) expect(out).toContain(name);
    expect(out.match(/worst contrast \d+\.\d\d:1 over \d+s \(at rest \d+\.\d\d:1\)/g)?.length).toBeGreaterThanOrEqual(5);
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
    // A fade four frames long: one under a frame can settle in the frame the
    // key lands in, before any paint shows it running.
    const { host, demo } = started(["--fade-duration", "1"]);
    await shown(host, "done — f replays");
    const before = host.output().length;
    host.type("f");
    await vi.waitFor(() => expect(host.output().slice(before)).toMatch(/fade\s.*running/), { timeout: 5000, interval: 10 });
    host.type("q");
    await demo.done;
  });

  it("replays the transitions each cycle, the longest loop's period, without a key", async () => {
    const periods = ["shimmer", "pulse", "sparkle", "wheel"].flatMap((loop) => [`--${loop}-period`, "0.5"]);
    const { host, demo } = started([...periods, "--fade-duration", "0.1", "--dissolve-duration", "0.1"]);
    await shown(host, "done — f replays");
    const before = host.output().length;
    // The transitions ran again on their own: the cycle came round.
    await vi.waitFor(() => expect(host.output().slice(before)).toMatch(/fade\s.*running/), { timeout: 5000, interval: 10 });
    // Half a designed second at a quarter a frame: two frames a cycle, and the cycle counted up.
    expect(host.output()).toContain("cycle 2 · frame 0");
    host.type("q");
    await demo.done;
  });

  it("walks the themes on n and p, each measured anew", async () => {
    const { host, demo } = started();
    await shown(host, "catppuccin-mocha (dark)");
    host.type("n");
    await shown(host, "catppuccin-latte (light)");
    host.type("p");
    await shown(host, /catppuccin-latte \(light\)[^]*catppuccin-mocha \(dark\)/);
    host.type("p");
    await shown(host, "cyberpunk (dark)");
    host.type("q");
    await demo.done;
  });

  it("steps the frame rate on < and >, and the pace of the demo's time on - and +", async () => {
    const { host, demo } = started(["--fps", "5"]);
    await shown(host, "5 fps · rate ×1");
    host.type(">");
    await shown(host, "10 fps · rate ×1");
    host.type("<<");
    await shown(host, "2 fps · rate ×1");
    host.type("+");
    await shown(host, "2 fps · rate ×2 ·");
    host.type("---");
    await shown(host, "2 fps · rate ×0.25 ·");
    host.type("q");
    await demo.done;
  });

  it("scales every loop's swing on ] and [, a mix stopping at the light", async () => {
    const { host, demo } = started(["--pulse-swing", "0.5"]);
    await shown(host, "magnitude ×1 ·");
    host.type("]]");
    await shown(host, "magnitude ×1.5 ·");
    expect(host.output()).toMatch(/pulse .*swing 0\.75/);
    host.type("]]]]");
    await shown(host, "magnitude ×2.5 ·");
    expect(host.output()).toMatch(/pulse .*swing 1 /);
    host.type("[".repeat(12));
    await shown(host, "magnitude ×0.25 ·");
    expect(host.output()).toMatch(/pulse .*swing 0\.125/);
    host.type("q");
    await demo.done;
  });

  it("holds the frame rate and the pace at their ends", async () => {
    const { host, demo } = started(["--fps", "30"]);
    await shown(host, FIRST_FRAME);
    host.type(">>>");
    host.type("++++++");
    await shown(host, "30 fps · rate ×16");
    host.type("<<<<<<<<<<");
    host.type("------------");
    await shown(host, "0.5 fps · rate ×0.125");
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

  it("spans the columns it draws", () => {
    const strip = drawnSubject(stripSubject(CATPPUCCIN_MOCHA), options, CATPPUCCIN_MOCHA);
    const rows = [...strip.renderable.render(options)].map((segment) => segment.text).join("").split("\n");
    expect(strip.span).toBe(Math.max(...rows.map(cellLen)));
  });

  it("reads the colours it sets in the cells it letters, and none of the terminal's", () => {
    const strip = drawnSubject(stripSubject(CATPPUCCIN_MOCHA), options, CATPPUCCIN_MOCHA);
    expect(strip.colors.has(CATPPUCCIN_MOCHA.palette.get("foreground")!.hex)).toBe(true);
    expect(strip.colors.has(CATPPUCCIN_MOCHA.palette.get("secondary-muted")!.hex)).toBe(true);
    const text = drawnSubject(textSubject(CATPPUCCIN_MOCHA, ColorDepth.TRUECOLOR), options, CATPPUCCIN_MOCHA);
    expect(text.colors.has(CATPPUCCIN_MOCHA.backgroundColor.hex)).toBe(false);
  });

  it.each([["dark", CATPPUCCIN_MOCHA], ["light", CATPPUCCIN_LATTE]] as const)(
    "on a %s ground moves each colour the strip sets, alike in neighbouring cells, and leaves the terminal's alone",
    (_, theme) => {
      const strip = drawnSubject(stripSubject(theme), options, theme);
      const loop = pulse({ seconds: 2, ease: EASES.linear, swing: 1 }, EFFECT_LIGHTS.sun, 0);
      const lit = subjectUnder(strip, loop, theme);
      const share = shares(strip.pairs, strip.colors, loop.touch);
      const before = colorsByCell(strip.renderable, theme);
      // Two breaths, a frame each tenth of a second: a cell can be resting at any one moment.
      const frames = Array.from({ length: 40 }, (_, i) => colorsByCell(new Effected(strip.renderable, lit, { t: i / 10, key: "strip", theme }), theme));
      frames.forEach((after) => expect(after).toHaveLength(before.length));

      // Every colour the strip sets moves, but for one whose cells have no
      // contrast to spare; the terminal's own ground does not.
      const rgba = new Map(strip.pairs.flat().map((c) => [c.hex, c]));
      const still = new Set(["ground", ...[...share].filter(([hex, s]) => loop.touch(rgba.get(hex)!, s).hex === hex).map(([hex]) => hex)]);
      before.forEach((pair, i) =>
        pair.forEach((was, slot) => expect([was, frames.every((after) => after[i]![slot] === was)]).toEqual([was, still.has(was)])),
      );

    },
  );

  it.each([["dark", CATPPUCCIN_MOCHA], ["light", CATPPUCCIN_LATTE]] as const)(
    "on a %s ground keeps a fill one colour across neighbouring cells through a whole breath, at truecolour",
    (_, theme) => {
      // A breath spreads, so cells far apart differ; neighbours that showed
      // one colour — an arrow's ink and the fill of the cell it points out
      // of, lettering and its fill — still show one as far as the eye can
      // tell (dE_OK 0.02), on the inhale and the exhale where the breath is
      // steepest as well as at its top. Near black an 8-bit step is large in
      // OKLab's lightness, and a display shows none of it.
      const pulseCurve = parseSettings([])!.curves.pulse;
      const strip = drawnSubject(stripSubject(theme), options, theme);
      const lit = subjectUnder(strip, pulse(pulseCurve, EFFECT_LIGHTS.sun, strip.z), theme);
      const before = colorsByCell(strip.renderable, theme);
      const oklch = (hex: string) => Oklch.fromRgba(ColorSpec.parse(hex).getTruecolor());
      const seen = (a: string, b: string) => (Math.max(oklch(a).l, oklch(b).l) < 0.2 ? 0 : oklch(a).deltaE(oklch(b)));
      for (let t = 0; t < pulseCurve.seconds; t += 0.5) {
        const after = colorsByCell(new Effected(strip.renderable, lit, { t, key: "strip", theme }), theme);
        before.slice(1).forEach((pair, i) =>
          pair.forEach((was, slot) =>
            before[i]!.forEach((left, leftSlot) => {
              if (left === was && was !== "ground") expect(seen(after[i]![leftSlot]!, after[i + 1]![slot]!), `${was} at ${t}`).toBeLessThan(0.02);
            }),
          ),
        );
      }
    },
  );
});

describe("every loop keeps the words readable", () => {
  const AA = 4.5;
  const { curves } = parseSettings([])!;
  const made = {
    shimmer: (span: number, z: number) => shimmer({ ...curves.shimmer, swing: 1 }, span, SHIMMER_WIDTH, EFFECT_LIGHTS.sun, z),
    pulse: (_span: number, z: number) => pulse({ ...curves.pulse, swing: 1 }, EFFECT_LIGHTS.sun, z),
    sparkle: (span: number, z: number) => sparkle({ ...curves.sparkle, swing: 1 }, span, EFFECT_LIGHTS.firefly, z),
  };
  const grounds = [["dark", CATPPUCCIN_MOCHA], ["light", CATPPUCCIN_LATTE]] as const;
  const depths = [["truecolor", ColorDepth.TRUECOLOR], ["256", ColorDepth.EIGHT_BIT]] as const;

  it.each(grounds.flatMap(([g, theme]) => depths.flatMap(([d, depth]) => Object.keys(made).map((loop) => [loop, g, d, theme, depth] as const))))(
    "%s on a %s ground at %s colours: no lettered cell falls below its resting contrast or AA",
    (loop, _g, _d, theme, depth) => {
      const at = new Console({ width: 200, colorSystem: depth === ColorDepth.TRUECOLOR ? "truecolor" : "256" }).options;
      for (const subject of [stripSubject(theme), textSubject(theme, depth)].map((s) => drawnSubject(s, at, theme))) {
        const effect = subjectUnder(subject, made[loop as keyof typeof made](subject.span, subject.z), theme);
        const contrasts = (t: number | undefined): number[] => {
          const drawn = t === undefined ? subject.renderable.render(subject.options) : new Effected(subject.renderable, effect, { t, key: loop, theme }).render(subject.options);
          const out: number[] = [];
          let [row, col] = [0, 0];
          for (const segment of drawn) {
            if (segment.isControl) continue;
            const colors = (segment.style ?? Style.null()).drawnColors(at.colorSystem ?? undefined);
            const fg = colors.color?.getTruecolor(theme, true) ?? theme.foregroundColor;
            const bg = colors.bgcolor?.getTruecolor(theme, false) ?? theme.backgroundColor;
            for (const glyph of graphemes(segment.text)) {
              if (glyph === "\n") [row, col] = [row + 1, 0];
              else {
                out.push(subject.text.has(`${row}:${col}`) ? contrastRatio(fg, bg) : Number.POSITIVE_INFINITY);
                col += cellLen(glyph);
              }
            }
          }
          return out;
        };
        const rest = contrasts(undefined);
        // Twelve periods, 36 moments a period: a sky can keep a subject's
        // shimmer under cloud for periods together, and a shorter window
        // never sees its brightest passes.
        const P = curves[loop as keyof typeof made].seconds;
        for (let t = 0; t < 12 * P; t += P / 36) {
          // 8-bit rounding of a colour the shares settled exactly can cost a hair.
          contrasts(t).forEach((now, i) => expect(now).toBeGreaterThanOrEqual(Math.min(rest[i]!, AA) - 0.05));
        }
      }
    },
  );
});
