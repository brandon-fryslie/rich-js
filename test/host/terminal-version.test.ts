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
import { Progress } from "../../src/renderables/progress.js";
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
  const learned = await askTerminalIdentity(app);
  if (learned !== undefined) app.terminalFeatures = learned;
  const after = app.terminalFeatures;
  app.stop();
  await done;
  return { before, learned, after, keys, written: host.output() };
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
    const { before, after, keys, written } = await identified(SESSIONS.tmuxInIterm2);
    expect(after.capabilities.terminal).toEqual(before.capabilities.terminal);
    expect(after.capabilities.terminal.evidence).toBe("inferred");
    expect(after.layers).toEqual([{ kind: "tmux", evidence: "identified", passthrough: "unknown" }]);
    expect(keys).toEqual([]);
    // tmux would hand a wrapped query's reply to the pane as keystrokes (tmux#5530).
    expect(written).not.toContain("\x1bPtmux;");
  });

  it("drops a tmux layer the environment inherited when the terminal answers for itself", async () => {
    const { before, after } = await identified(SESSIONS.kittyFromTmux);
    expect(before.layers.map((layer) => layer.kind)).toEqual(["tmux"]);
    expect(after.capabilities.terminal.name).toBe("kitty");
    expect(after.layers).toEqual([]);
  });

  it("changes nothing when the terminal does not implement XTVERSION", async () => {
    const { before, learned, after } = await identified(SESSIONS.vte);
    expect(learned).toBeUndefined();
    expect(after).toBe(before);
  });

  it("lets strict send foot its own notification once foot names itself", async () => {
    const { before, after } = await identified(SESSIONS.foot);
    const notification = { title: "Done", body: undefined, id: "1" };
    expect(pick(NOTIFICATION, notification, before).reason).toMatch(/^OSC 9:/);
    expect(pick(NOTIFICATION, notification, after).bytes).toBe("\x1b]777;notify;Done;\x1b\\");
  });
});

describe("an App whose features are learned while it runs", () => {
  const ESC = "\x1b";
  const later = () => new Promise((resolve) => setTimeout(resolve));

  async function learning(session: ProbeSession, setUp: (app: App) => void): Promise<{ before: string; after: string }> {
    const host = replayHost(session);
    let progress: Progress | undefined;
    const app = new App({ host, surface: "inline", clock: fakeClock(0), view: () => progress! });
    progress = new Progress({ drawnBy: app });
    progress.addTask("x", { total: undefined });
    setUp(app);
    const done = app.run();
    await later();
    const before = host.output();
    const learned = await askTerminalIdentity(app);
    expect(learned?.capabilities.terminal.evidence).toBe("identified");
    app.terminalFeatures = learned!;
    await later();
    const after = host.output().slice(before.length);
    app.stop();
    await done;
    return { before, after };
  }

  // ghostty inferred from TERM: strict refuses OSC 9;4 until ghostty names itself.
  it("sends the indeterminate progress the inferred features refused", async () => {
    const { before, after } = await learning(SESSIONS.ghostty, () => undefined);
    expect(before).not.toContain(`${ESC}]9;4`);
    expect(after).toContain(`${ESC}]9;4;3${ESC}\\`);
  });

  // An inherited tmux layer, whose passthrough is unknown, refuses OSC 22 until kitty's answer drops it.
  it("sends the pointer shape the inferred features refused", async () => {
    const { before, after } = await learning(SESSIONS.kittyFromTmux, (app) => (app.pointerShape = "pointer"));
    expect(before).not.toContain(`${ESC}]22;`);
    expect(after).toContain(`${ESC}]22;pointer`);
  });
});

describe("an App whose learned features decide as the old ones did", () => {
  const ESC = "\x1b";
  const later = () => new Promise((resolve) => setTimeout(resolve));

  async function swapped(session: ProbeSession, setUp: (app: App) => void): Promise<{ app: App; before: string; after: string }> {
    const host = replayHost(session);
    const app = new App({ host, surface: "inline", clock: fakeClock(0), view: () => new RichText("x") });
    setUp(app);
    const done = app.run();
    await later();
    const before = host.output();
    app.terminalFeatures = (await askTerminalIdentity(app))!;
    await later();
    const after = host.output().slice(before.length);
    app.stop();
    await done;
    return { app, before, after };
  }

  // ghostty identified may show progress, but an app that declares none has nothing to clear.
  it("sends no progress clear when nothing was ever shown", async () => {
    const { after } = await swapped(SESSIONS.ghostty, () => undefined);
    expect(after).not.toContain(`${ESC}]9;4`);
  });

  // kitty with no layer between: OSC 22 is sent before and after it names itself.
  it("does not send the pointer shape again when it was already sent", async () => {
    const { before, after } = await swapped(SESSIONS.kitty, (app) => (app.pointerShape = "pointer"));
    expect(before).toContain(`${ESC}]22;pointer`);
    expect(after).not.toContain(`${ESC}]22;`);
  });

  it("refuses features set once the app has stopped, as it refuses a pointer shape", async () => {
    const { app } = await swapped(SESSIONS.kitty, () => undefined);
    expect(() => (app.terminalFeatures = app.terminalFeatures)).toThrow(/stopped/);
    expect(() => (app.pointerShape = "pointer")).toThrow(/stopped/);
  });
});
