/**
 * Pins the animation playground's controls to the one timeline they act
 * through, and its preferences to the app they rebuild: driven as a person
 * drives it, by clicks on what the screen shows, on a clock the test moves.
 * The screen is xterm's model of what the playground wrote.
 */
import { afterEach, describe, expect, it } from "vitest";
import xterm from "@xterm/headless";
import { run } from "../../../examples/animation-playground/playground.js";
import { KINDS } from "../../../examples/animation-playground/kinds.js";
import { fakeClock, type FakeClock } from "../../core/fake-clock.js";
import { scriptedHost, type ScriptedHost } from "../../host/scripted-host.js";
import type { Env } from "../../../src/core/env.js";
import { render } from "../../../src/core/protocol.js";
import { inFrame } from "../../renderables/in-frame.js";

const painted = () => new Promise((resolve) => setTimeout(resolve));

interface Playground {
  readonly clock: FakeClock;
  readonly host: ScriptedHost;
  /** The screen now, a string a row. */
  screen(): Promise<string[]>;
  /** A left click on the middle of the first place `label` is shown. */
  click(label: string): Promise<void>;
  /** A left click on cell `col`, `row` (from 0). */
  clickAt(col: number, row: number): Promise<void>;
  /** The clock moved on by `seconds`, and what that painted taken in. */
  advance(seconds: number): Promise<void>;
  /** The animation time the readout shows. */
  time(): Promise<number>;
  stop(): Promise<void>;
}

let open: Playground | undefined;
afterEach(async () => {
  await open?.stop();
  open = undefined;
});

async function playground(size = { cols: 120, rows: 40 }, env: Env = { TERM: "xterm-256color" }): Promise<Playground> {
  const clock = fakeClock(100);
  const host: ScriptedHost = { ...scriptedHost(size), env };
  const term = new xterm.Terminal({ ...size, allowProposedApi: true });
  let fed = 0;
  let failure: unknown;
  const running = run(host, clock).catch((error: unknown) => {
    failure = error;
  });
  const screen = async (): Promise<string[]> => {
    await painted();
    if (failure !== undefined) throw failure;
    const out = host.output();
    await new Promise<void>((resolve) => term.write(out.slice(fed), resolve));
    fed = out.length;
    const buffer = term.buffer.active;
    return Array.from({ length: size.rows }, (_, i) => buffer.getLine(buffer.viewportY + i)!.translateToString(true));
  };
  const clickAt = async (col: number, row: number): Promise<void> => {
    host.type(`\x1b[<0;${col + 1};${row + 1}M`);
    host.type(`\x1b[<0;${col + 1};${row + 1}m`);
    await painted();
  };
  const shown: Playground = {
    clock,
    host,
    screen,
    clickAt,
    async click(label) {
      const rows = await screen();
      const row = rows.findIndex((line) => line.includes(label));
      expect(row, `"${label}" is not on the screen:\n${rows.join("\n")}`).toBeGreaterThanOrEqual(0);
      await clickAt(rows[row]!.indexOf(label) + Math.floor(label.length / 2), row);
    },
    async advance(seconds) {
      clock.advance(seconds);
      await screen();
    },
    async time() {
      const said = (await screen()).join("\n").match(/t = (-?[\d,]+\.\d) s/);
      expect(said, "the readout shows no time").not.toBeNull();
      return Number(said![1]!.replaceAll(",", ""));
    },
    async stop() {
      host.type("\x03");
      await running;
      term.dispose();
      if (failure !== undefined) throw failure;
    },
  };
  open = shown;
  await screen();
  return shown;
}

/** The rows under the controls: the gallery of kinds. */
const gallery = (rows: readonly string[]): string => rows.slice(5).join("\n");

/** Every SGR parameter that sets a colour, in what was written. */
function colourParameters(written: string): string[] {
  const found: string[] = [];
  for (const [, params] of written.matchAll(/\x1b\[([\d;:]*)m/g)) {
    for (const p of params!.split(/[;:]/)) {
      const n = Number(p);
      if ((n >= 30 && n <= 49) || (n >= 90 && n <= 107)) found.push(p);
    }
  }
  return found;
}

describe("animation playground", () => {
  it("draws every kind, and the TextInput, at the start, after a few seconds, and near a million seconds", async () => {
    const p = await playground({ cols: 120, rows: 90 });
    const titled = async (): Promise<void> => {
      const shown = (await p.screen()).join("\n");
      for (const name of [...KINDS.map((kind) => kind.name), "TextInput · its caret"]) expect(shown).toContain(name);
    };
    await titled();
    // At one frame a second, so the half minute played below is a frame a
    // second and not 1,800 frames of the whole gallery the test never reads.
    // Sixty frames a second is pinned by the tests that read motion.
    await p.click("frame rate");
    expect((await p.screen()).join("\n")).toContain("1 fps");
    await p.advance(7.5);
    await titled();
    await p.click("seek 999 990 s");
    expect(await p.time()).toBe(999_990);
    await titled();
    // The seek fell half a second after a frame, so every frame after it is
    // drawn half a second past a whole one, where a beat is mid-phase.
    await p.advance(25);
    expect(await p.time()).toBe(1_000_014.5);
    await titled();
  });

  it("paused, the clock moves and nothing is painted; played, the time goes on from where it held", async () => {
    const p = await playground();
    await p.advance(2);
    await p.click("play / pause");
    const held = await p.time();
    const written = p.host.output().length;
    await p.advance(5);
    expect(p.host.output().length).toBe(written);
    expect(await p.time()).toBe(held);
    await p.click("play / pause");
    await p.advance(1);
    expect(await p.time()).toBeCloseTo(held + 1, 0);
  });

  it("reverses, and plays at a quarter and four times the speed, through the one timeline", async () => {
    const p = await playground();
    await p.advance(10);
    await p.click("reverse");
    const from = await p.time();
    await p.advance(4);
    expect(await p.time()).toBeCloseTo(from - 4, 0);
    expect((await p.screen()).join("\n")).toContain("in reverse");
    await p.click("4×");
    await p.advance(1);
    expect(await p.time()).toBeCloseTo(from - 8, 0);
    await p.click("0.25×");
    await p.click("reverse");
    await p.advance(4);
    expect(await p.time()).toBeCloseTo(from - 7, 0);
  });

  it("steps five seconds either way, and a press on the scrub bar seeks to the time under it", async () => {
    const p = await playground();
    await p.click("play / pause");
    await p.click("+5 s");
    expect(await p.time()).toBe(5);
    await p.click("−5 s");
    await p.click("−5 s");
    expect(await p.time()).toBe(-5);
    await p.click("+5 s");
    // The track runs from the left label of the window `t` is in to its right; a cell is half a second.
    const rows = await p.screen();
    const row = rows.findIndex((line) => line.includes("●"));
    const left = rows[row]!.search(/[━●]/);
    await p.clickAt(left + 41, row);
    expect(await p.time()).toBe(20.8);
  });

  it("with motion reduced nothing moves between frames, where with full motion the gallery does, and the time goes on across the rebuild", async () => {
    const p = await playground();
    // Ten seconds on, past every turn's start, and 0.05 s clear of every turn, hold and step either side.
    await p.advance(10.02);
    const moving = gallery(await p.screen());
    await p.advance(0.05);
    expect(gallery(await p.screen())).not.toBe(moving);
    await p.stop();

    const q = await playground();
    await q.click("reduced motion");
    expect((await q.screen()).join("\n")).toContain("motion reduced");
    await q.advance(10.02 - (await q.time()));
    const still = gallery(await q.screen());
    await q.advance(0.05);
    expect(gallery(await q.screen())).toBe(still);
    await q.stop();
  });

  it("asks its terminal for sixteen colours and then none, through the host's environment", async () => {
    const p = await playground();
    await p.click("colour depth");
    expect((await p.screen()).join("\n")).toContain("16 colours");
    let from = p.host.output().length;
    await p.advance(3);
    expect(p.host.output().slice(from)).not.toMatch(/\x1b\[[\d;]*[34]8;[25];/);
    await p.click("colour depth");
    expect((await p.screen()).join("\n")).toContain("no colour");
    from = p.host.output().length;
    await p.advance(3);
    expect(colourParameters(p.host.output().slice(from))).toEqual([]);
  });

  it("marches the border's ants clockwise: right along the top, left along the bottom", () => {
    const kind = KINDS.find((k) => k.name === "marching border")!;
    const drawn = (t: number): string[] =>
      [...render(inFrame(kind.view, t), { maxWidth: 80, colorSystem: null })]
        .map((s) => s.text)
        .join("")
        .split("\n")
        .filter((line) => line !== "");
    const [before, after] = [drawn(0.01), drawn(0.16)];
    const [top, bottom] = [0, before.length - 1];
    // Left of the title along the top, and the whole bottom edge between its corners.
    expect(after[top]!.slice(2, 6)).toBe(before[top]!.slice(1, 5));
    const width = before[bottom]!.length;
    expect(after[bottom]!.slice(1, width - 2)).toBe(before[bottom]!.slice(2, width - 1));
  });

  it("with motion reduced, the narrow marquee holds its word in view", async () => {
    const p = await playground({ cols: 120, rows: 90 });
    await p.click("reduced motion");
    const line = (await p.screen()).find((l) => l.includes("narrow marquee"));
    expect(line).toMatch(/narrow marquee\s+hi/);
  });

  it("starts at the colours its terminal's environment says", async () => {
    const p = await playground(undefined, { TERM: "xterm-256color", NO_COLOR: "1" });
    expect((await p.screen()).join("\n")).toContain("terminal's own colours");
    const from = p.host.output().length;
    await p.advance(3);
    expect(colourParameters(p.host.output().slice(from))).toEqual([]);
  });

  it("at eighty columns the controls wrap and push the gallery down, and the readout stays on screen", async () => {
    const p = await playground({ cols: 80, rows: 30 });
    const rows = await p.screen();
    expect(rows.join("\n")).toMatch(/t = [\d,]+\.\d s/);
    expect(rows.join("\n")).toContain("tween · a counter");
    await p.click("+5 s");
    expect(await p.time()).toBeCloseTo(5, 0);
  });

  it("keeps what was typed and the control in focus across a rebuild", async () => {
    const p = await playground();
    p.host.type("hello");
    expect((await p.screen()).join("\n")).toContain("hello");
    await p.click("reduced motion");
    expect((await p.screen()).join("\n")).toContain("motion reduced");
    expect((await p.screen()).join("\n")).toContain("hello");
    // The focus is still on the button pressed: Enter presses it again, in the new app.
    p.host.type("\r");
    expect((await p.screen()).join("\n")).toContain("full motion");
  });

  it("a press on the scrub bar seeks into the window the frame on screen showed, not the one the time has since moved to", async () => {
    const p = await playground();
    await p.click("4×");
    await p.click("frame rate");
    await p.advance(7);
    expect(await p.time()).toBeLessThan(30);
    // Under a frame's interval: the timeline is past 30, the frame still shows the window from 0.
    p.clock.advance(0.9);
    const rows = await p.screen();
    const row = rows.findIndex((line) => line.includes("●"));
    await p.clickAt(rows[row]!.search(/[━●]/), row);
    expect(await p.time()).toBeCloseTo(0.25, 0);
  });

  it("paints at one frame a second when asked, and quits", async () => {
    const p = await playground();
    await p.click("frame rate");
    expect((await p.screen()).join("\n")).toContain("1 fps");
    await p.advance(3);
    expect(await p.time()).toBeCloseTo(3, 0);
    await p.click("quit");
    open = undefined;
    await p.stop();
  });
});
