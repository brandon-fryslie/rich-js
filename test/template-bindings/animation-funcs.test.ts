import { describe, it, expect } from "vitest";
import { createEngine, type Engine } from "@promptctl/go-template-js";
import { renderToString } from "../../src/core/render.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { FrameSequence, type Frame } from "../../src/renderables/frames.js";
import { animationFuncs, paletteFuncs, richTextFuncs } from "../../src/template-bindings/index.js";
import { EASES, Phase } from "../../src/core/easing.js";
import { Segment } from "../../src/core/segment.js";
import { Timeline } from "../../src/core/timeline.js";
import { tween } from "../../src/core/tween.js";
import { ColorRamp } from "../../src/themes/ramp.js";
import { GRUVBOX } from "../../src/themes/terminalThemes.js";
import { cellSeed } from "../../src/renderables/effect.js";
import { Reglyphed, reglyphText } from "../../src/renderables/glyph-effect.js";
import { GLYPH_EFFECT_CATALOGUE } from "../../src/renderables/glyph-effects.js";

// [LAW:behavior-not-structure] The binding's contract: a template evaluated
// at a time draws the bytes `Frames` draws for that time, and the time is
// the host's capability, read when the template is evaluated.

const CHEVRONS = ["\u{F0143}", "\u{F013F}", "\u{F0DBC}"];
const COLORS = ["red", "green", "blue"];

/** An engine whose templates draw for `clock.t`, which a test moves by hand. */
function engineAt(clock: { t: number }): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: { ...richTextFuncs(), ...animationFuncs(() => clock.t) },
  });
}

const TEMPLATE = `{{ frames 1 (fg "red" "${CHEVRONS[0]}") 1 (fg "green" "${CHEVRONS[1]}") 1 (fg "blue" "${CHEVRONS[2]}") }}`;
const chevrons: Frame[] = CHEVRONS.map((glyph, i) => ({ text: new RichText(glyph, { style: new Style({ color: COLORS[i]! }) }), seconds: 1 }));

describe("frames in a template", () => {
  it("draws the same bytes Frames draws for the same times", () => {
    const clock = { t: 0 };
    const compiled = engineAt(clock).compile(TEMPLATE);
    for (const t of [0, 1.5, 2.2, 3.0, 1e6 + 0.5]) {
      clock.t = t;
      const fragments = compiled({});
      expect(fragments).toHaveLength(1);
      expect(renderToString(RichText.fromFragments(fragments), { width: 10 })).toBe(
        renderToString(new FrameSequence(chevrons).at(t), { width: 10 }),
      );
    }
  });

  it("reads the time when the template is evaluated, not when it is compiled", () => {
    const clock = { t: 0 };
    const compiled = engineAt(clock).compile(TEMPLATE);
    clock.t = 2;
    expect(compiled({})[0]!.plain).toBe(CHEVRONS[2]);
  });

  it("sampled every 1/60 s over 3 s, each chevron is drawn for exactly 60 consecutive samples", () => {
    const clock = { t: 0 };
    const compiled = engineAt(clock).compile(TEMPLATE);
    const samples = Array.from({ length: 180 }, (_, i) => {
      clock.t = i / 60;
      return compiled({})[0]!.plain;
    });
    expect(samples.join("")).toBe(CHEVRONS.map((glyph) => glyph.repeat(60)).join(""));
  });

  it("frames of unequal width draw at the widest one's, and a frame may be a bare string or a piped fragment", () => {
    const clock = { t: 0 };
    const engine = engineAt(clock);
    const compiled = engine.compile(`{{ frames 1 "a" 0.5 ("abc" | bold) }}`);
    expect(compiled({})[0]!.plain).toBe("a  ");
    clock.t = 1.2;
    expect(compiled({})[0]!.plain).toBe("abc");
    expect(compiled({})[0]!.resolvedStyle({ maxWidth: 10 }).bold).toBe(true);
  });

  it("holds are seconds, so the same template plays at one redraw a second and at sixty", () => {
    const clock = { t: 0 };
    const compiled = engineAt(clock).compile(`{{ frames 0.25 "a" 0.25 "b" 0.25 "c" 0.25 "d" }}`);
    const at = (t: number): string => {
      clock.t = t;
      return compiled({})[0]!.plain;
    };
    expect([0, 1, 2, 3].map(at)).toEqual(["a", "a", "a", "a"]);
    expect(new Set(Array.from({ length: 60 }, (_, i) => at(i / 60)))).toEqual(new Set(["a", "b", "c", "d"]));
  });

  it("is refused at the arity gate with no frame at all", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ frames }}`).evaluate({})).toThrow(/frames/);
  });

  it("a trailing hold with no frame is refused, naming the pairs", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ frames 1 "a" 2 }}`).evaluate({})).toThrow(/^error calling frames: last hold \(2 s\) has no frame — the arguments are <seconds> <frame> pairs$/);
  });

  it("a hold that is not a positive number of seconds is refused", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ frames 0 "a" }}`).evaluate({})).toThrow(/^error calling frames: hold 0 must be a positive number of seconds, got 0$/);
  });

  it("a hold where a frame belongs fails the type gate before the body runs", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ frames "a" 1 }}`).evaluate({})).toThrowError();
  });
});

describe("stepped in a template", () => {
  const STEPPED = `{{ stepped 1 "#ff5555" 1 "#f1fa8c" 1 "#50fa7b" }}`;
  const HEXES = ["#ff5555", "#f1fa8c", "#50fa7b"];

  it("is the colour in progress at the moment, as a colour value, looping", () => {
    const clock = { t: 0 };
    const compiled = engineAt(clock).compile(STEPPED);
    for (const [t, hex] of [[0, 0], [0.99, 0], [1, 1], [2.5, 2], [3, 0], [1e6 + 0.5, 1]] as const) {
      clock.t = t;
      expect(compiled({})[0]!.plain).toBe(HEXES[hex]);
    }
  });

  it("goes where a colour goes: fg, and readableOn against the ground the template names", () => {
    const clock = { t: 1 };
    const engine = engineAt(clock);
    const asInk = engine.compile(`{{ "›››" | fg (stepped 1 "#ff5555" 1 "#f1fa8c") }}`)({})[0]!;
    expect(asInk.resolvedStyle({ maxWidth: 10 }).color!.getTruecolor().hex).toBe("#f1fa8c");
    // Pale yellow on white does not read; readableOn moves it, as it moves any colour.
    const legible = engine.compile(`{{ readableOn (stepped 1 "#ff5555" 1 "#f1fa8c") "#ffffff" 4.5 }}`)({})[0]!.plain;
    expect(legible).not.toBe("#f1fa8c");
    expect(legible).toMatch(/^#[0-9a-f]{6}$/);
  });

  it("reads the time when the template is evaluated, so one template plays at one redraw a second and at sixty", () => {
    const clock = { t: 0 };
    const compiled = engineAt(clock).compile(STEPPED);
    const at = (t: number): string => {
      clock.t = t;
      return compiled({})[0]!.plain;
    };
    expect([0, 1, 2, 3].map(at)).toEqual([...HEXES, HEXES[0]]);
    expect(Array.from({ length: 180 }, (_, i) => at(i / 60)).join(" ")).toBe(HEXES.map((hex) => Array.from({ length: 60 }, () => hex).join(" ")).join(" "));
  });

  it("a trailing hold with no colour is refused, naming the pairs", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ stepped 1 "#ff5555" 2 }}`).evaluate({})).toThrow(/^error calling stepped: last hold \(2 s\) has no color — the arguments are <seconds> <color> pairs$/);
  });

  it("a value that is not a colour is refused as every colour function refuses one", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ stepped 1 "primary" }}`).evaluate({})).toThrow(/stepped expected a color .* wrap it: stepped \(color "primary"\)/);
  });

  it("a hold that is not a positive number of seconds is refused", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ stepped 0 "#ff5555" }}`).evaluate({})).toThrow(/^error calling stepped: hold 0 must be a positive number of seconds, got 0$/);
  });
});

// ─── The toolbox: tween, loop, glyphs, the timeline ─────────────────────────

/** The soonest moment any segment of `text`, drawn, says it changes. */
const nextChangeOf = (text: RichText): number => Segment.nextChange(text.render({ maxWidth: 80 }));

/** An engine drawing for `clock.t` on `clock.timeline` (the host's own clock when unset), with `color` and `ramp` over a real palette. */
function toolboxAt(clock: { t: number; timeline?: Timeline }, options: { reducedMotion?: boolean; asciiOnly?: boolean } = {}): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: {
      ...richTextFuncs(),
      ...paletteFuncs(() => GRUVBOX.palette),
      ...animationFuncs(() => clock.t, { ...options, timeline: () => clock.timeline ?? Timeline.play(0) }),
    },
  });
}

/** `source` evaluated at each of `times`, its fragments' plain text. */
function sample(engine: Engine<RichText>, clock: { t: number }, source: string, times: readonly number[]): string[] {
  const compiled = engine.compile(source);
  return times.map((t) => {
    clock.t = t;
    return RichText.fromFragments(compiled({ at: 10, was: 0 })).plain;
  });
}

/** Every second from 0 to `seconds`, and every sixtieth: a host at one frame a second and one at sixty. */
const rates = (seconds: number): [number[], number[]] => [
  Array.from({ length: seconds + 1 }, (_, i) => i),
  Array.from({ length: seconds * 60 + 1 }, (_, i) => i / 60),
];

describe("tween in a template", () => {
  const TWEEN = `{{ .at | tween 0.4 "ease-out" 10 .was | printf "%.6f" }}`;

  it("is the core tween started at the moment the template names, a number like any other", () => {
    const clock = { t: 0 };
    const reference = tween(0, 10, { seconds: 0.4, ease: EASES["ease-out"] });
    const times = [0, 9.99, 10, 10.1, 10.25, 10.4, 11, 1e6];
    expect(sample(toolboxAt(clock), clock, TWEEN, times)).toEqual(times.map((t) => reference.at(t - 10).toFixed(6)));
  });

  it("reads the same at one frame a second and at sixty, at every moment they share", () => {
    const clock = { t: 0 };
    const source = `{{ .at | tween 2.5 "spring" 1 .was | printf "%.9f" }}`;
    const [slow, fast] = rates(4);
    const bySixty = sample(toolboxAt(clock), clock, source, fast);
    expect(sample(toolboxAt(clock), clock, source, slow)).toEqual(slow.map((t) => bySixty[t * 60]));
  });

  it("under reduced motion is where it starts until it starts, then where it arrives", () => {
    const clock = { t: 0 };
    expect(sample(toolboxAt(clock, { reducedMotion: true }), clock, TWEEN, [0, 9.99, 10, 10.1, 1e6])).toEqual(["0.000000", "0.000000", "10.000000", "10.000000", "10.000000"]);
  });

  it("refuses an ease it does not know, naming every one it does", () => {
    expect(() => toolboxAt({ t: 0 }).parse(`{{ tween 1 "wobble" 0 0 1 }}`).evaluate({})).toThrow(/unknown ease "wobble"; expected one of "linear", .*"spring"/);
  });

  it("refuses a slot of the wrong kind, or a missing one, at the gate", () => {
    expect(() => toolboxAt({ t: 0 }).parse(`{{ tween "fast" "linear" 0 0 1 }}`).evaluate({})).toThrowError(/tween/);
    expect(() => toolboxAt({ t: 0 }).parse(`{{ tween 1 "linear" 0 0 }}`).evaluate({})).toThrowError(/tween/);
  });
});

describe("loop in a template", () => {
  it("is the way through its period from the moment it started, 0 to 1 and round again", () => {
    const clock = { t: 0 };
    const times = [2, 2.75, 5, 6.5, 1e6 + 0.3];
    expect(sample(toolboxAt(clock), clock, `{{ loop 3 2 | printf "%.6f" }}`, times)).toEqual(times.map((t) => Phase.loop(3)(t - 2).toFixed(6)));
  });

  it("under reduced motion holds at its start", () => {
    const clock = { t: 0 };
    expect(new Set(sample(toolboxAt(clock, { reducedMotion: true }), clock, `{{ loop 3 2 | printf "%.6f" }}`, [0, 1.3, 2.7, 1e6]))).toEqual(new Set(["0.000000"]));
  });
});

describe("a colour tween and a ramp scrolling are a tween and a loop read through a ramp", () => {
  it("a ramp read at a tween is the two-stop ramp read over time, byte for byte", () => {
    const clock = { t: 0 };
    const [from, to] = [GRUVBOX.palette.get("surface")!, GRUVBOX.palette.get("warning")!];
    const over = new ColorRamp(EASES.linear, [{ at: 0, color: from }, { at: 1, color: to }]).over(0.8);
    const times = [0, 0.1, 0.4, 0.79, 0.8, 5];
    const source = `{{- $p := 1 | tween 0.8 "linear" 0 0 -}}{{ ramp $p "linear" 0 "surface" 1 "warning" }}`;
    expect(sample(toolboxAt(clock), clock, source, times)).toEqual(times.map((t) => over.at(t).hex));
  });

  it("two cells whose loops start a step apart show the ramp a step apart", () => {
    const clock = { t: 0 };
    const cell = (start: number) => `{{- $p := loop 3 ${start} -}}{{ ramp $p "linear" 0 "#ff0000" 0.5 "#0000ff" 1 "#ff0000" }}`;
    const [first] = sample(toolboxAt(clock), clock, cell(0), [1]);
    expect(sample(toolboxAt(clock), clock, cell(0.5), [1.5])[0]).toBe(first);
    expect(sample(toolboxAt(clock), clock, cell(0.5), [1])[0]).not.toBe(first);
  });
});

describe("glyphs in a template", () => {
  const typewriterAt = (text: string, t: number): string => {
    const effect = GLYPH_EFFECT_CATALOGUE.transitions.typewriter({ z: cellSeed(text, 0, 0) }).effect;
    return renderToString(new Reglyphed(new RichText(text, { end: "" }), effect, { t, key: text }), { width: 40 });
  };

  it("types the fragment as GlyphEffected types the same text, from the moment the template names", () => {
    const clock = { t: 0 };
    const compiled = toolboxAt(clock).compile(`{{ "deploying" | glyphs "typewriter" 3 }}`);
    for (const t of [0, 3, 3.5, 4.2, 5, 9]) {
      clock.t = t;
      expect(renderToString(RichText.fromFragments(compiled({})), { width: 40 })).toBe(typewriterAt("deploying", t - 3));
    }
  });

  it("keeps every style and span of the fragment on the glyphs it covers", () => {
    const fragment = RichText.fromFragments(toolboxAt({ t: 1e6 }).compile(`{{ "ok " | bold | glyphs "wave" 0 }}`)({}));
    expect(fragment.plain).toHaveLength(3);
    expect(renderToString(fragment, { width: 10, colorSystem: "truecolor" })).toContain("\u001b[1m");
    const spanned = new RichText("ab");
    spanned.stylize("italic", 1, 2);
    const typed = reglyphText(spanned, GLYPH_EFFECT_CATALOGUE.transitions.typewriter({ z: 0 }).effect, { key: "ab", asciiOnly: false });
    expect(typed.at(1).spans.map((s) => [s.start, s.end, String(s.style)])).toEqual([[1, 2, "italic"]]);
  });

  it("says when it next changes on the host's clock: while typing, every frame; typed, never", () => {
    const clock = { t: 0 };
    const compiled = toolboxAt(clock).compile(`{{ "go" | glyphs "typewriter" 1 }}`);
    clock.t = 1.5;
    expect(nextChangeOf(RichText.fromFragments(compiled({})))).toBe(1.5);
    clock.t = 10;
    expect(nextChangeOf(RichText.fromFragments(compiled({})))).toBe(Number.POSITIVE_INFINITY);
  });

  it("draws the same bytes at one frame a second and at sixty, at every moment they share", () => {
    const clock = { t: 0 };
    const source = `{{ "   loading   " | glyphs "rain" 0 }}`;
    const [slow, fast] = rates(3);
    const bySixty = sample(toolboxAt(clock), clock, source, fast);
    expect(sample(toolboxAt(clock), clock, source, slow)).toEqual(slow.map((t) => bySixty[t * 60]));
  });

  it("draws its own glyphs as ASCII when the output draws nothing else", () => {
    const clock = { t: 0 };
    const drawn = sample(toolboxAt(clock, { asciiOnly: true }), clock, `{{ "${" ".repeat(40)}" | glyphs "rain" 0 }}`, rates(3)[1]).join("");
    expect(drawn).toMatch(/^[ |:]+$/);
    expect(drawn).toMatch(/[|:]/);
  });

  it("under reduced motion shows the fragment as written once it starts", () => {
    const clock = { t: 0 };
    expect(sample(toolboxAt(clock, { reducedMotion: true }), clock, `{{ "deploying" | glyphs "typewriter" 3 }}`, [3, 3.1, 1e6])).toEqual(["deploying", "deploying", "deploying"]);
  });

  it("refuses an effect it does not know, naming every one it does", () => {
    expect(() => toolboxAt({ t: 0 }).parse(`{{ "x" | glyphs "melt" 0 }}`).evaluate({})).toThrow(/unknown glyph effect "melt"; expected one of "wave", "rain", "stars", "typewriter", "scramble"/);
  });
});

describe("every function draws on the timeline the host hands in", () => {
  const FRAMES = `{{ frames 1 "a" 1 "b" 1 "c" }}`;
  const TWEEN = `{{ .at | tween 4 "linear" 0 .was | printf "%.3f" }}`;

  it("paused, nothing moves and a frame says it never changes", () => {
    const clock: { t: number; timeline?: Timeline } = { t: 0, timeline: Timeline.pause(Timeline.play(0), 1.5) };
    const engine = toolboxAt(clock);
    expect(new Set(sample(engine, clock, FRAMES, [1.5, 7, 1e6]))).toEqual(new Set(["b"]));
    expect(new Set(sample(engine, clock, TWEEN, [1.5, 7]))).toEqual(new Set(["3.750"]));
    clock.t = 7;
    expect(nextChangeOf(RichText.fromFragments(engine.compile(FRAMES)({})))).toBe(Number.POSITIVE_INFINITY);
  });

  it("backwards, frames run in reverse and say when they turn on the host's clock", () => {
    const clock: { t: number; timeline?: Timeline } = { t: 0, timeline: Timeline.withRate(Timeline.play(0), 2.5, -1) };
    const engine = toolboxAt(clock);
    expect(sample(engine, clock, FRAMES, [2.5, 3, 3.6, 4.6])).toEqual(["c", "c", "b", "a"]);
    clock.t = 3.5;
    // At host 3.5 the animation is at 1.5, in "b"'s hold from 1; coming down, it leaves it the first host moment after 4.
    const next = nextChangeOf(RichText.fromFragments(engine.compile(FRAMES)({})));
    expect(next).toBeGreaterThan(4);
    expect(next).toBeLessThan(4 + 1e-9);
  });

  it("sought, a tween is where it was put", () => {
    const clock: { t: number; timeline?: Timeline } = { t: 0, timeline: Timeline.seek(Timeline.play(0), 100, 2) };
    expect(sample(toolboxAt(clock), clock, TWEEN, [100, 101])).toEqual(["5.000", "7.500"]);
  });
});
