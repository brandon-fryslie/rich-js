/**
 * Lists: many animations at once, inside one container.
 *
 * The idiom is `Animation.map(Animation.all(children), (values) =>
 * container)`: every child is its own animation, `all` holds them together
 * and changes when the soonest of them does, and the map builds the
 * container — a `Group`, a `Tree`, a `Table` — from their values. A stagger
 * is the same with each child offset in time: `Timeline.stagger(children,
 * gap)`, or each lifecycle entered a little later than the last.
 */
import {
  Animation,
  EASES,
  Group,
  RichText,
  Table,
  Timeline,
  Tree,
  backspace,
  cyclic,
  dissolveOut,
  fadeIn,
  lifecycle,
  scrambleOut,
  stepSequence,
  throughColors,
  throughGlyphs,
  typewriter,
  type Lifecycle,
} from "@promptctl/rich-js";
import { MUTED, kind, type Kind } from "./look.js";

// --- A log whose lines enter and leave ---

const LOG = ["resolving dependencies", "compiling 214 modules", "bundling the browser", "running 1,204 tests", "writing coverage", "publishing docs"];
const COLORS = cyclic(["#a6adc8", "#89b4fa", "#f9e2af", "#cba6f7"]);
const EVERY = 1.2;
const LOG_STAYS = 3.6;
const LOG_LEAVES = { seconds: 1, ease: EASES["ease-in"], swing: 1 };
/** How many lines are on screen at once: the newest and those still staying or leaving. */
const SHOWN = Math.ceil((LOG_STAYS + LOG_LEAVES.seconds) / EVERY);
const step = cyclic(LOG.map((_, i) => i));

/** Line `i` of the log, entered at `entered` on its turn's clock and leaving `LOG_STAYS` later — half dissolving, half scrambling away. */
function logLine(i: number, entered: number): Lifecycle {
  const n = step(i);
  const line = new RichText(`${n + 1}/${LOG.length}  ${LOG[n]!}`, { style: COLORS(n) });
  const exit = n % 2 === 0 ? throughColors(dissolveOut(LOG_LEAVES, n)) : throughGlyphs(scrambleOut(LOG_LEAVES, n));
  return lifecycle(line, { enter: throughGlyphs(typewriter({ seconds: 0.8, ease: EASES["ease-out"] })), exit, key: `log ${n}` }, entered).leave(entered + LOG_STAYS);
}

/**
 * A turn is one line's arrival: in turn `k` the lines on screen are `k -
 * SHOWN … k`, entered at their offsets from it, so the log is a function of
 * the time alone and runs backwards as well as forwards. `SHOWN + 1` lines
 * never wrap onto one another's step, so every line on screen has a key of
 * its own. A program's log would hold lifecycles as its events arrive.
 */
const logging = Animation.repeat(
  EVERY,
  cyclic(
    LOG.map((_, k) =>
      Animation.map(
        Animation.all(Array.from({ length: SHOWN + 1 }, (_, back) => logLine(k - (SHOWN - back), -(SHOWN - back) * EVERY))),
        (lines) => new Group(...lines),
      ),
    ),
  ),
);

// --- A Tree whose children arrive one after another ---

const PACKAGES = ["core", "renderables", "host", "widgets", "themes"];
const ARRIVES = 0.35;
const treeing = Animation.repeat(
  6,
  cyclic([
    Animation.map(
      Animation.all(
        PACKAGES.map((name, i) =>
          lifecycle(
            new RichText(`src/${name}/`, { style: "#89b4fa" }),
            { enter: throughColors(fadeIn({ seconds: 0.5, ease: EASES["ease-out"], swing: 1 }, i)), exit: throughGlyphs(backspace({ seconds: 0.5, ease: EASES.linear })), key: `tree ${name}` },
            i * ARRIVES,
          ).leave(4.4 + i * 0.12),
        ),
      ),
      (children) => {
        const tree = new Tree(new RichText("rich-js", { style: "bold" }), { guide_style: MUTED });
        for (const child of children) tree.add(child);
        return tree;
      },
    ),
  ]),
);

// --- A light walking down a Table ---

const STEPS = [
  ["resolve", "0.4s"],
  ["compile", "3.1s"],
  ["bundle", "1.7s"],
  ["test", "8.9s"],
];
// Lit for half a second, then dim for a second and a half: half a second apart, the light walks down.
const tabling = Animation.map(
  Timeline.stagger(
    STEPS.map(() => stepSequence([0.5, 1.5])),
    0.5,
  ),
  (holds) => {
    const table = Table.grid({ padding: [0, 2] });
    table.addColumn();
    table.addColumn(undefined, { justify: "right" });
    holds.forEach((hold, i) => {
      const style = hold === 0 ? "bold #94e2d5" : MUTED;
      table.addRow(new RichText(STEPS[i]![0]!, { style }), new RichText(STEPS[i]![1]!, { style }));
    });
    return table;
  },
);

export const LISTS: readonly Kind[] = [kind("list · enter and leave", logging), kind("stagger · Tree", treeing), kind("stagger · Table", tabling)];
