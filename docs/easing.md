# Easing & Phases

Anything in rich-js that changes over time or along a range takes its "how far along" from one vocabulary: an **ease** reshapes progress in `[0, 1]`, and a **phase** turns a time in seconds into that progress. A ramp's way between two stops and an animation's curve are the same kind of function, so a curve written once works in both.

Nothing here reads a clock. Time is an argument, so whoever draws the frames picks the rate (30 times a second, or once every few seconds), and the same `t` always gives the same answer.

## Eases

An `Ease` is any function from `[0, 1]` to progress. The built-ins are CSS's easing functions, by the name CSS gives them, plus `sine`, a half-cosine that is flat at both ends, and `step`, the older spelling of `step-end`:

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

## In a color ramp

`ColorRamp` takes an `Ease` for the way between each pair of its stops. The template function `ramp` takes the same ease by name. See [Colors are values](/template-bindings#colors-are-values) on the Template Bindings page.
