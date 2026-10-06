// The effects demo's command line: every flag parsed to a typed setting, and
// every bad one refused by name.

import { describe, expect, it } from "vitest";
import { EASES, detectColorSystem } from "../../../src/index.js";
import { DEPTHS, EFFECTS, depthDrawn, envAtDepth } from "../../../examples/effects-feel/vocabulary.js";
import { parseSettings } from "../../../examples/effects-feel/settings.js";

describe("parseSettings", () => {
  it("is a run at 30 fps, truecolor, on a dark ground with no flags", () => {
    const settings = parseSettings([])!;
    expect(settings).toMatchObject({ fps: 30, depth: "truecolor", ground: "dark" });
    expect(Object.keys(settings.curves)).toEqual([...EFFECTS]);
  });

  it("reads every effect's seconds, ease and swing", () => {
    const settings = parseSettings([
      "--fps", "0.5", "--depth", "256", "--ground", "light",
      "--pulse-period", "4", "--pulse-ease", "ease-in-out", "--pulse-swing", "0.3",
      "--fade-duration", "1.5", "--wheel-swing=0.9",
    ])!;
    expect(settings).toMatchObject({ fps: 0.5, depth: "256", ground: "light" });
    expect(settings.curves.pulse).toMatchObject({ seconds: 4, easeName: "ease-in-out", swing: 0.3 });
    expect(settings.curves.pulse.ease).toBe(EASES["ease-in-out"]);
    expect(settings.curves.fade.seconds).toBe(1.5);
    expect(settings.curves.wheel.swing).toBe(0.9);
  });

  it("is undefined for --help", () => {
    expect(parseSettings(["--help"])).toBeUndefined();
  });

  it.each([
    [["--fps", "31"], /--fps must be a number from 0.5 to 30/],
    [["--fps", "fast"], /--fps must be a number/],
    [["--depth", "8"], /--depth must be one of truecolor, 256, 16, none/],
    [["--ground", "grey"], /--ground must be one of dark, light/],
    [["--shimmer-ease", "bounce"], /--shimmer-ease: RangeError: unknown ease "bounce"/],
    [["--pulse-swing="], /--pulse-swing must be a number from 0 to 1, got ""/],
    [["--shimmer-swing", " "], /--shimmer-swing must be a number/],
    [["--fps", "0x1"], /--fps must be a number/],
    [["--pulse-swing", "2"], /--pulse-swing must be a number from 0 to 1/],
    [["--fade-period", "2"], /Unknown option '--fade-period'/],
  ])("refuses %j", (argv, message) => {
    expect(() => parseSettings(argv)).toThrow(message);
  });
});

describe("envAtDepth", () => {
  // Asserted through the detection that reads it, not the strings it writes:
  // the first version of this test pinned `FORCE_COLOR: "256"`, a value the
  // library does not read, and every run drew at 16 colours while it passed.
  it.each(DEPTHS)("resolves to the depth a run asks for, %s, over what the terminal says", (depth) => {
    for (const env of [{ TERM: "xterm", NO_COLOR: "1" }, { COLORTERM: "truecolor" }, { FORCE_COLOR: "3" }, {}]) {
      expect(detectColorSystem({ env: envAtDepth(env, depth), isTTY: true })).toBe(depthDrawn(depth));
    }
  });

  it("keeps the rest of the environment", () => {
    expect(envAtDepth({ TERM: "xterm", NO_COLOR: "1" }, "256")).toMatchObject({ TERM: "xterm" });
    expect(envAtDepth({ FORCE_COLOR: "3" }, "none")).toEqual({ NO_COLOR: "1" });
  });
});
