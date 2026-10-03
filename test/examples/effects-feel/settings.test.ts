// The effects demo's command line: every flag parsed to a typed setting, and
// every bad one refused by name.

import { describe, expect, it } from "vitest";
import { EASES } from "../../../src/index.js";
import { EFFECTS, envAtDepth, parseSettings } from "../../../examples/effects-feel/settings.js";

describe("parseSettings", () => {
  it("is a run at 1 fps, truecolor, on a dark ground with no flags", () => {
    const settings = parseSettings([])!;
    expect(settings).toMatchObject({ fps: 1, depth: "truecolor", ground: "dark" });
    expect(Object.keys(settings.curves)).toEqual([...EFFECTS]);
  });

  it("reads every effect's seconds, ease and swing", () => {
    const settings = parseSettings([
      "--fps", "0.5", "--depth", "256", "--ground", "light",
      "--pulse-period", "4", "--pulse-ease", "ease-in-out", "--pulse-swing", "0.3",
      "--fade-duration", "1.5", "--drift-swing=-90",
    ])!;
    expect(settings).toMatchObject({ fps: 0.5, depth: "256", ground: "light" });
    expect(settings.curves.pulse).toMatchObject({ seconds: 4, easeName: "ease-in-out", swing: 0.3 });
    expect(settings.curves.pulse.ease).toBe(EASES["ease-in-out"]);
    expect(settings.curves.fade.seconds).toBe(1.5);
    expect(settings.curves.drift.swing).toBe(-90);
  });

  it("is undefined for --help", () => {
    expect(parseSettings(["--help"])).toBeUndefined();
  });

  it.each([
    [["--fps", "31"], /--fps must be a number from 0.5 to 30/],
    [["--fps", "fast"], /--fps must be a number/],
    [["--depth", "8"], /--depth must be one of truecolor, 256, 16, none/],
    [["--ground", "grey"], /--ground must be one of dark, light/],
    [["--shimmer-ease", "bounce"], /--shimmer-ease must be one of/],
    [["--pulse-swing", "2"], /--pulse-swing must be a number from 0 to 1/],
    [["--fade-period", "2"], /Unknown option '--fade-period'/],
  ])("refuses %j", (argv, message) => {
    expect(() => parseSettings(argv)).toThrow(message);
  });
});

describe("envAtDepth", () => {
  it("forces the depth a run asks for, over what the terminal says", () => {
    expect(envAtDepth({ TERM: "xterm", NO_COLOR: "1" }, "256")).toEqual({ TERM: "xterm", FORCE_COLOR: "256" });
    expect(envAtDepth({ COLORTERM: "truecolor" }, "16")).toEqual({ COLORTERM: "truecolor", FORCE_COLOR: "ansi" });
  });

  it("turns colour off for none, whatever FORCE_COLOR says", () => {
    expect(envAtDepth({ FORCE_COLOR: "3" }, "none")).toEqual({ NO_COLOR: "1" });
  });
});
