/**
 * scroll — a marquee, a log tail and a panel sliding in, each a window over
 * wider or taller content, playing in a `Live` for twenty seconds.
 *
 * THIS IS A DEMO: `scroll` (`src/renderables/scroll.ts`), for seeing one
 * window moved three ways. The marquee's offset is a looping phase across the
 * line and the slot, so the line enters from the right and leaves on the
 * left; the log's is a phase stepping down its rows; the panel's is a tween
 * from outside the slot to 0, so it arrives and holds. Each is drawn through
 * `frameAt`, which stamps its cells with when it next changes.
 */

import {
  Animation,
  EASES,
  Group,
  Live,
  Panel,
  Phase,
  beat,
  RichText,
  cellLen,
  frameAt,
  scroll,
  tween,
  type Renderable,
} from "../../src/index.js";

const WIDTH = 40;

const NEWS = "rich-js 1.0 · tables, panels, trees and live displays · every motion one Animation ·";
const marquee = scroll(new RichText(NEWS, { style: "bold #f9e2af" }), {
  width: WIDTH,
  height: 1,
  // From just past the right edge to just past the left, every twelve seconds.
  col: Animation.continuous((t) => Phase.loop(12)(t) * (cellLen(NEWS) + WIDTH) - WIDTH),
});

const LOG = Array.from({ length: 12 }, (_, i) => new RichText(`${String(i + 1).padStart(2)}  build step ${i + 1} finished`, { style: "#89b4fa" }));
const tail = scroll(new Group(...LOG), {
  width: WIDTH,
  height: 4,
  // One row a second down the log, then back to its top: a beat, so it wakes the host once a second, not every frame.
  row: beat(Array.from({ length: LOG.length - 3 }, () => 1)),
});

const panel = new Panel(new RichText("slid in from the left, and holding", { style: "#a6e3a1" }), { width: WIDTH });
const slide = scroll(panel, { width: WIDTH, height: 3, col: tween(-WIDTH, 0, { seconds: 1.5, ease: EASES["ease-out"] }) });

function view(t: number): Renderable {
  return new Group(frameAt(marquee, t), new RichText(""), frameAt(tail, t), new RichText(""), frameAt(slide, t));
}

const live = new Live(view, { refreshPerSecond: 30 });
live.start();
await new Promise((resolve) => setTimeout(resolve, 20_000));
live.stop();
