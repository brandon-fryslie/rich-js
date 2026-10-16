import { describe, it, expect } from "vitest";
import { createEngine, type Engine } from "@promptctl/go-template-js";
import { renderToString } from "../../src/core/render.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Frames, type Frame } from "../../src/renderables/frames.js";
import { animationFuncs, richTextFuncs } from "../../src/template-bindings/index.js";

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
        renderToString(new Frames(chevrons, { t }).text(), { width: 10 }),
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
    expect(() => engineAt({ t: 0 }).parse(`{{ frames 1 "a" 2 }}`).evaluate({})).toThrow(/last hold \(2 s\) has no frame/);
  });

  it("a hold that is not a positive number of seconds is refused", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ frames 0 "a" }}`).evaluate({})).toThrow(/positive number of seconds/);
  });

  it("a hold where a frame belongs fails the type gate before the body runs", () => {
    expect(() => engineAt({ t: 0 }).parse(`{{ frames "a" 1 }}`).evaluate({})).toThrowError();
  });
});
