/**
 * Contract of `askTerminalIdentity`: what a terminal's answer to XTVERSION,
 * replayed from a probe session, makes of what the environment inferred, and
 * what a `strict` policy then sends.
 *
 * [LAW:behavior-not-structure] What is asserted is the features the app ends
 * with and the bytes `pick` chooses from them.
 */

import { describe, it, expect } from "vitest";

import { App } from "../../src/host/app.js";
import { askTerminalIdentity } from "../../src/host/terminal-version.js";
import { pick } from "../../src/core/terminal-capabilities.js";
import { NOTIFICATION } from "../../src/core/terminal-requests.js";
import { RichText } from "../../src/core/text.js";
import { fakeClock } from "../core/fake-clock.js";
import { replayHost, type ProbeSession } from "./replay-host.js";
import { SESSIONS } from "./probe-sessions.js";

async function identified(session: ProbeSession) {
  const host = replayHost(session);
  const app = new App({ host, surface: "inline", clock: fakeClock(), view: () => new RichText("x") });
  const keys: string[] = [];
  app.onKey((press) => keys.push(press.key));
  const done = app.run();
  const before = app.terminalFeatures;
  app.terminalFeatures = await askTerminalIdentity(app);
  const after = app.terminalFeatures;
  app.stop();
  await done;
  return { before, after, keys, written: host.output() };
}

describe("askTerminalIdentity", () => {
  it.each([
    ["kitty", "kitty", "kitty(0.35.2)"],
    ["foot", "foot", "foot(1.16.2)"],
    ["wezterm", "wezterm", "WezTerm 20240203-110809-5046fc22"],
    ["iterm2", "iterm2", "iTerm2 3.5.0"],
    ["ghostty", "ghostty", "ghostty 1.0.0"],
  ] as const)("identifies %s from its own answer", async (session, name, text) => {
    const { before, after, written } = await identified(SESSIONS[session]);
    expect(written).toContain("\x1b[>0q\x1b[c");
    expect(before.capabilities.terminal.evidence).toBe("inferred");
    expect(after.capabilities.terminal).toEqual({ name, evidence: "identified", source: `XTVERSION ${text}` });
    expect(after.layers).toEqual([]);
  });

  it("under tmux, identifies tmux as the innermost layer and leaves the terminal past it inferred", async () => {
    const { before, after, keys } = await identified(SESSIONS.tmuxInIterm2);
    expect(after.capabilities.terminal).toEqual(before.capabilities.terminal);
    expect(after.capabilities.terminal.evidence).toBe("inferred");
    expect(after.layers).toEqual([{ kind: "tmux", passthrough: "unknown" }]);
    expect(keys).toEqual([]);
  });

  it("drops a tmux layer the environment inherited when the terminal answers for itself", async () => {
    const { before, after } = await identified(SESSIONS.kittyFromTmux);
    expect(before.layers.map((layer) => layer.kind)).toEqual(["tmux"]);
    expect(after.capabilities.terminal.name).toBe("kitty");
    expect(after.layers).toEqual([]);
  });

  it("changes nothing when the terminal does not implement XTVERSION", async () => {
    const { before, after } = await identified(SESSIONS.vte);
    expect(after).toEqual(before);
  });

  it("lets strict send foot its own notification once foot names itself", async () => {
    const { before, after } = await identified(SESSIONS.foot);
    const notification = { title: "Done", body: undefined, id: "1" };
    expect(pick(NOTIFICATION, notification, before).reason).toMatch(/^OSC 9:/);
    expect(pick(NOTIFICATION, notification, after).bytes).toBe("\x1b]777;notify;Done;\x1b\\");
  });
});
