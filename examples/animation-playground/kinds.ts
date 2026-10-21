/**
 * The kinds of motion the animation playground shows, one row each.
 *
 * THIS IS A DEMO (`examples/animation-playground/`). Every row is built from
 * the library's animation vocabulary and nothing else. A one-shot — a tween, a
 * typewriter, a transition, an arrival — is played again every few seconds
 * through `Animation.repeat`, so it is moving wherever the timeline is
 * scrubbed to, and runs backwards when the timeline does.
 *
 * [LAW:one-type-per-behavior] A kind is a name and the titled panel it draws
 * at a time on the playground's timeline, so the view is one map over the
 * rows. Each panel draws through something that stamps its cells with when it
 * next changes — `frameAt` of an animation, an `Effected`, a `GlyphEffected` —
 * so the app wakes when a kind moves and sleeps while every kind holds.
 */
import {
  Animation,
  CATPPUCCIN_MOCHA,
  ColorRamp,
  ColorRgba,
  EASES,
  Effected,
  GlyphEffected,
  Group,
  Panel,
  Phase,
  ProgressBar,
  RichText,
  Rule,
  Table,
  Timeline,
  Tree,
  ATTRIBUTE_DEFAULTS,
  GLYPH_DEFAULTS,
  backspace,
  beat,
  blink,
  caseWave,
  cellLen,
  crossfade,
  fadeIn,
  frameAt,
  gradient,
  lifecycle,
  particles,
  scramble,
  scrambleOut,
  scroll,
  spring,
  throughColors,
  throughGlyphs,
  tween,
  typewriter,
  wipe,
  dissolveOut,
  type GlyphEffect,
  type Lifecycle,
  type Renderable,
} from "@promptctl/rich-js";

/** One kind of motion: what it is called, and the titled panel it draws at time `t` on the playground's timeline. */
export interface Kind {
  readonly name: string;
  readonly draw: (t: number) => Renderable;
}

const THEME = CATPPUCCIN_MOCHA;
const TEXT = "#cdd6f4";
const MUTED = "#6c7086";
const BORDER = "#585b70";
/** The cells a kind's content may take: every panel is this wide inside its border and padding. */
const SLOT = 32;

/** `content` in the kind's titled panel. */
const panel =
  (name: string) =>
  (content: Renderable): Panel =>
    new Panel(content, { title: name, titleStyle: MUTED, borderStyle: BORDER, width: SLOT + 4 });

/**
 * A kind drawn from an animation of its content. The panel is put on inside
 * the animation, so the frame `frameAt` stamps is never a bare `RichText` —
 * a text frame is the program's own sample and would move under reduced
 * motion, where any other renderable is drawn reduced.
 */
function animated(name: string, frames: Animation<Renderable>): Kind {
  const framed = Animation.map(frames, panel(name));
  return { name, draw: (t) => frameAt(framed, t) };
}

/**
 * A kind drawn by an effect at the time it is asked for (`frameAt`), set in
 * its panel — or, with `framed`, already around it. The effect is made once,
 * here, and not on every frame: what it settles of a frame — a ramp's legible
 * inks on each ground — it keeps for the next, so a frame drawing what an
 * earlier one drew redoes no search.
 */
function effected(name: string, moving: Animation<Renderable>, framed: (content: Renderable) => Renderable = panel(name)): Kind {
  return { name, draw: (t) => framed(frameAt(moving, t)) };
}

/** The `n`th of `values`, wrapping both ways, so a turn before 0 — reversed past the start — has one too. */
function nthOf<T>(values: readonly T[], n: number): T {
  return values[((n % values.length) + values.length) % values.length]!;
}

/**
 * `turns` played one after another, a turn every `period` seconds, for ever
 * in both directions. Each turn is made once, here: `Animation.repeat` asks
 * for a turn on every question it is asked.
 */
function rotating<T>(period: number, turns: readonly Animation<T>[]): Animation<T> {
  return Animation.repeat(period, (n) => nthOf(turns, n));
}

/** The same `turns.length`-long rotation built by `make(i)`, for each `i` of it. */
const turnsOf = <T>(count: number, make: (i: number) => Animation<T>): readonly Animation<T>[] =>
  Array.from({ length: count }, (_, i) => make(i));

// --- Tweens: a value moving to a target, retargeted every few seconds ---

const COUNTS = [120, 870, 430, 1204, 60, 655];
const RETARGET = 3;
/** The count eased from the last target to the next, every `RETARGET` seconds, a spring settling each time. */
const counting = rotating(RETARGET, turnsOf(COUNTS.length, (i) => tween(nthOf(COUNTS, i - 1), COUNTS[i]!, spring({ stiffness: 120, damping: 14 }))));
const filling = rotating(RETARGET, turnsOf(COUNTS.length, (i) => tween(nthOf(COUNTS, i - 1), COUNTS[i]!, { seconds: 1.2, ease: EASES["ease-out"] })));
const fading = rotating(RETARGET, [tween(0, 1, { seconds: 1.5, ease: EASES["ease-in-out"] }), tween(1, 0, { seconds: 1.5, ease: EASES["ease-in-out"] })]);
const fadeRamp = new ColorRamp(EASES.linear, [
  { at: 0, color: new ColorRgba(243, 139, 168) },
  { at: 1, color: new ColorRgba(166, 227, 161) },
]);

// --- Ramps that move ---

const HUES = new ColorRamp(EASES.linear, [
  { at: 0, color: new ColorRgba(255, 120, 100) },
  { at: 1 / 3, color: new ColorRgba(249, 226, 175) },
  { at: 2 / 3, color: new ColorRgba(110, 190, 255) },
  { at: 1, color: new ColorRgba(255, 120, 100) },
]);
// Each loop is a phase of its own seconds; reduced, each holds at 0, the ramp unmoved.
const flowing = HUES.moving({ scroll: Animation.continuous(Phase.loop(4)), hue: Animation.continuous(Phase.loop(12)) });

// --- A marching border: a glyph effect on the border's cells ---

const BOX_GLYPHS = new Set("─│╭╮╰╯");
/** Which of three steps the march is on, a step every 0.15 s: a loop, so reduced it holds at its first. */
const marching = beat([0.15, 0.15, 0.15]);
/**
 * Every third cell of a border blank, the gaps walking one cell a step
 * clockwise: marching ants. A border cell is counted by its place along the
 * border, from the top-left corner round, so every edge walks the same way.
 */
const march: GlyphEffect = ({ cells }) => {
  const border = cells.filter((cell) => BOX_GLYPHS.has(cell.glyph));
  const right = Math.max(...border.map((cell) => cell.col));
  const bottom = Math.max(...border.map((cell) => cell.row));
  const around = (row: number, col: number): number =>
    row === 0 ? col : col === right ? right + row : row === bottom ? 2 * right + bottom - col : 2 * (right + bottom) - row;
  return Animation.map(marching, (step) => (cell) => (BOX_GLYPHS.has(cell.glyph) && (around(cell.row, cell.col) + 3 - step) % 3 === 0 ? " " : cell.glyph));
};

// --- Glyph effects: text that arrives and leaves ---

const TYPED = new RichText("typed one cell at a time", { style: TEXT });
const SCRAMBLED = new RichText("resolving out of noise", { style: TEXT });
const WAVED = new RichText("a wave of capitals crosses", { style: TEXT });
// Each leaves so it is gone just as its turn ends: gone, a lifecycle draws no
// rows. Reduced, it cuts away at `leave`, so each also sits behind a prompt
// that keeps its row, and the panel does not fold shut until the next turn.
const PROMPT = new RichText("›", { style: MUTED });
const prompted = (line: Renderable): Table => {
  const grid = Table.grid({ padding: [0, 1, 0, 0] });
  grid.addColumn();
  grid.addColumn();
  grid.addRow(PROMPT, line);
  return grid;
};
const typing = rotating(5, [
  lifecycle(TYPED, { enter: throughGlyphs(typewriter(GLYPH_DEFAULTS.typewriter)), exit: throughGlyphs(backspace({ seconds: 1, ease: EASES.linear })), key: "typed" }, 0).leave(4),
]);
// A different noise each of four turns, so a replay is not the last one again.
const scrambling = rotating(
  6,
  turnsOf(4, (seed) =>
    lifecycle(SCRAMBLED, { enter: throughGlyphs(scramble(GLYPH_DEFAULTS.scramble, seed)), exit: throughGlyphs(scrambleOut({ seconds: 1.2, ease: EASES["ease-out"] }, seed)), key: `scrambled ${seed}` }, 0).leave(4.8),
  ),
);

// --- Transitions between two statuses ---

const STATUSES = [
  new RichText("● building the project", { style: "#f9e2af" }),
  new RichText("✔ 1,204 tests passed", { style: "#a6e3a1" }),
  new RichText("▲ publishing the docs", { style: "#89b4fa" }),
];
const STAY = 3;
const CHANGE = { seconds: 1.2, ease: EASES["ease-in-out"], swing: 1 };
const crossfading = rotating(STAY, turnsOf(STATUSES.length, (i) => crossfade(CHANGE).effect({ from: nthOf(STATUSES, i - 1), to: STATUSES[i]!, theme: THEME })));
const wiping = rotating(STAY, turnsOf(STATUSES.length, (i) => wipe(CHANGE).effect({ from: nthOf(STATUSES, i - 1), to: STATUSES[i]!, theme: THEME })));

// --- A list whose items enter and leave ---

const LOG = ["resolving dependencies", "compiling 214 modules", "bundling the browser", "running 1,204 tests", "writing coverage", "publishing docs"];
const EVERY = 1.2;
const LOG_STAYS = 3.6;
const LOG_LEAVES = { seconds: 1, ease: EASES["ease-in"], swing: 1 };
/** How many lines are on screen at once: the newest and those still staying or leaving. */
const SHOWN = Math.ceil((LOG_STAYS + LOG_LEAVES.seconds) / EVERY);
/** Step `i` of the log, entered at `entered` on its turn's clock, leaving `LOG_STAYS` later — half dissolving, half scrambling away. */
function logLine(i: number, entered: number): Lifecycle {
  const step = ((i % LOG.length) + LOG.length) % LOG.length;
  const line = new RichText(`${step + 1}/${LOG.length}  ${LOG[step]!}`, { style: nthOf(["#a6adc8", "#89b4fa", "#f9e2af", "#cba6f7"], step) });
  const exit = step % 2 === 0 ? throughColors(dissolveOut(LOG_LEAVES, step), THEME) : throughGlyphs(scrambleOut(LOG_LEAVES, step));
  return lifecycle(line, { enter: throughGlyphs(typewriter({ seconds: 0.8, ease: EASES["ease-out"] })), exit, key: `log ${step}` }, entered).leave(entered + LOG_STAYS);
}
/**
 * A turn is one line's arrival: in turn `k` the lines on screen are `k -
 * SHOWN … k`, entered at their offsets from it, so the list is a pure function
 * of `t` and runs backwards as well as forwards. `SHOWN + 1` lines never wrap
 * onto one another's step, so every line on screen has a key of its own.
 */
const logging = rotating(
  EVERY,
  turnsOf(LOG.length, (k) => Animation.map(Animation.all(turnsOf(SHOWN + 1, (back) => logLine(k - back, -back * EVERY)).slice().reverse()), (lines) => new Group(...lines))),
);

// --- Scroll: a marquee and a slide-in ---

const NEWS = "rich-js · tables, panels, trees and live displays · every motion is one Animation ·";
const marquee = scroll(new RichText(NEWS, { style: "bold #f9e2af" }), {
  width: SLOT,
  height: 1,
  // From the line's start, so with motion reduced the loop holds it in view.
  col: Animation.continuous((t) => ((Phase.loop(14)(t) * (cellLen(NEWS) + SLOT) + SLOT) % (cellLen(NEWS) + SLOT)) - SLOT),
});
const sliding = rotating(4, [scroll(new RichText("arrived, and holding still", { style: "#a6e3a1" }), { width: SLOT, height: 1, col: tween(-SLOT, 0, { seconds: 1, ease: EASES["back-out"] }) })]);

// --- Staggers: a Tree whose children arrive one after another, a light walking down a Table ---

const PACKAGES = ["core", "renderables", "host", "widgets", "themes"];
const ARRIVES = 0.35;
const treeing = rotating(6, [
  Animation.map(
    Animation.all(
      PACKAGES.map((name, i) =>
        lifecycle(
          new RichText(`src/${name}/`, { style: "#89b4fa" }),
          { enter: throughColors(fadeIn({ seconds: 0.5, ease: EASES["ease-out"], swing: 1 }, i), THEME), exit: throughGlyphs(backspace({ seconds: 0.5, ease: EASES.linear })), key: `tree ${name}` },
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
]);
const STEPS = [
  ["resolve", "0.4s"],
  ["compile", "3.1s"],
  ["bundle", "1.7s"],
  ["test", "8.9s"],
];
// Lit for half a second, then dim for a second and a half: half a second apart, the light walks down.
const tabling = Animation.map(
  Timeline.stagger(
    STEPS.map(() => beat([0.5, 1.5])),
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

// --- The empty cases ---

const nobody = Animation.map(Timeline.stagger<Renderable>([], 0.2), (children) => new Group(...children));
// From the word's start, as the marquee is, so with motion reduced it holds in view.
const narrow = scroll(new RichText("hi", { style: "#f9e2af" }), { width: 12, height: 1, col: Animation.continuous((t) => ((Math.round(Phase.loop(4)(t) * 26) + 12) % 26) - 12) });
const same = new RichText("unchanged", { style: "#a6e3a1" });
const sameFade = rotating(STAY, [crossfade(CHANGE).effect({ from: same, to: same, theme: THEME })]);
const early = rotating(4, [
  lifecycle(new RichText("told to go at once", { style: "#cba6f7" }), { enter: throughGlyphs(typewriter({ seconds: 2, ease: EASES.linear })), exit: throughGlyphs(backspace({ seconds: 1, ease: EASES.linear })), key: "early" }, 0).leave(0.8),
]);
const EDGE_LABELS = ["stagger of none", "narrow marquee", "same crossfade", "leaves early"];
const edges = Animation.map(Animation.all([nobody, narrow, sameFade, early]), (cells) => {
  const grid = Table.grid({ padding: [0, 1] });
  grid.addColumn(undefined, { style: MUTED, noWrap: true });
  grid.addColumn();
  cells.forEach((cell, i) => grid.addRow(EDGE_LABELS[i]!, cell));
  return grid;
});

/**
 * Every kind the playground shows, in the order it lays them out. The
 * `TextInput` is not here: it is a widget, which lives from one frame to the
 * next and reads the frame's time from its render options, so the view holds
 * it as itself.
 */
export const KINDS: readonly Kind[] = [
  animated("tween · a counter", Animation.map(counting, (v) => new RichText(`${Math.round(v).toLocaleString("en-US").padStart(6)} files`, { style: "bold #f9e2af" }))),
  animated("tween · ProgressBar", Animation.map(filling, (v) => new ProgressBar({ total: 1204, completed: v, width: SLOT }))),
  animated("tween · a colour", Animation.map(fading, (v) => new RichText(`██████  ${fadeRamp.at(v).hex}`, { style: fadeRamp.at(v).hex }))),
  effected("moving ramp · Rule", new Effected(new Rule("scrolls and turns", { style: BORDER }), gradient(flowing, [BORDER]), { key: "rule", theme: THEME })),
  // The two border kinds put their effect around the panel, so it is the panel's border that moves.
  effected("moving ramp · border", new Effected(panel("moving ramp · border")(new RichText("the border is the ramp", { style: TEXT })), gradient(flowing, [BORDER]), { key: "border", theme: THEME }), (moved) => moved),
  effected("marching border", new GlyphEffected(panel("marching border")(new RichText("the ants march round", { style: TEXT })), march, { key: "march" }), (moved) => moved),
  animated("typewriter", Animation.map(typing, prompted)),
  animated("scramble", Animation.map(scrambling, prompted)),
  effected("case wave", new GlyphEffected(WAVED, caseWave({ step: 0.12, width: 3 }, 0), { key: "wave" })),
  effected("rain on a blank panel", new GlyphEffected(new RichText(" ".repeat(SLOT)), particles(GLYPH_DEFAULTS.rain, 1), { key: "rain" })),
  effected("blink", new Effected(new RichText("● recording", { style: "#f38ba8" }), blink(ATTRIBUTE_DEFAULTS.blink), { key: "blink", theme: THEME })),
  effected("bold pulse", new Effected(new RichText("♥ a bold heartbeat", { style: "#f38ba8" }), blink(ATTRIBUTE_DEFAULTS.boldPulse), { key: "pulse", theme: THEME })),
  animated("crossfade", crossfading),
  animated("wipe", wiping),
  animated("marquee", marquee),
  animated("slide-in", sliding),
  animated("list · enter and leave", logging),
  animated("stagger · Tree", treeing),
  animated("stagger · Table", tabling),
  animated("empty cases", edges),
];

export { BORDER, MUTED, SLOT, TEXT, THEME, panel };
