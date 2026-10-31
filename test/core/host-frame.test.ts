/**
 * Contract of a frame's time (rich-animation-27tq.bpd): a host hands out the
 * frame it would draw now, `frameNow()`, only between frames; a frame carries
 * one time and an identity with nothing to read; a print is drawn for the
 * frame its caller names, or for 0; and a `Progress`, whose tasks are timed on
 * its host's clock, refuses a print that names no frame rather than draw a
 * moment its tasks never saw.
 *
 * [LAW:behavior-not-structure] Asserted through what is drawn and what
 * throws, never through which function read the clock.
 */

import { describe, expect, it } from "vitest";

import { Animation } from "../../src/core/animation.js";
import { Console } from "../../src/core/console.js";
import { beat } from "../../src/core/easing.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { RichText } from "../../src/core/text.js";
import { RenderClockError } from "../../src/core/view.js";
import { App } from "../../src/host/app.js";
import { Live } from "../../src/renderables/live.js";
import { Progress, TextColumn, TimeElapsedColumn } from "../../src/renderables/progress.js";
import { scriptedHost } from "../host/scripted-host.js";
import { fakeClock } from "./fake-clock.js";

const OPTS: RenderOptions = { maxWidth: 40, isTerminal: false, asciiOnly: false };
const quiet = (): Console => new Console({ file: { write: () => {} }, colorSystem: null, width: 40 });
const textOf = (renderable: Renderable, options: RenderOptions): string => [...render(renderable, options)].map((segment) => segment.text).join("").trim();
/** `console.print(...args)` as the text it writes: the recording, which the export empties. */
const printed = (console: Console, ...args: unknown[]): string => {
  console.print(...args);
  return console.exportText();
};

describe("a host's frame is read between frames, never in one", () => {
  it("a Live hands out the frame it draws now, and refuses inside a render", () => {
    const clock = fakeClock(10);
    const live = new Live(new RichText("x"), { console: quiet(), clock });
    expect(live.frameNow()).toEqual({ time: 0, host: live });
    clock.advance(2.5);
    expect(live.frameNow().time).toBe(2.5);
    const asking: Renderable = { render: () => { live.frameNow(); return []; } };
    expect(() => [...render(asking, OPTS)]).toThrow(RenderClockError);
  });

  it("an App does the same", () => {
    const clock = fakeClock(0);
    const app = new App({ host: scriptedHost({ cols: 20, rows: 2 }), surface: "inline", view: new RichText("x"), clock });
    expect(app.frameNow()).toEqual({ time: 0, host: app });
    const asking: Renderable = { render: () => { app.frameNow(); return []; } };
    expect(() => [...render(asking, OPTS)]).toThrow(RenderClockError);
  });

  it("a frame's host is an identity with nothing to read", () => {
    const probe: Renderable = {
      render: (options) => {
        // @ts-expect-error a frame has one time, and its host carries no second one
        options.frame?.host.frameNow();
        return [];
      },
    };
    expect(probe).toBeDefined();
  });
});

describe("a print is drawn in the frame its caller names", () => {
  const a = new RichText("a");
  const b = new RichText("b");
  const steps = Animation.map(beat([1, 1]), (i) => (i === 0 ? a : b));

  it("at the frame's time, or at 0 with none", () => {
    const console = new Console({ file: { write: () => {} }, colorSystem: null, width: 10, record: true });
    expect(printed(console, steps, { frame: { time: 1.5, host: {} } })).toBe("b\n");
    expect(printed(console, steps)).toBe("a\n");
  });
});

describe("a Progress is printed in its host's frame", () => {
  const timed = (clock = fakeClock(0)): Progress => new Progress(new TextColumn("{task.description}"), new TimeElapsedColumn(), { console: quiet(), clock });

  it("refuses a print that names no frame, and says how to print it", () => {
    const progress = timed();
    progress.addTask("job");
    expect(() => textOf(progress, OPTS)).toThrow(/console\.print\(progress, \{ frame: progress\.frameNow\(\) \}\)/);
  });

  it("drawn in its frame, shows the moment the program asked at, and the same bytes for one frame however the clock moves", () => {
    const clock = fakeClock(0);
    const progress = timed(clock);
    progress.addTask("job");
    clock.advance(3);
    const frame = progress.frameNow();
    expect(textOf(progress, { ...OPTS, frame })).toBe("job 0:00:03");
    clock.advance(4);
    expect(textOf(progress, { ...OPTS, frame })).toBe("job 0:00:03");
    expect(textOf(progress, { ...OPTS, frame: progress.frameNow() })).toBe("job 0:00:07");
  });
});
