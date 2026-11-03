/**
 * A Viewport scrolled past an effect carries none of its frames' validity intervals to the frame.
 *
 * An effect changes how cells look, never which exist, so its next change is
 * seen only on its own cells: cropped away with them, it wakes no host. A
 * switch of what an animation shows may move the rows that do show, so it
 * still reaches the frame from wherever it was cropped. Each case is drawn as
 * a host draws it (`drawnAt`), at one frame a second and sixty.
 */

import { describe, expect, it } from "vitest";
import { Animation } from "../../src/core/animation.js";
import { ColorDepth } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import { RichText } from "../../src/core/text.js";
import { Effected } from "../../src/renderables/effect.js";
import { ATTRIBUTE_DEFAULTS, blink } from "../../src/renderables/effects.js";
import { Group } from "../../src/renderables/group.js";
import { Viewport } from "../../src/renderables/viewport.js";
import { drawnAt } from "./in-frame.js";

const OPTIONS: RenderOptions = { maxWidth: 20, colorSystem: ColorDepth.TRUECOLOR };
const NEVER = Number.POSITIVE_INFINITY;
/** Sample times at one frame a second and sixty, and far out. */
const TIMES = [0, 1, 2, 1 / 60, 2 / 60, 1e6];

/** A blinking line: its next change is its next half second. */
const blinking = (): Renderable => new Effected(new RichText("blinks"), blink(ATTRIBUTE_DEFAULTS.blink), { key: "blink" });
const still = (label: string): Renderable => new RichText(label);

/** Rows 0..n-1 of still text, then the blinking line. */
const tall = (n: number): Renderable => new Group(...Array.from({ length: n }, (_, i) => still(`row ${i}`)), blinking());

describe("a crop drops the validity intervals of the looks it drops", () => {
  it("a blink scrolled out of a Viewport sleeps; scrolled into it, wakes at its next half second", () => {
    const viewport = new Viewport({ rows: 2 });
    const view = viewport.showing(tall(5));
    for (const t of TIMES) {
      expect(drawnAt(view, t, OPTIONS).validUntil).toBe(NEVER);
    }
    viewport.scrollTo(4);
    drawnAt(view, 0, OPTIONS); // the move takes at the next frame
    for (const t of TIMES) {
      expect(drawnAt(view, t, OPTIONS).validUntil).toBe(Math.floor(t * 2 + 1) / 2);
    }
  });

  it("a switch of what shows still wakes the frame from out of view, since it may move the rows in view", () => {
    const switching = Animation.of({
      at: (t: number) => (t < 5 ? still("one") : new Group(still("one"), still("two"))),
      validUntil: (t: number) => (t < 5 ? 5 : NEVER),
      validFrom: (t: number) => (t < 5 ? Number.NEGATIVE_INFINITY : 5),
      reduced: () => Animation.constant<Renderable>(still("one")),
    });
    const viewport = new Viewport({ rows: 1 });
    const view = viewport.showing(new Group(switching, still("shown")));
    viewport.scrollTo(1);
    drawnAt(view, 0, OPTIONS);
    for (const t of [0, 1, 1 / 60, 4]) expect(drawnAt(view, t, OPTIONS).validUntil).toBe(5);
  });
});
