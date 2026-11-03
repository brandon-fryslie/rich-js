/**
 * The playground's controls: the widgets, the rows they sit in, and what each
 * playback button does to the timeline.
 *
 * THIS IS A DEMO (`examples/animation-playground/`). The widgets are made once
 * and outlive every app the playground builds, so a rebuild keeps what was
 * typed, where the gallery was scrolled to, and which control has focus.
 *
 * [LAW:one-source-of-truth] Playback is the app's `Timeline` and nothing
 * else: every playback button is one `Timeline` operation at the clock's now.
 */
import { SCROLLBAR, Table, Timeline, Viewport, type Renderable } from "@promptctl/rich-js";
import { Button, TextInput, type ButtonVariant } from "@promptctl/rich-js/widgets";
import { ScrubBar } from "./scrub.js";

const button = (label: string, variant: ButtonVariant = "default"): Button => new Button({ label, variant });

/** Every widget the playground shows. */
export function controls() {
  return {
    playPause: button("play / pause", "primary"),
    reverse: button("reverse", "primary"),
    speeds: ([0.25, 1, 4] as const).map((speed) => [speed, button(`${speed}×`)] as const),
    back: button("−5 s"),
    forward: button("+5 s"),
    far: button("seek 999 990 s"),
    motion: button("reduced motion", "warning"),
    depth: button("color depth", "warning"),
    fps: button("frame rate", "warning"),
    quit: button("quit", "danger"),
    scrub: new ScrubBar(),
    input: new TextInput({ placeholder: "type here: the caret blinks" }),
    gallery: new Viewport({ scrollbar: SCROLLBAR }),
  };
}
export type Controls = ReturnType<typeof controls>;

/** A timeline operation at the clock's `now`. */
type Playback = (timeline: Timeline, now: number) => Timeline;

/** Each playback button and the one `Timeline` operation it is. */
export function playback(c: Controls): readonly (readonly [Button, Playback])[] {
  return [
    [c.playPause, (timeline, now) => (timeline.playing ? Timeline.pause(timeline, now) : Timeline.resume(timeline, now))],
    [c.reverse, (timeline, now) => Timeline.withRate(timeline, now, -timeline.rate)],
    ...c.speeds.map(([speed, b]) => [b, (timeline: Timeline, now: number) => Timeline.withRate(timeline, now, Math.sign(timeline.rate) * speed)] as const),
    [c.back, (timeline, now) => Timeline.seek(timeline, now, Timeline.at(timeline, now) - 5)],
    [c.forward, (timeline, now) => Timeline.seek(timeline, now, Timeline.at(timeline, now) + 5)],
    [c.far, (timeline, now) => Timeline.seek(timeline, now, 999_990)],
  ];
}

/** `cells` side by side, a cell's space between each. */
export const row = (...cells: Renderable[]): Table => {
  const grid = Table.grid({ padding: [0, 1] });
  cells.forEach(() => grid.addColumn());
  grid.addRow(...cells);
  return grid;
};
