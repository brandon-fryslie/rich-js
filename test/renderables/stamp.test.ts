import { describe, expect, it } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { ColorDepth } from "../../src/core/color.js";
import { EASES, beat, firstReaching } from "../../src/core/easing.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { segmentsToString } from "../../src/core/render.js";
import { Segment } from "../../src/core/segment.js";
import { RichText } from "../../src/core/text.js";
import { Timeline } from "../../src/core/timeline.js";
import { drawView, hostView } from "../../src/core/view.js";
import { DEFAULT_TERMINAL_THEME } from "../../src/index.js";
import { crossfade } from "../../src/renderables/change.js";
import { dissolveOut, fadeIn, onBeat } from "../../src/renderables/effects.js";
import { frameAt } from "../../src/renderables/frames.js";
import { Group } from "../../src/renderables/group.js";
import { lifecycle } from "../../src/renderables/lifecycle.js";
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
const bytes = (segments: Segment[]): string => segmentsToString(segments, { colorSystem: ColorDepth.TRUECOLOR, hyperlinks: true });
/** What a function view of `view` drawn at host time `t` on a playing timeline says. */
const wakes = (view: (t: number) => Renderable, t: number): number => drawView(hostView(view), Timeline.play(0), t, lines).nextChange;

describe("a frame says when it changes on the host's clock", () => {
  it("a paused timeline over a change mid-way says it never changes, whatever the change's cells would say", () => {
    const moving = crossfade(curve).effect({ from: new RichText("building"), to: new RichText("done"), theme });
    const paused = Timeline.pause(Timeline.play(0), 1);
    const view = (t: number) => frameAt(Timeline.run(paused, moving), t);
    for (const t of [1, 1.5, 30]) {
      expect(Segment.nextChange(draw(view(t)))).toBe(Number.POSITIVE_INFINITY);
      expect(wakes(view, t)).toBe(Number.POSITIVE_INFINITY);
    }
  });

  it("a lifecycle arriving through a stepped fade wakes on the beats, on the host's clock", () => {
    const steps = beat([0.25]);
    const life = lifecycle(new RichText("a line", { style: "cyan" }), { enter: onBeat(fadeIn(curve, 0), steps), exit: dissolveOut(curve, 0), key: "line", theme }, 5);
    // The first host moment the time since entering reaches the beat's edge.
    const edge = (local: number) => firstReaching(5 + local, (x) => x - 5 >= local);
    expect(Segment.nextChange(draw(frameAt(life, 5.1)))).toBe(edge(0.25));
    expect(Segment.nextChange(draw(frameAt(life, 5.3)))).toBe(edge(0.5));
    expect(wakes((t) => frameAt(life, t), 5.1)).toBe(edge(0.25));
    // Played at twice the rate, the beats come twice as often on the host's clock.
    const fast = Timeline.run(Timeline.play(0, 2), life);
    const said = Segment.nextChange(draw(frameAt(fast, 2.55)));
    expect(said).toBe(fast.nextChange(2.55));
    expect(said).toBeGreaterThan(2.55);
    expect(said).toBeLessThanOrEqual(2.625);
  });

  it("nothing an animation's at returns says when it changes; the animation does, and frameAt carries it", () => {
    const life = lifecycle(new RichText("a line"), { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "line", theme }, 1).leave(5);
    const moving = crossfade(curve).effect({ from: new RichText("building"), to: new RichText("done"), theme });
    const spinner = new Spinner("dots", "working");
    const animations: Animation<Renderable>[] = [life, moving, spinner];
    for (const animation of animations) {
      for (const t of [0.5, 1.5, 3, 5.5]) {
        expect(Segment.nextChange(draw(animation.at(t)))).toBe(Number.POSITIVE_INFINITY);
        expect(Segment.nextChange(draw(frameAt(animation, t)))).toBe(animation.nextChange(t));
      }
    }
  });

  it("content that changes on its own still says so inside a lifecycle", () => {
    const blinking = Animation.continuous(() => new RichText("x"));
    const ticking: Renderable = { render: (options) => render(frameAt(blinking, 7.25), options) };
    const life = lifecycle(ticking, { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "tick", theme }, 1);
    expect(Segment.nextChange(draw(frameAt(life, 4)))).toBe(7.25);
  });

  it("a frame with no cells takes no row of its own, and still says when it changes", () => {
    const empty: Animation<Renderable> = { at: () => new Group(), nextChange: () => 3, lastChange: () => Number.NEGATIVE_INFINITY };
    const drawn = lines(new Group(new RichText("a"), frameAt(empty, 0)));
    expect(drawn.length).toBe(lines(new Group(new RichText("a"))).length);
    expect(Segment.nextChange(drawn.flat())).toBe(3);
  });

  it("a frame with no cells still says when it changes after the row before it is cropped", () => {
    const empty: Animation<Renderable> = { at: () => new Group(), nextChange: () => 3, lastChange: () => Number.NEGATIVE_INFINITY };
    const wide = new RichText("x".repeat(30), { noWrap: true, overflow: "crop" });
    const cropped = Segment.splitAndCropLines(draw(new Group(wide, frameAt(empty, 0))), 5);
    expect(Segment.nextChange(cropped.flat())).toBe(3);
  });

  it("an element takes no row before it enters or once it is gone, though gone it never changes again", () => {
    const life = lifecycle(new RichText("x"), { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "x", theme }, 10).leave(100);
    const alone = lines(new Group(new RichText("top"))).length;
    for (const t of [5, 200]) expect(lines(new Group(new RichText("top"), frameAt(life, t))).length).toBe(alone);
    expect(life.nextChange(200)).toBe(Number.POSITIVE_INFINITY);
  });

  it("a change ends its last row as the renderable it changes to does, whatever that ends with", () => {
    const pending = lifecycle(new RichText("x"), { enter: fadeIn(curve, 0), exit: dissolveOut(curve, 0), key: "x", theme }, 10);
    const to = new Group(new RichText("bbb"), frameAt(pending, 0));
    const moving = crossfade(curve).effect({ from: new RichText("aaa"), to, theme });
    const rows = (renderable: Renderable) => lines(new Group(renderable, new RichText("next"))).length;
    expect(rows(frameAt(moving, 1))).toBe(rows(to));
  });

  it("an empty text frame keeps its stamp and writes the bytes and rows an unstamped one does", () => {
    for (const end of ["\n", ""]) {
      const frame = new RichText("", { end });
      const blink: Animation<RichText> = { at: () => frame, nextChange: () => 2, lastChange: () => 1 };
      const stamped = new Group(new RichText("top"), frameAt(blink, 1.5));
      const plain = new Group(new RichText("top"), frame);
      expect(Segment.nextChange(draw(stamped))).toBe(2);
      expect(bytes(draw(stamped))).toBe(bytes(draw(plain)));
      expect(lines(stamped).length).toBe(lines(plain).length);
    }
  });
});
