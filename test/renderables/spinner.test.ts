import { describe, it, expect } from "vitest";
import { Spinner } from "../../src/renderables/spinner.js";
import { Segment } from "../../src/core/segment.js";
import { Group } from "../../src/renderables/group.js";
import { RichText } from "../../src/core/text.js";
import { ReprHighlighter } from "../../src/core/highlighter.js";
import { SPINNERS } from "../../src/core/spinnerData.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// [LAW:behavior-not-structure] What is asserted is what a host sees: which
// frame is drawn at which handed time, beside what label, in what bytes.

function collectText(r: Renderable, opts: RenderOptions): string {
  return [...r.render(opts)].map((s) => s.text).join("");
}

function collectSegments(r: Renderable, opts: RenderOptions): Segment[] {
  return [...r.render(opts)];
}

const DOTS = SPINNERS["dots"]!.frames;
/** The `dots` frame drawn at `t`, bare. */
const dotAt = (t: number, speed = 1): string => collectText(new Spinner("dots", "", { speed }).at(t), { maxWidth: 80 }).trim();

describe("Spinner", () => {
  describe("construction", () => {
    it("constructs with a known spinner name", () => {
      expect(new Spinner("dots").name).toBe("dots");
    });

    it("throws for unknown spinner name", () => {
      expect(() => new Spinner("nonexistent_spinner_xyz")).toThrow();
    });

    it("refuses a speed that is not finite, where it is given", () => {
      expect(() => new Spinner("dots", "", { speed: Infinity })).toThrow(RangeError);
      expect(() => new Spinner("dots", "", { speed: NaN })).toThrow(RangeError);
    });

    it("refuses a time that is not a finite number of seconds, where it is given", () => {
      expect(() => new Spinner("dots").at(NaN)).toThrow(RangeError);
      expect(() => new Spinner("dots").at(Infinity)).toThrow(RangeError);
    });
  });

  describe("properties", () => {
    it(".frames has length > 0", () => {
      expect(new Spinner("dots").frames.length).toBeGreaterThan(0);
    });

    it(".interval is > 0", () => {
      expect(new Spinner("dots").interval).toBeGreaterThan(0);
    });

    it(".speed defaults to 1.0", () => {
      expect(new Spinner("dots").speed).toBe(1);
    });

    it(".speed can be set via options", () => {
      expect(new Spinner("dots", "", { speed: 2 }).speed).toBe(2);
    });
  });

  describe("the frame for the time it is handed", () => {
    it("draws the frame in progress at t, each held for the interval, looping, with no clock", () => {
      const hold = SPINNERS["dots"]!.interval / 1000;
      expect(dotAt(0)).toBe(DOTS[0]);
      expect(dotAt(hold * 1.5)).toBe(DOTS[1]);
      expect(dotAt(hold * 9.5)).toBe(DOTS[9]);
      expect(dotAt(hold * 10.5)).toBe(DOTS[0]);
    });

    it("sampled sixty times a second, shows each dots frame for 4 or 5 samples, in order, none skipped", () => {
      const samples = Array.from({ length: 240 }, (_, i) => dotAt(i / 60));
      const runs: { frame: string; length: number }[] = [];
      for (const frame of samples) {
        const last = runs.at(-1);
        if (last?.frame === frame) last.length++;
        else runs.push({ frame, length: 1 });
      }
      expect(runs[0]!.frame).toBe(DOTS[0]);
      for (const run of runs.slice(1, -1)) expect([4, 5]).toContain(run.length);
      for (let i = 1; i < runs.length; i++) {
        expect(DOTS.indexOf(runs[i]!.frame)).toBe((DOTS.indexOf(runs[i - 1]!.frame) + 1) % DOTS.length);
      }
    });

    it("sampled once a second, draws the frame the beat has at that second", () => {
      // 80 ms frames, an 800 ms period: half-seconds land 0.5, 0.7 and 0.1 s into a pass.
      expect(dotAt(0.5)).toBe(DOTS[6]);
      expect(dotAt(1.5)).toBe(DOTS[8]);
      expect(dotAt(2.5)).toBe(DOTS[1]);
    });

    it("draws the same bytes for the same t, however many times", () => {
      const once = collectText(new Spinner("dots", "load").at(123456.789), { maxWidth: 80 });
      expect(collectText(new Spinner("dots", "load").at(123456.789), { maxWidth: 80 })).toBe(once);
    });

    it("at twice the speed, turns twice as fast", () => {
      const hold = SPINNERS["dots"]!.interval / 1000;
      expect(dotAt(hold * 1.5, 2)).toBe(DOTS[3]);
    });

    it("steps backwards at a negative speed: its timeline run down from the first frame's start at t = 0, each held the interval", () => {
      const hold = SPINNERS["dots"]!.interval / 1000;
      expect(dotAt(0, -1)).toBe(DOTS[0]);
      expect(dotAt(hold * 0.5, -1)).toBe(DOTS[9]);
      expect(dotAt(hold * 1.5, -1)).toBe(DOTS[8]);
      expect(dotAt(hold * 0.25, -2)).toBe(DOTS[9]);
      expect(dotAt(hold * 0.75, -2)).toBe(DOTS[8]);
    });

    it("refuses a speed of zero, which would hold one frame forever", () => {
      expect(() => new Spinner("dots", "", { speed: 0 })).toThrow(RangeError);
    });
  });

  describe("rendering", () => {
    // The reference's Spinner is a `Text`, so it ends its own line and a
    // `Group` stacks what follows it below rather than beside it.
    it("stacks below itself in a Group", () => {
      const group = new Group(new Spinner("dots", "hi").at(0), new RichText("after"));
      const lines = Segment.splitLines([...group.render({ maxWidth: 80 })]).map((line) =>
        line.map((segment) => segment.text).join(""),
      );
      expect(lines).toEqual(["⠋ hi", "after"]);
    });

    it("renders a single spinner frame without text", () => {
      const s = new Spinner("dots", "").at(0);
      const text = collectText(s, { maxWidth: 80 });
      expect(text).toBe(`${DOTS[0]}\n`);
    });

    it("renders spinner frame + text when text is provided", () => {
      expect(collectText(new Spinner("dots", "Loading...").at(0), { maxWidth: 80 })).toBe("⠋ Loading...\n");
    });

    it("applies style option to spinner frame segments", () => {
      const segs = collectSegments(new Spinner("dots", "", { style: "bold red" }).at(0), { maxWidth: 80 });
      expect(segs[0]!.text).toBe(DOTS[0]);
      expect(segs[0]!.style?.bold).toBe(true);
    });

    it("stands in the line spinner on an ASCII-only output, at the same t", () => {
      const line = SPINNERS["line"]!;
      const spinner = new Spinner("dots");
      const at = (t: number): string => collectText(spinner.at(t), { maxWidth: 80, asciiOnly: true }).trim();
      expect(at(0)).toBe(line.frames[0]);
      expect(at((line.interval / 1000) * 1.5)).toBe(line.frames[1]);
    });
  });

  describe("label", () => {
    it("draws a string label's markup as styles, as Rich's Text.from_markup does", () => {
      const segs = collectSegments(new Spinner("dots", "[bold]hi[/]").at(0), { maxWidth: 80 });
      expect(segs.map((s) => s.text).join("")).toBe("⠋ hi\n");
      expect(segs.find((s) => s.text === "hi")?.style?.bold).toBe(true);
    });

    it("draws a string label's brackets when the options turn markup off", () => {
      expect(collectText(new Spinner("dots", "[bold]hi[/]").at(0), { maxWidth: 80, markup: false })).toBe("⠋ [bold]hi[/]\n");
    });

    it("leaves the label unhighlighted, as Rich's Text label is", () => {
      const segs = collectSegments(new Spinner("dots", "3 files").at(0), { maxWidth: 80, highlighter: new ReprHighlighter() });
      expect(segs.every((s) => s.style === undefined || s.text.startsWith("⠋"))).toBe(true);
    });

    it("keeps the frame's style off the label", () => {
      const segs = collectSegments(new Spinner("dots", "hi", { style: "red" }).at(0), { maxWidth: 80 });
      expect(segs.find((s) => s.text.includes("hi"))?.style?.color).toBeUndefined();
    });

    it("draws a label that draws nothing as no label, with no trailing space", () => {
      expect(collectText(new Spinner("dots", "[bold][/]").at(0), { maxWidth: 80 })).toBe("⠋\n");
    });

    it("draws a RichText label changed in place as changed, as Rich's kept Text does", () => {
      const label = new RichText("hello");
      const s = new Spinner("dots", label).at(0);
      label.append(" world");
      expect(collectText(s, { maxWidth: 80 })).toBe("⠋ hello world\n");
    });

    it("wraps a long label with its frame when drawn as a line of its own", () => {
      expect(collectText(new Spinner("dots", "a very long label").at(0), { maxWidth: 10 })).toBe("⠋ a very \nlong label\n");
    });
  });

  describe("measurement", () => {
    it("minimum > 0", () => {
      expect(new Spinner("dots", "").at(0).measure({ maxWidth: 80 }).minimum).toBeGreaterThan(0);
    });

    it("minimum > 0 with text", () => {
      expect(new Spinner("dots", "Loading...").at(0).measure({ maxWidth: 80 }).minimum).toBeGreaterThan(0);
    });

    it("never offers a column less than its widest frame, spaces inside it or not", () => {
      const s = new Spinner("bouncingBall", "a b");
      const widest = Math.max(...s.frames.map((frame) => [...frame].length));
      expect(s.at(0).measure({ maxWidth: 80 }).minimum).toBe(widest);
    });

    it("measures the same at every t, so a column holding it never moves as it turns", () => {
      const spinner = new Spinner("bouncingBall", "go");
      const measures = [0, 0.1, 0.33, 7].map((t) => spinner.at(t).measure({ maxWidth: 80 }));
      for (const m of measures) expect(m).toEqual(measures[0]);
    });
  });
});
