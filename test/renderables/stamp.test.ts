import { describe, expect, it } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { ColorDepth } from "../../src/core/color.js";
import { EASES, beat, firstReaching } from "../../src/core/easing.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Style } from "../../src/core/style.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Timeline } from "../../src/core/timeline.js";
import { drawView, hostView } from "../../src/core/view.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/index.js";
import { crossfade } from "../../src/renderables/change.js";
import { dissolveOut, fadeIn, onBeat } from "../../src/renderables/effects.js";
import { drawnAt, inFrame } from "./in-frame.js";
import { Group } from "../../src/renderables/group.js";
import { lifecycle, throughColors } from "../../src/renderables/lifecycle.js";
import { Spinner } from "../../src/renderables/spinner.js";

// [LAW:behavior-not-structure] What is asserted is what a host reads: the
// moment a drawn frame says it next changes, on the host's clock — and that a
// frame with no cells takes no row. Each wake is pinned exactly, so a
// spurious early wake fails as surely as a late one.

const theme = DEFAULT_TERMINAL_THEME;
const OPTIONS: RenderOptions = { maxWidth: 40, colorSystem: ColorDepth.TRUECOLOR };
const curve = { seconds: 2, ease: EASES.linear, swing: 1 };
const draw = (renderable: Renderable): Segment[] => [...render(renderable, OPTIONS)];
const lines = (renderable: Renderable): Segment[][] => Segment.splitLines(draw(renderable));
const bytes = (segments: Segment[]): string => segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true, reducedMotion: false });
/** What a renderable drawing what `view` makes for its frame's time, drawn at host time `t` on a playing timeline, says. */
const wakes = (view: (t: number) => Renderable, t: number): number =>
  drawView({ render: (options) => render(view(options.frame!.time), options) }, { now: t, epoch: 0, timeline: Timeline.play(0) }, {}, OPTIONS, (renderable, options) =>
    Segment.splitLines([...render(renderable, options)]),
  ).nextChange;

describe("a frame hands what it draws the time it is drawn for", () => {
  // What a renderable drawing at the frame's time would read, captured as it draws.
  const handed = (view: Parameters<typeof hostView>[0], timeline: Timeline, host: number): number | undefined => {
    let seen: number | undefined;
    drawView(hostView(view), { now: host, epoch: 0, timeline }, {}, OPTIONS, (renderable, options) => {
      seen = options.frame?.time;
      return lines(renderable);
    });
    return seen;
  };
  const probe = new RichText("x");

  it("is the timeline's time for every view, a paused one's held time included", () => {
    expect(handed(probe, Timeline.pause(Timeline.play(0), 1), 7)).toBe(1);
    expect(handed(() => probe, Timeline.play(2), 7)).toBe(5);
    expect(handed(Animation.constant(probe), Timeline.play(2, 2), 7)).toBe(10);
    expect(handed(() => probe, Timeline.pause(Timeline.play(0), 1), 7)).toBe(1);
  });
});

describe("a frame says when it changes on the host's clock", () => {
  it("a paused timeline over a change mid-way says it never changes, whatever the change's cells would say", () => {
    const moving = crossfade(curve).effect({ from: new RichText("building"), to: new RichText("done"), theme });
    const paused = Timeline.pause(Timeline.play(0), 1);
    const view = (t: number) => inFrame(Timeline.run(paused, moving), t);
    for (const t of [1, 1.5, 30]) {
      expect(Segment.nextChange(draw(view(t)))).toBe(Number.POSITIVE_INFINITY);
      expect(wakes(view, t)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("a lifecycle arriving through a stepped fade wakes on the beats, on the host's clock", () => {
    const steps = beat([0.25]);
    const life = lifecycle(new RichText("a line", { style: "cyan" }), { enter: throughColors(onBeat(fadeIn(curve, 0), steps), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "line" }, 5);
    // The first host moment the time since entering reaches the beat's edge.
    const edge = (local: number) => firstReaching(5 + local, (x) => x - 5 >= local);
    expect(Segment.nextChange(draw(inFrame(life, 5.1)))).toBe(edge(0.25));
    expect(Segment.nextChange(draw(inFrame(life, 5.3)))).toBe(edge(0.5));
    expect(wakes((t) => inFrame(life, t), 5.1)).toBe(edge(0.25));
    // Played at twice the rate, the beats come twice as often on the host's clock.
    const fast = Timeline.run(Timeline.play(0, 2), life);
    const said = Segment.nextChange(draw(inFrame(fast, 2.55)));
    expect(said).toBe(fast.nextChange(2.55));
    expect(said).toBeGreaterThan(2.55);
    expect(said).toBeLessThanOrEqual(2.625);
  });

  it("nothing an animation's at returns says when it changes; placed, the animation does", () => {
    const life = lifecycle(new RichText("a line"), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "line" }, 1).leave(5);
    const moving = crossfade(curve).effect({ from: new RichText("building"), to: new RichText("done"), theme });
    const spinner = new Spinner("dots", "working");
    const animations: Animation<Renderable>[] = [life, moving, spinner];
    for (const animation of animations) {
      for (const t of [0.5, 1.5, 3, 5.5]) {
        expect(Segment.nextChange(draw(animation.at(t)))).toBe(Number.POSITIVE_INFINITY);
        const placed = [...render(animation, { ...OPTIONS, frame: { time: t, host: {} } })];
        expect(Segment.nextChange(placed)).toBeGreaterThanOrEqual(animation.nextChange(t));
      }
    }
  });

  it("content that changes on its own still says so inside a lifecycle", () => {
    const blinking = Animation.continuous(() => new RichText("x"));
    const ticking: Renderable = { render: (options) => render(inFrame(blinking, 7.25), options) };
    const life = lifecycle(ticking, { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "tick" }, 1);
    expect(Segment.nextChange(draw(inFrame(life, 4)))).toBe(7.25);
  });

  it("a frame with no cells takes no row of its own, and still says when it changes", () => {
    const empty: Animation<Renderable> = Animation.of({ at: () => new Group(), nextChange: () => 3, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => Animation.constant<Renderable>(new Group()) });
    const drawn = drawnAt(new Group(new RichText("a"), empty), 0, OPTIONS);
    expect(drawn.lines).toEqual(lines(new Group(new RichText("a"))));
    expect(drawn.nextChange).toBe(3);
    // Drawn alone there is no row before it, and it takes none of its own.
    const alone = drawnAt(empty, 0, OPTIONS);
    expect(alone.lines).toEqual([]);
    expect(alone.nextChange).toBe(3);
  });

  it("a frame with no cells still says when it changes after the row before it is cropped", () => {
    const empty: Animation<Renderable> = Animation.of({ at: () => new Group(), nextChange: () => 3, lastChange: () => Number.NEGATIVE_INFINITY, reduced: () => Animation.constant<Renderable>(new Group()) });
    const wide = new RichText("x".repeat(30), { noWrap: true, overflow: "crop" });
    const cropped = drawView(hostView(new Group(wide, empty)), { now: 0, epoch: 0, timeline: Timeline.play(0) }, {}, OPTIONS, (r, under) =>
      Segment.splitAndCropLines(render(r, under), 5),
    );
    expect(cropped.nextChange).toBe(3);
    const emptyText = new Segment("", new Style({ hold: { lastChange: 0, nextChange: 2 } }));
    for (const line of [[new Segment("ab"), emptyText, new Segment("cd")], [new Segment("abcd"), emptyText]]) {
      expect(Segment.nextChange(Segment.adjustLineLength(line, 2))).toBe(2);
    }
  });

  it("an element takes no row before it enters or once it is gone, though gone it never changes again", () => {
    const life = lifecycle(new RichText("x"), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "x" }, 10).leave(100);
    const alone = lines(new Group(new RichText("top"))).length;
    for (const t of [5, 200]) expect(lines(new Group(new RichText("top"), inFrame(life, t))).length).toBe(alone);
    expect(life.nextChange(200)).toBe(Number.POSITIVE_INFINITY);
  });

  it("a change ends its last row as the renderable it changes to does, whatever that ends with", () => {
    const pending = lifecycle(new RichText("x"), { enter: throughColors(fadeIn(curve, 0), theme), exit: throughColors(dissolveOut(curve, 0), theme), key: "x" }, 10);
    const to = new Group(new RichText("bbb"), inFrame(pending, 0));
    const moving = crossfade(curve).effect({ from: new RichText("aaa"), to, theme });
    const rows = (renderable: Renderable) => lines(new Group(renderable, new RichText("next"))).length;
    expect(rows(inFrame(moving, 1))).toBe(rows(to));
  });

  it("an empty text frame keeps its stamp and writes the bytes and rows an unstamped one does", () => {
    for (const end of ["\n", ""]) {
      const frame = new RichText("", { end });
      const blink: Animation<RichText> = Animation.of({ at: () => frame, nextChange: () => 2, lastChange: () => 1, reduced: () => Animation.constant(frame) });
      const stamped = new Group(new RichText("top"), inFrame(blink, 1.5));
      const plain = new Group(new RichText("top"), frame);
      expect(Segment.nextChange(draw(stamped))).toBe(2);
      expect(bytes(draw(stamped))).toBe(bytes(draw(plain)));
      expect(lines(stamped).length).toBe(lines(plain).length);
    }
  });
});
