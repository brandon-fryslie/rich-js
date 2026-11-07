/**
 * Contract of the chrome and cursor parts of the declared terminal state: the
 * title over the terminal's title stack, iTerm2's tab color, session status
 * and badge, and the cursor's color — what each change sends, what a policy
 * refuses, and that a reattach re-sends exactly what only a passthrough carried.
 *
 * [LAW:behavior-not-structure] Asserted on the bytes each commit decides.
 */

import { describe, expect, it } from "vitest";

import { ColorRgba } from "../../src/core/color.js";
import { declareCapabilities, type Layer, type TerminalFeatures } from "../../src/core/terminal-capabilities.js";
import { BADGE, CURSOR_COLOR, SESSION_STATUS, TAB_COLOR } from "../../src/core/terminal-requests.js";
import { NOTHING_COMMITTED, chromeState, commitTerminalState, declaredState, resendWrapped, type TerminalState } from "../../src/core/terminal-state.js";

const ESC = "\x1b";
const ST = `${ESC}\\`;
const purple = new ColorRgba(128, 0, 255);
const green = new ColorRgba(0, 200, 0);

type Deciding = Pick<TerminalFeatures, "capabilities" | "policy" | "layers">;

const iterm2 = (layers: readonly Layer[] = [], evidence: "declared" | "inferred" = "declared", policy: Deciding["policy"] = "strict"): Deciding => ({
  capabilities: evidence === "declared"
    ? declareCapabilities([], "iterm2")
    : { terminal: { name: "iterm2", evidence: "inferred", source: "LC_TERMINAL=iTerm2" }, declared: new Set() },
  policy,
  layers,
});
const xterm: Deciding = { capabilities: declareCapabilities([], "kitty"), policy: "strict", layers: [] };
const tmux: Layer = { kind: "tmux", evidence: "declared", passthrough: "declared" };

const bytes = (sends: readonly { bytes: string | undefined }[]): string => sends.map((send) => send.bytes ?? "").join("");

// Commits from nothing, each from the last, under the features each is handed: the bytes each decides.
function committer(): <P extends keyof TerminalState>(features: Deciding, wanted: Pick<TerminalState, P>) => string {
  let committed = NOTHING_COMMITTED;
  return (features, wanted) => {
    const { next, sends } = commitTerminalState(committed, wanted, features);
    committed = next;
    return bytes(sends);
  };
}

describe("the title", () => {
  it("pushes the terminal's title before the first one, sets later ones alone, and pops to give it back", () => {
    const commit = committer();
    expect([commit(xterm, chromeState({ title: "build" })), commit(xterm, chromeState({ title: "test" })), commit(xterm, chromeState({}))]).toEqual([
      `${ESC}[22;0t${ESC}]2;build${ST}`,
      `${ESC}]2;test${ST}`,
      `${ESC}[23;0t`,
    ]);
  });

  it("under tmux sets the pane's title natively, and cannot reach a stack to push or pop", () => {
    const commit = committer();
    const underTmux = { ...xterm, layers: [tmux] };
    expect([commit(underTmux, chromeState({ title: "build" })), commit(underTmux, chromeState({}))]).toEqual([`${ESC}]2;build${ST}`, ""]);
  });

  it("pops only a push that reached the terminal, though the features change between them", () => {
    const commit = committer();
    commit({ ...xterm, layers: [tmux] }, chromeState({ title: "build" }));
    expect(commit(xterm, chromeState({}))).toBe("");
  });

  it("refuses, at compile time, a named part a value its type does not hold", () => {
    // Type-checked by lint, never called.
    const unnamed = (): unknown =>
      // @ts-expect-error The pointer is always some shape: `undefined` is not one.
      commitTerminalState(NOTHING_COMMITTED, { pointer: undefined }, xterm);
    expect(unnamed).toBeTypeOf("function");
  });
});

describe("iTerm2's chrome", () => {
  it("writes the tab color one channel at a time, and resets it whole", () => {
    expect(TAB_COLOR.encodings[0]!.encode(purple)).toBe(
      `${ESC}]6;1;bg;red;brightness;128${ST}${ESC}]6;1;bg;green;brightness;0${ST}${ESC}]6;1;bg;blue;brightness;255${ST}`,
    );
    expect(TAB_COLOR.encodings[0]!.encode(undefined)).toBe(`${ESC}]6;1;bg;*;default${ST}`);
  });

  it("writes every status field, so a status replaces the last one whole, and clears it with every field empty", () => {
    expect(SESSION_STATUS.encodings[0]!.encode({ indicator: green, text: "3; failing" })).toBe(`${ESC}]21337;indicator=#00c800;status=3, failing;status-color=${ST}`);
    expect(SESSION_STATUS.encodings[0]!.encode(undefined)).toBe(`${ESC}]21337;indicator=;status=;status-color=${ST}`);
  });

  it("carries the badge as base64 of its UTF-8, with no control in it", () => {
    expect(BADGE.encodings[0]!.encode("café\x07")).toBe(`${ESC}]1337;SetBadgeFormat=Y2Fmw6k=${ST}`);
  });

  it("shows a badge's backslash as written, never as the start of an iTerm2 expression", () => {
    expect(BADGE.encodings[0]!.encode("\\(x)")).toBe(`${ESC}]1337;SetBadgeFormat=${btoa("\\\\(x)")}${ST}`);
  });

  it("is sent to iTerm2 and refused for any other terminal", () => {
    expect(committer()(iterm2(), { tabColor: purple })).toContain("]6;1;bg;red");
    expect(committer()(xterm, { tabColor: purple, badge: "prod" })).toBe("");
  });

  it("acts on an inferred iTerm2 only under bestGuess", () => {
    expect(committer()(iterm2([], "inferred"), { badge: "prod" })).toBe("");
    expect(committer()(iterm2([], "inferred", "bestGuess"), { badge: "prod" })).toContain("SetBadgeFormat");
  });

  it("crosses tmux inside its passthrough envelope", () => {
    expect(committer()(iterm2([tmux]), { badge: "prod" })).toBe(`${ESC}Ptmux;${ESC}${ESC}]1337;SetBadgeFormat=cHJvZA==${ESC}${ESC}\\${ST}`);
  });
});

describe("the cursor's color", () => {
  it("is OSC 12 to any terminal, OSC 112 to give the terminal's back, and native through tmux", () => {
    expect(CURSOR_COLOR.encodings[0]!.encode(purple)).toBe(`${ESC}]12;#8000ff${ST}`);
    const commit = committer();
    const underTmux = { ...xterm, layers: [tmux] };
    expect([commit(underTmux, { cursorColor: purple }), commit(underTmux, { cursorColor: undefined })]).toEqual([`${ESC}]12;#8000ff${ST}`, `${ESC}]112${ST}`]);
  });

  it("is sent alpha-free, and a translucent twin is the same color", () => {
    const commit = committer();
    expect([commit(xterm, { cursorColor: purple }), commit(xterm, { cursorColor: new ColorRgba(128, 0, 255, 0.5) })]).toEqual([`${ESC}]12;#8000ff${ST}`, ""]);
  });
});

describe("a frame's declarations", () => {
  it("fold field by field, the last of each winning, and a field none declares is the terminal's own", () => {
    const state = declaredState([
      { kind: "chrome", chrome: { title: "a", badge: "b" } },
      { kind: "chrome", chrome: { title: "c" } },
      { kind: "cursor", color: green },
    ]);
    expect(state).toMatchObject({ title: "c", badge: "b", tabColor: undefined, status: undefined, cursorColor: green });
  });
});

describe("a reattach", () => {
  it("re-sends what only a passthrough carried, and neither the title nor what tmux keeps itself", () => {
    const features = iterm2([tmux]);
    const { next } = commitTerminalState(NOTHING_COMMITTED, { ...chromeState({ title: "build", tabColor: purple }), cursorColor: green }, features);
    const resent = resendWrapped(next, features);
    expect(resent.sends.map((send) => send.feature)).toEqual(["tab color"]);
    expect(bytes(resent.sends)).toContain(`${ESC}Ptmux;`);
    expect(resent.next.sent).toEqual(next.sent);
  });

  it("re-sends nothing on a bare terminal, which forgets nothing", () => {
    const features = iterm2();
    const { next } = commitTerminalState(NOTHING_COMMITTED, { tabColor: purple, badge: "prod" }, features);
    expect(resendWrapped(next, features).sends).toEqual([]);
  });
});
