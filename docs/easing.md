# Easing & Phases

Anything in rich-js that changes over time or along a range takes its "how far along" from one vocabulary: an **ease** reshapes progress in `[0, 1]`, and a **phase** turns a time in seconds into that progress. A ramp's way between two stops and an animation's curve are the same kind of function, so a curve written once works in both.

Nothing here reads a clock. Time is an argument, so whoever draws the frames picks the rate (30 times a second, or once every few seconds), and the same `t` always gives the same answer.

## Eases

An `Ease` is any function from `[0, 1]` to progress. The built-ins are CSS's easing functions, by the name CSS gives them, plus `sine`, a half-cosine that is flat at both ends, `step`, the older spelling of `step-end`, and the physics curves the next section describes:

```typescript
import { EASES } from "@promptctl/rich-js";

for (const [name, ease] of Object.entries(EASES)) {
  const samples = [0, 0.25, 0.5, 0.75, 1].map((x) => ease(x).toFixed(2));
  console.print(`${name.padEnd(12)} ${samples.join("  ")}`);
}
```

`parseEase(name)` turns a spelled name, such as one read from a template or a config file, into the function. An unknown name throws, listing every name it accepts:

```typescript throws
import { parseEase } from "@promptctl/rich-js";

parseEase("smooth");
```

`cubicBezier(x1, y1, x2, y2)` and `steps(n, position)` build the rest of CSS's curves. As in CSS, `x1` and `x2` must lie in `[0, 1]`, while `y1` and `y2` may leave it, so the curve overshoots like a CSS "back" curve. `steps` takes CSS's jump positions (`jump-start`, `jump-end`, `jump-both`, `jump-none`, and the older `start` and `end`):

```typescript
import { cubicBezier, steps } from "@promptctl/rich-js";

const back = cubicBezier(0.34, 1.56, 0.64, 1);
const thirds = steps(3, "jump-end");
for (const x of [0, 0.25, 0.5, 0.75, 1]) {
  console.print(`x=${x.toFixed(2)}  back=${back(x).toFixed(3)}  steps(3)=${thirds(x).toFixed(3)}`);
}
```

## Springs, bounces and overshoot

A cursor snapping to its target, a counter settling on its value or a panel sliding in wants a curve CSS does not have: one that overshoots and comes back, or bounces. These are eases like the rest, so everything that takes an `Ease` — a ramp, an effect's `Curve`, the `ramp` template function by name — takes them with no change. An ease that leaves `[0, 1]` is read by what can show the overshoot, such as a position or a count; a `ColorRamp` holds its end colours where it does, and an effect saturates at its `swing`.

`spring(options)` is a damped harmonic oscillator, released at rest a unit from where it is going, in the units every animation library spells springs in: `stiffness` (default 100), `damping` (10) and `mass` (1). Less damping rings past the rest and back; at or above critical damping the spring only creeps up to it. Unlike every other ease, a spring's duration is not yours to choose — how long it rings is a fact about its physics — so `spring` returns both the `ease` and the `seconds` it takes to settle within one part in a thousand, and `{ ...spring(options), swing }` is an effect's `Curve`. The ease is the spring's position over those seconds, and exactly 1 at the end:

```typescript
import { Phase, spring } from "@promptctl/rich-js";

const snap = spring({ stiffness: 300, damping: 20 });
const creep = spring({ stiffness: 300, damping: 40 });
console.print(`snap settles in ${snap.seconds.toFixed(2)} s, creep in ${creep.seconds.toFixed(2)} s`);

const phase = Phase.once(0, snap.seconds);
for (const t of [0, 0.1, 0.2, 0.3, 0.5, snap.seconds]) {
  console.print(`t=${t.toFixed(2)}s  snap=${snap.ease(phase(t)).toFixed(3)}  creep=${creep.ease(phase(t)).toFixed(3)}`);
}
```

`EASES.spring` is the default spring's ease, so a template can spell it. Beside it are Robert Penner's curves, at the constants every animation library since has shipped: `bounce`, a ball dropped onto its rest in four shrinking arcs, never above 1; `back-in`, which pulls back past its start before going, and `back-out`, which overshoots its end by about a tenth before settling; and `elastic`, which overshoots and rings back through its end, each swing a little over a third of the last. Each is 0 at 0 and exactly 1 at 1.

## Phases

A `Phase` maps seconds to progress. `Phase.once(start, duration)` rises from 0 to 1 over `duration` seconds and then holds. `Phase.loop(period)` wraps from 0 to 1 every period. `Phase.pingPong(period)` goes 0 → 1 → 0 every period. Compose a phase with an ease as `ease(phase(t))`:

```typescript
import { EASES, Phase } from "@promptctl/rich-js";

const breathe = Phase.pingPong(2);
for (const t of [0, 0.5, 1, 1.5, 2]) {
  console.print(`t=${t}s  raw=${breathe(t).toFixed(2)}  sine=${EASES.sine(breathe(t)).toFixed(2)}`);
}
```

To run the cells of one effect on the same curve but shifted in time, add a per-cell offset to `t` before the phase sees it: `phase(t + offset)`.

A `Beat` is holds in seconds, played in order and looped: `at(t)` is the index of the hold in progress, `lastChange(t)` is the moment that hold began on `t`'s own timeline, `nextChange(t)` is the moment it ends — the next hold's start, always after `t`, which is when a [frame](/frames#when-the-frame-next-changes) held on the beat gives way to the next — and `period` is their sum. With `at`, that makes a beat an [animation](/animation) of the hold in progress. With equal holds `at` is `steps(n)` read as an index; the holds may differ. [Frames](/frames) are drawn on one, and expose it as `beat`; `onBeat` samples any [effect](/effects#sampled-on-a-beat) at `lastChange(t)`, so the effect holds within a hold and moves at each one's start.

## In a color ramp

`ColorRamp` takes an `Ease` for the way between each pair of its stops. The template function `ramp` takes the same ease by name. See [Colors are values](/template-bindings#colors-are-values) on the Template Bindings page.
