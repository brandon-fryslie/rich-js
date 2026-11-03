/**
 * The gallery: every kind of motion the playground shows, in the order it
 * lays them out.
 *
 * THIS IS A DEMO (`examples/animation-playground/`). Each kind is a value in
 * a file under `kinds/`, grouped by the idiom it teaches; adding a kind is
 * adding one value to one of those lists. The `TextInput` is not here: it is
 * a widget, which lives from one frame to the next, so the view holds it as
 * itself (`playground.ts`).
 */
import { ATTRIBUTES } from "./kinds/attributes.js";
import { EDGES } from "./kinds/edges.js";
import { GLYPHS } from "./kinds/glyphs.js";
import { LISTS } from "./kinds/lists.js";
import type { Kind } from "./kinds/look.js";
import { RAMPS } from "./kinds/ramps.js";
import { SCROLLS } from "./kinds/scroll.js";
import { TRANSITIONS } from "./kinds/transitions.js";
import { TWEENS } from "./kinds/tweens.js";

export const KINDS: readonly Kind[] = [...TWEENS, ...RAMPS, ...GLYPHS, ...ATTRIBUTES, ...TRANSITIONS, ...SCROLLS, ...LISTS, ...EDGES];
