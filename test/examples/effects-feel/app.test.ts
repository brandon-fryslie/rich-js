// The effects demo hands the terminal back on every way out, and keeps
// drawing frames at the rate it was given until then.

import { describe, expect, it } from "vitest";
import { runDemo } from "../../../examples/effects-feel/app.js";
import { envAtDepth, parseSettings } from "../../../examples/effects-feel/settings.js";
import { scriptedHost } from "../../host/scripted-host.js";

const HAND_BACK = "\x1b[?1049l";

function started(argv: string[] = []) {
  const settings = parseSettings(["--fps", "30", ...argv])!;
  const base = scriptedHost({ cols: 110, rows: 40 });
  const host = { ...base, env: envAtDepth(base.env, settings.depth) };
  return { host: base, demo: runDemo(host, settings) };
}

const frames = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

describe("effects-feel", () => {
  it.each([["q"], ["\x03"]])("stops on %j and hands the terminal back", async (key) => {
    const { host, demo } = started();
    await frames(100);
    host.type(key);
    await demo.done;
    expect(host.output().endsWith(HAND_BACK)).toBe(true);
    expect(host.raw()).toBe(false);
  });

  it("draws every effect, with the worst contrast of each loop", async () => {
    const { host, demo } = started();
    await frames(100);
    host.type("q");
    await demo.done;
    const out = host.output();
    for (const name of ["shimmer", "pulse", "drift", "sparkle", "fade", "dissolve"]) expect(out).toContain(name);
    expect(out.match(/worst contrast \d+\.\d\d:1 \(at rest \d+\.\d\d:1\)/g)?.length).toBeGreaterThanOrEqual(4);
  });

  it("says no colour is drawn when there is none to measure", async () => {
    const { host, demo } = started(["--depth", "none"]);
    await frames(50);
    host.type("q");
    await demo.done;
    expect(host.output()).toContain("no colour drawn");
    // No colour parameter in any SGR: a reset is not a colour.
    expect(host.output()).not.toMatch(/\x1b\[(?:[0-9]+;)*(?:38|48|3[0-7]|4[0-7]|9[0-7]|10[0-7])[;m]/);
  });

  it("replays the fade-in on f: running again after it had settled", async () => {
    const { host, demo } = started(["--fade-duration", "0.1"]);
    await frames(250);
    expect(host.output()).toContain("done — f replays");
    const before = host.output().length;
    host.type("f");
    await frames(60);
    host.type("q");
    await demo.done;
    expect(host.output().slice(before)).toMatch(/fade\s.*running/);
  });
});
