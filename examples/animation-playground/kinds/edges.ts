/**
 * The empty cases: animations at the edge of what they were made for.
 *
 * Each is written the ordinary way and should simply draw: a stagger of no
 * children, a marquee over content narrower than its slot, a crossfade
 * between two things that are the same, and an element told to leave before
 * it has finished arriving. Several animations side by side in a grid are
 * `Animation.all` mapped to the `Table` that lays them out.
 */
import { Animation, EASES, Group, RichText, Table, Timeline, backspace, crossfade, cyclic, lifecycle, marquee, throughGlyphs, typewriter, type Renderable } from "@promptctl/rich-js";
import { CHANGE, MUTED, STAY, kind, type Kind } from "./look.js";

const nobody = Animation.map(Timeline.stagger<Renderable>([], 0.2), (children) => new Group(...children));
const narrow = marquee(new RichText("hi", { style: "#f9e2af" }), { width: 12, step: 0.25 });
const same = new RichText("unchanged", { style: "#a6e3a1" });
const sameFade = Animation.repeat(STAY, cyclic([crossfade(CHANGE).effect({ from: same, to: same })]));
const early = Animation.repeat(
  4,
  cyclic([
    lifecycle(
      new RichText("told to go at once", { style: "#cba6f7" }),
      { enter: throughGlyphs(typewriter({ seconds: 2, ease: EASES.linear })), exit: throughGlyphs(backspace({ seconds: 1, ease: EASES.linear })), key: "early" },
      0,
    ).leave(0.8),
  ]),
);

const LABELS = ["stagger of none", "narrow marquee", "same crossfade", "leaves early"];

export const EDGES: readonly Kind[] = [
  kind(
    "empty cases",
    Animation.map(Animation.all([nobody, narrow, sameFade, early]), (cells) => {
      const grid = Table.grid({ padding: [0, 1] });
      grid.addColumn(undefined, { style: MUTED, noWrap: true });
      grid.addColumn();
      cells.forEach((cell, i) => grid.addRow(LABELS[i]!, cell));
      return grid;
    }),
  ),
];
