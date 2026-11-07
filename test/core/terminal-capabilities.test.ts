/**
 * What the library sends a terminal is a pure function of what it knows, the
 * policy and the layers between (`pick`), checked over every combination; and
 * a Progress on a Live mirrors its state in the terminal's own indicator only
 * on evidence its policy accepts, with every decision in the send log.
 */

import { describe, expect, it } from "vitest";

import { Console } from "../../src/core/console.js";
import {
  accepts,
  declareCapabilities,
  inferCapabilities,
  pick,
  type Encoding,
  type Evidence,
  type Failure,
  type Layer,
  type Route,
  type TerminalPolicy,
  type TerminalSend,
} from "../../src/core/terminal-capabilities.js";
import { identifyTerminal, type Intermediary } from "../../src/core/terminal-identity.js";
import { EMPTY_TERMINAL_STATE, commitTerminalState, declaredState } from "../../src/core/terminal-state.js";
import { App } from "../../src/host/app.js";
import { Progress } from "../../src/renderables/progress.js";
import { scriptedHost } from "../host/scripted-host.js";
import { fakeClock } from "./fake-clock.js";

describe("declaredState", () => {
  it("sums every declarer's share, so two displays show as one indicator", () => {
    const state = declaredState([
      { kind: "progress", share: { completed: 1, total: 4 } },
      { kind: "progress", share: { completed: 3, total: 4 } },
    ]);
    expect(state.progress).toEqual({ state: "normal", percent: 50 });
  });

  it("shows work of no known size once any share has none", () => {
    expect(declaredState([{ kind: "progress", share: { completed: 1, total: 4 } }, { kind: "progress", share: "indeterminate" }]).progress).toEqual({ state: "indeterminate" });
  });

  it("takes the indicator away when nothing declares it", () => {
    expect(declaredState([])).toBe(EMPTY_TERMINAL_STATE);
  });
});

describe("commitTerminalState", () => {
  const features = { capabilities: declareCapabilities(["OSC 9;4"], "other"), policy: "strict" as const, layers: [] };

  it("sends nothing for a frame that declares what the terminal already shows", () => {
    const shown = { progress: { state: "normal" as const, percent: 50.2 } };
    expect(commitTerminalState(shown, { progress: { state: "normal", percent: 49.9 } }, features).sends).toEqual([]);
  });

  it.each([[150, 160], [Number.NaN, Number.NaN], [-5, 0]])("sends nothing between %s%% and %s%%, which are sent as the same bytes", (from, to) => {
    expect(commitTerminalState({ progress: { state: "normal", percent: from } }, { progress: { state: "normal", percent: to } }, features).sends).toEqual([]);
  });

  it("re-sends everything against an empty terminal, as one that forgot it needs", () => {
    const { sends } = commitTerminalState(EMPTY_TERMINAL_STATE, { progress: { state: "paused", percent: 30 } }, features);
    expect(sends.map((send) => send.bytes)).toEqual(["\x1b]9;4;4;30\x1b\\"]);
  });
});

const ESC = "\x1b";
const EVIDENCE: readonly Evidence[] = ["declared", "confirmed", "identified", "inferred", "unknown"];
const FAILURES: readonly Failure[] = ["ignored", "garbage", "misread"];
const POLICIES: readonly TerminalPolicy[] = ["strict", "bestGuess"];
const ROUTES: readonly Route[] = ["native", "passthrough", "impossible"];

const encoding = (failure: Failure, route: Route): Encoding<string> => ({
  name: "TEST",
  terminals: ["iterm2"],
  failure,
  routes: { tmux: route, screen: route, zellij: route, editor: route },
  encode: (value) => `${ESC}]${value}${ESC}\\`,
});

describe("accepts", () => {
  it.each(POLICIES.flatMap((policy) => EVIDENCE.flatMap((evidence) => FAILURES.map((failure) => [policy, evidence, failure] as const))))(
    "%s on %s evidence for an encoding %s where unsupported",
    (policy, evidence, failure) => {
      const said = evidence === "declared" || evidence === "confirmed" || evidence === "identified";
      const guessed = evidence === "inferred" && policy === "bestGuess" && failure === "ignored";
      expect(accepts(policy, evidence, failure)).toBe(said || guessed);
    },
  );
});

describe("pick", () => {
  const cases = POLICIES.flatMap((policy) =>
    EVIDENCE.flatMap((terminal) =>
      FAILURES.flatMap((failure) => ROUTES.flatMap((route) => EVIDENCE.map((passthrough) => ({ policy, terminal, failure, route, passthrough })))),
    ),
  );

  it.each(cases)("$policy, terminal $terminal, $failure, $route through tmux whose passthrough is $passthrough", ({ policy, terminal, failure, route, passthrough }) => {
    const capabilities = { terminal: { name: "iterm2" as const, evidence: terminal, source: "LC_TERMINAL=iTerm2" }, declared: new Set<string>() };
    const layers: Layer[] = [{ kind: "tmux", passthrough }];
    const sent = pick({ name: "test", encodings: [encoding(failure, route)] }, "x", { capabilities, policy, layers });
    const reaches = route === "native" || (route === "passthrough" && accepts(policy, passthrough, "ignored"));
    const sends = accepts(policy, terminal, failure) && reaches;
    expect(sent.bytes).toBe(
      !sends ? undefined : route === "native" ? `${ESC}]x${ESC}\\` : `${ESC}Ptmux;${ESC}${ESC}]x${ESC}${ESC}\\${ESC}\\`,
    );
    expect(sent.reason).toMatch(sends ? /^TEST/ : /^fallback: TEST/);
  });

  it("wraps once per layer, innermost first, so tmux in tmux doubles every ESC twice", () => {
    const layers: Layer[] = [{ kind: "tmux", passthrough: "declared" }, { kind: "tmux", passthrough: "declared" }];
    const sent = pick({ name: "test", encodings: [encoding("ignored", "passthrough")] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers });
    const once = `${ESC}Ptmux;${ESC}${ESC}]x${ESC}${ESC}\\${ESC}\\`;
    expect(sent.bytes).toBe(`${ESC}Ptmux;${once.replaceAll(ESC, ESC + ESC)}${ESC}\\`);
    expect(sent.reason).toBe("TEST through tmux passthrough, tmux passthrough: declared by the program is declared, strict");
  });

  it("gives the layer the program writes to the outermost envelope, so tmux in screen is screen's DCS inside tmux's", () => {
    const layers: Layer[] = [{ kind: "tmux", passthrough: "declared" }, { kind: "screen", passthrough: "declared" }];
    const sent = pick({ name: "test", encodings: [encoding("ignored", "passthrough")] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers });
    const forScreen = `${ESC}P${ESC}]x\x07${ESC}\\`;
    expect(sent.bytes).toBe(`${ESC}Ptmux;${forScreen.replaceAll(ESC, ESC + ESC)}${ESC}\\`);
    expect(sent.reason).toBe("TEST through tmux passthrough, screen passthrough: declared by the program is declared, strict");
  });

  it("says why a sequence screen would cut is not sent", () => {
    const long: Encoding<string> = { ...encoding("ignored", "passthrough"), encode: () => "y".repeat(800) };
    const sent = pick({ name: "test", encodings: [long] }, "", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers: [{ kind: "screen", passthrough: "declared" }] });
    expect(sent).toEqual({ feature: "test", bytes: undefined, reason: "fallback: TEST: through screen: 800 bytes > 768" });
  });

  it.each<Intermediary>(["zellij", "editor"])("names %s as the layer a passthrough cannot cross", (kind) => {
    const sent = pick({ name: "test", encodings: [encoding("ignored", "impossible")] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers: [{ kind, passthrough: "declared" }] });
    expect(sent.reason).toBe(`fallback: TEST: ${kind} does not pass it`);
  });

  it("takes the first encoding the evidence allows, and falls past the rest", () => {
    const best = { ...encoding("misread", "native"), name: "BEST", encode: () => "best" };
    const plain = { ...encoding("ignored", "native"), name: "PLAIN", encode: () => "plain" };
    const capabilities = inferCapabilities(identifyTerminal({ TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" })).capabilities;
    const sent = pick({ name: "test", encodings: [best, plain] }, "", { capabilities, policy: "bestGuess", layers: [] });
    expect(sent.bytes).toBe("plain");
    expect(sent.reason).toBe("PLAIN: TERM_PROGRAM=iTerm.app is inferred, bestGuess");
  });
});

describe("a Progress in an App", () => {
  const later = () => new Promise((resolve) => setTimeout(resolve));

  async function run(writesToTerminal: boolean): Promise<{ log: TerminalSend[]; output: string }> {
    const log: TerminalSend[] = [];
    const host = { ...scriptedHost({ cols: 30, rows: 3 }), writesToTerminal };
    let progress: Progress | undefined;
    const app = new App({ host, surface: "inline", view: () => progress!, clock: fakeClock(0), terminalFeatures: { capabilities: declareCapabilities(["OSC 9;4"]), onSend: (send) => log.push(send) } });
    progress = new Progress({ drawnBy: app });
    progress.updateTask(progress.addTask("x", { total: 4 }), { completed: 1 });
    void app.run();
    await later();
    app.stop();
    await later();
    return { log, output: host.output() };
  }

  it("mirrors its tasks in OSC 9;4, as one drawn by a Live does", async () => {
    const { log, output } = await run(true);
    expect(log.map((send) => send.bytes)).toEqual([`${ESC}]9;4;1;25${ESC}\\`, `${ESC}]9;4;0${ESC}\\`]);
    expect(output).toContain(`${ESC}]9;4;1;25${ESC}\\`);
  });

  it("writes none of it to a host whose output is not a terminal", async () => {
    const { log, output } = await run(false);
    expect(output).not.toContain(`${ESC}]9;4`);
    expect(log[0]?.reason).toMatch(/^not sent: not a terminal/);
  });
});

describe("route", () => {
  it("refuses a wrapped sequence a native layer would have to carry", () => {
    const native = { ...encoding("ignored", "passthrough"), routes: { tmux: "passthrough", screen: "passthrough", zellij: "impossible", editor: "native" } as const };
    const layers: Layer[] = [{ kind: "editor", passthrough: "declared" }, { kind: "tmux", passthrough: "declared" }];
    const sent = pick({ name: "test", encodings: [native] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers });
    expect(sent).toEqual({ feature: "test", bytes: undefined, reason: "fallback: TEST: editor does not pass a wrapped sequence" });
  });

  it("refuses screen inside tmux, since screen would end tmux's envelope at its ST", () => {
    const layers: Layer[] = [{ kind: "screen", passthrough: "declared" }, { kind: "tmux", passthrough: "declared" }];
    const sent = pick({ name: "test", encodings: [encoding("ignored", "passthrough")] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers });
    expect(sent).toEqual({ feature: "test", bytes: undefined, reason: "fallback: TEST: screen cannot carry another layer's passthrough" });
  });

  it("trusts an inferred passthrough under bestGuess even for a misread encoding: a closed one only drops it", () => {
    const sent = pick({ name: "test", encodings: [encoding("misread", "passthrough")] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "bestGuess", layers: [{ kind: "tmux", passthrough: "inferred" }] });
    expect(sent.bytes).toBe(`${ESC}Ptmux;${ESC}${ESC}]x${ESC}${ESC}\\${ESC}\\`);
  });

  it("says a layer has no passthrough rather than blaming screen", () => {
    const sent = pick({ name: "test", encodings: [encoding("ignored", "passthrough")] }, "x", { capabilities: declareCapabilities(["TEST"], "other"), policy: "strict", layers: [{ kind: "zellij", passthrough: "declared" }] });
    expect(sent.reason).toBe("fallback: TEST: zellij has no passthrough");
  });
});

describe("identifyTerminal", () => {
  it("takes kitty's TERM beside an inherited TERM_PROGRAM for no named terminal, and WezTerm's borrowing for WezTerm", () => {
    expect(identifyTerminal({ TERM: "xterm-kitty", TERM_PROGRAM: "iTerm.app" }).terminal).toBe("other");
    expect(identifyTerminal({ TERM: "xterm-kitty", TERM_PROGRAM: "WezTerm" }).terminal).toBe("wezterm");
  });

  it("takes no inherited LC_TERMINAL for iTerm2 where a terminal names itself (VS Code started from iTerm2)", () => {
    expect(identifyTerminal({ TERM: "xterm-256color", TERM_PROGRAM: "vscode", LC_TERMINAL: "iTerm2" }).terminal).toBe("other");
    expect(identifyTerminal({ TERM: "tmux-256color", TMUX: "/tmp/t", TERM_PROGRAM: "tmux", LC_TERMINAL: "iTerm2" }).terminal).toBe("iterm2");
  });

  it.each(["constructor", "toString", "__proto__"])("names no terminal for TERM_PROGRAM=%s", (program) => {
    expect(identifyTerminal({ TERM: "xterm-256color", TERM_PROGRAM: program })).toEqual({ terminal: "other", intermediary: undefined, namedBy: undefined });
  });
});

describe("a Progress's terminal indicator", () => {
  function run(features: ConstructorParameters<typeof Console>[0]): TerminalSend[] {
    const log: TerminalSend[] = [];
    const console = new Console({ width: 30, colorSystem: null, forceTerminal: true, file: { write: () => {} }, environment: { env: { TERM: "xterm-256color" } }, ...features, terminalFeatures: { ...features?.terminalFeatures, onSend: (send) => log.push(send) } });
    const progress = new Progress({ console, clock: fakeClock(), autoRefresh: false });
    progress.start();
    const id = progress.addTask("x", { total: 4 });
    progress.updateTask(id, { completed: 2 });
    progress.refresh();
    progress.stop();
    return log;
  }

  it("mirrors the tasks in OSC 9;4 on a terminal declared to read it, and takes it away on hand-back", () => {
    const log = run({ terminalFeatures: { capabilities: declareCapabilities(["OSC 9;4"]) } });
    expect(log.map((send) => send.bytes)).toEqual([`${ESC}]9;4;1;50${ESC}\\`, `${ESC}]9;4;0${ESC}\\`]);
    expect(log[0]?.reason).toBe("OSC 9;4: declared by the program is declared, strict");
  });

  it("reaches the terminal through a tmux whose passthrough is declared on", () => {
    const log = run({ terminalFeatures: { capabilities: declareCapabilities(["OSC 9;4"]), layers: [{ kind: "tmux", passthrough: "declared" }] } });
    expect(log[0]?.bytes).toBe(`${ESC}Ptmux;${ESC}${ESC}]9;4;1;50${ESC}${ESC}\\${ESC}\\`);
  });

  it("sends nothing on the environment's word alone, under either policy, and says why", () => {
    for (const policy of POLICIES) {
      const log = run({ environment: { env: { TERM: "xterm-256color", TERM_PROGRAM: "iTerm.app" } }, terminalFeatures: { policy } });
      expect(log.every((send) => send.bytes === undefined)).toBe(true);
      expect(log[0]?.reason).toBe(`fallback: OSC 9;4 misread where unsupported; TERM_PROGRAM=iTerm.app is inferred, ${policy}`);
    }
  });
});
