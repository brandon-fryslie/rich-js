/**
 * Rendering protocol interfaces — Renderable, Measurable, RenderOptions.
 * [LAW:one-source-of-truth] These interfaces are the single authority for the rendering contract.
 */

import type { Segment } from "./segment.js";
import { cellCount } from "./cells.js";
import { DEFAULT_THEME, Style, type Hold, type StyleSyntaxError, type Theme } from "./style.js";
import { ColorDepth, type ColorSpec } from "./color.js";
// [LAW:one-way-deps] exception: the one upward edge between core's tiers, and
// type-only. A render option that highlights the text being rendered, when
// `RichText` is itself rendered under these options, is a recursion in the
// domain; any type that broke the loop would say less than `Highlighter` does.
import type { Highlighter } from "./highlighter.js";

/**
 * What becomes of a line still wider than its width once wrapping is done.
 * `"fold"` breaks it across lines, `"crop"` cuts it at the edge, `"ellipsis"`
 * cuts it and marks the cut. `"ignore"` is not a way of cutting: the line has
 * no edge, so nothing wraps it and nothing cuts it, and it leaves at its
 * natural width for whatever drew it to crop or not.
 *
 * `noWrap` is the other half of Rich's pair and is not `"ignore"`: it stops the
 * wrapping and leaves the edge, so a line too wide is cut by the method here.
 */
export type OverflowMethod = "fold" | "crop" | "ellipsis" | "ignore";

/**
 * What draws frames — a `Live`, an `App` — as what draws in them sees it:
 * the time a frame drawn now is drawn for, the host's clock read through its
 * timeline for a view on it (`frameTime`, `./view.ts`). Not a `Clock`: under
 * a paused timeline it holds, and under a reversed one it runs backwards.
 */
export interface FrameHost {
  readonly frameTime: number;
}

export interface RenderOptions {
  /**
   * The cells this renderable may occupy. A count of cells, so a non-negative
   * integer — but the field is a plain `number` because it is public API and a
   * caller can write anything into it. `withCellWidth` is where that becomes
   * true rather than assumed; see its comment for why every renderable must
   * call it rather than trusting this declaration.
   */
  maxWidth: number;
  minWidth?: number;
  /**
   * The rows this renderable may occupy. Absent, nothing limits them.
   */
  height?: Height;
  isTerminal?: boolean;
  /**
   * The output can draw only ASCII. Every glyph a renderable chooses — box
   * lines, tree guides, a check mark — is resolved through `drawable`. Text
   * the caller hands in is drawn as given. Absent means the output draws any
   * glyph.
   */
  asciiOnly?: boolean;
  justify?: "left" | "center" | "right" | "full";
  overflow?: OverflowMethod;
  noWrap?: boolean;
  /**
   * Whether a string handed to a renderable — a cell, a label, a pane — is
   * read as markup when it is drawn. Absent, it is, as a `Console`'s is unless
   * told otherwise. A `Console` passes its own setting, and `print`'s.
   */
  markup?: boolean;
  /**
   * Whether a string handed to a renderable is highlighted when it is drawn,
   * by `highlighter`. Absent, it is, as a `Console`'s is unless told
   * otherwise. A `Console` passes its own setting, and `print`'s; a renderable
   * that draws its strings plain, as Rich's `Panel`, `Table` and `Tree` do by
   * default, sets it false for what it renders — Rich's
   * `options.update(highlight=False)` — and a table column's `highlight` sets
   * it either way. `activeHighlighter` is the one reading of the pair.
   */
  highlight?: boolean;
  /**
   * What highlights a string handed to a renderable, while `highlight` says
   * to. A `Console` passes its highlighter whether or not its own `highlight`
   * is on, as Rich's `render_str` reaches `console.highlighter`, so content
   * that turns highlighting on finds the console's highlighter there. Absent,
   * nothing highlights.
   */
  highlighter?: Highlighter;
  /**
   * The depth the output will be encoded at, `null` when it carries no colour.
   * A renderable choosing between two ways of drawing something — the strip's
   * arrow or its divider — decides on the colours the terminal will draw at
   * this depth, which at 256 colours or fewer are not the colours it was
   * handed. Absent means truecolor.
   */
  colorSystem?: ColorDepth | null;
  /**
   * The names a style string may use. A `Console` passes its own; absent, the
   * built-in defaults apply. Read it through `getStyle` rather than directly.
   */
  theme?: Theme;
  /**
   * Called each time a render degrades a style string it cannot parse to
   * unstyled, once per resolution — a style the render reads twice is reported
   * twice. Absent, the failure passes silently. A handler that throws makes
   * the render strict: the error leaves `render`.
   */
  onStyleError?: StyleErrorHandler;
  /**
   * The reader asked for reduced motion — CSS's `prefers-reduced-motion`,
   * which a terminal has no way to report, so a host is told. A renderable
   * built for the time the host draws at draws every animation reduced, its
   * motion taken out and its content kept on time (`shownAt`,
   * `./view.ts`; `Animation.reduced`, `./animation.ts`). Absent,
   * everything moves. Nothing here reads it from the environment.
   */
  reducedMotion?: boolean;
  /**
   * The frame being drawn: `time`, the moment it is drawn for, in seconds, on
   * the clock its cells' `nextChange` stamps are read on, and `host`, the
   * host drawing it, whose `frameTime` that moment was. It is how a
   * renderable that lives across frames — a widget, a `Progress` — draws for
   * the time without being rebuilt each frame with one, and without reading
   * a clock. Absent, the frame is drawn for no moment — a `print` — and
   * nothing drawn from it moves.
   */
  frame?: { readonly time: number; readonly host: FrameHost };
  /**
   * Told of every renderable `render` is asked for, as it is asked, so the
   * calls arrive in document order: a container before what it holds, what
   * it holds in the order it renders it. `"drawn"` is a renderable drawn at
   * the width it was handed; `"held"` is one handed no column, which is still
   * in the view but has nothing drawn for it (`render`). A renderable rendered
   * twice is told twice. A render made to measure is not drawing and is not
   * told (`measuring`).
   */
  onPresent?: (renderable: Renderable, presence: Presence) => void;
  /**
   * Told of a hold the frame is in that no cell of it may carry: an animation
   * placed in the view reports its own, whether or not it drew a cell — one
   * not yet entered draws none — and one a container crops away is still
   * reported. It reaches whatever `frame` reaches, so a container that hands
   * its child the frame's time hands back the child's hold with no word about
   * either. [LAW:composability] Absent, nobody is listening. A measurement
   * (`measuring`) and a held render (`holding`) tell too: what they find
   * decides the frame's layout, so when it changes, the frame may.
   */
  onHold?: (hold: Hold) => void;
}

/** The one field of the render options that says whether the reader wants motion. */
export type Motion = Pick<RenderOptions, "reducedMotion">;

/**
 * Whether a renderable the view holds was drawn, or held: in the view, handed
 * no column, and so not drawn (`render`).
 */
export type Presence = "drawn" | "held";

/** Whether `text` is all ASCII — what an `asciiOnly` output can draw. */
export const isAscii = (text: string): boolean => /^[\x00-\x7F]*$/.test(text);

/**
 * `chosen` as this output can draw it: `ascii` in its place when the output is
 * ASCII-only and `chosen` spends a glyph outside ASCII, otherwise `chosen`
 * itself. Choosing a glyph that is already ASCII (a rule of `=`, a MARKDOWN box)
 * picks a frame the terminal can draw, so it is kept. A set of glyphs that must
 * change together — a box grid, a spinner's frames, a scrollbar — passes
 * `glyphs` to say which characters it spends, and is replaced whole.
 *
 * [LAW:single-enforcer] The one place that decides what `asciiOnly` replaces.
 * `test/renderables/ascii-only.test.ts` renders every exported renderable to
 * hold each of them to it.
 */
export function drawable(options: { readonly asciiOnly?: boolean }, chosen: string, ascii: string): string;
export function drawable<T>(options: { readonly asciiOnly?: boolean }, chosen: T, ascii: T, glyphs: (value: T) => string): T;
export function drawable<T>(
  options: { readonly asciiOnly?: boolean },
  chosen: T,
  ascii: T,
  glyphs: (value: T) => string = String,
): T {
  return options.asciiOnly === true && !isAscii(glyphs(chosen)) ? ascii : chosen;
}

/**
 * A vertical budget: a count of rows, and whether they are a region the
 * renderable stands in or a ceiling it stays under.
 *
 * `exact: true` is a region — a `Layout` pane, a full-screen frame. The output
 * is exactly `rows` tall. A renderable may fill the region — a layout divides
 * it, a frame can stretch to its last row — or ignore it and emit its natural
 * height; either way, whoever set the region shapes what comes back to it
 * (`fitHeight`). Setting a region is a promise to shape, so no renderable pads
 * or crops itself to one.
 *
 * `exact: false` is a ceiling — the terminal an inline print lands on. Content
 * keeps its natural height beneath it, and nothing pads up to the ceiling.
 * Output taller than the ceiling is its setter's to handle: an inline `Live`
 * applies its `verticalOverflow`, and a print lets the terminal scroll it.
 *
 * A renderable passing its whole space to one child must forward the budget
 * less the rows it draws itself, and of the same kind (`insetHeight`). One
 * stacking several children must hand each the rows as a ceiling
 * (`stackedHeight`): any one of them may use all of it, and none may claim it
 * as its region. Forwarded unchanged, a layout nested in a panel fills the
 * panel's whole region and the region's crop takes the panel's bottom border.
 *
 * [LAW:types-are-the-program] One field, because the fact is one count and one
 * bit about it. As two numbers, `height` and `maxHeight`, it admitted a region
 * taller than its ceiling and a region with no ceiling at all, and the one
 * reader in the library resolved them `maxHeight ?? height` — the ceiling ahead
 * of the region it contains.
 *
 * There is no vertical `Measurable`. A parent chooses widths from its
 * children's measurements before any of them renders; nothing chooses rows
 * that way, because a renderable's height is a consequence of the width it
 * renders at. Rendering and counting the lines is the measurement.
 */
export interface Height {
  readonly rows: number;
  readonly exact: boolean;
}

/**
 * The budget a renderable hands the one child filling its space: its own, less
 * the `rows` it draws itself, and of the same kind.
 */
export function insetHeight(height: Height | undefined, rows: number): Height | undefined {
  return height && { rows: cellCount(height.rows - rows), exact: height.exact };
}

/**
 * The budget a renderable hands each of several children it stacks: its rows,
 * as a ceiling.
 */
export function stackedHeight(height: Height | undefined): Height | undefined {
  return height && { rows: cellCount(height.rows), exact: false };
}

/**
 * The rows a region holds, parsed as a cell count, or `undefined` when there
 * is no region to fill: a ceiling, no budget, or a region of `Infinity` rows,
 * which names no count — as an unbounded width resolves to a natural one in
 * `withBoundedWidth`.
 */
export function regionRows(height: Height | undefined): number | undefined {
  return height?.exact && height.rows !== Infinity ? cellCount(height.rows) : undefined;
}

/**
 * What came back from a child, held to the region `height` names — blank rows
 * padded below, overflow cropped from the bottom — or left at its own height
 * when `height` is no region. This is the shaping a region's setter owes.
 */
export function fitHeight(lines: Segment[][], height: Height | undefined): Segment[][] {
  const rows = regionRows(height) ?? lines.length;
  const fitted = lines.slice(0, rows);
  while (fitted.length < rows) fitted.push([]);
  return fitted;
}

/**
 * Receives a style error a render would otherwise absorb: the parse failure,
 * and the whole style string it came from — the error names only the token
 * that failed, and `"bold rd"` loses its `bold` too.
 *
 * [LAW:no-mode-explosion] Strict mode is not a second option beside this one.
 * It is a handler that throws, so there is no "strict and a callback" state
 * whose order anyone has to define.
 */
export type StyleErrorHandler = (error: StyleSyntaxError, style: string) => void;

/**
 * The style a `string | Style` stands for in this render: a name from the
 * theme of whatever is drawing, otherwise a style definition. A string that is
 * neither throws `StyleSyntaxError`. This is how a renderable that yields its
 * own `Segment`s draws with a theme name, since a `Segment` takes a resolved
 * `Style`. It is Rich's `console.get_style`, asked of the options because the
 * options are where the theme travels.
 *
 * [LAW:single-enforcer] Every renderable resolves a style name here, at render
 * time, because only the render knows whose theme it is drawing for. Resolved
 * when a renderable was built instead, a name was fixed to the built-in
 * defaults before any `Console` could offer its theme, and `new Console({
 * theme })` changed nothing.
 */
export function getStyle(options: RenderOptions, style: string | Style): Style {
  return (options.theme ?? DEFAULT_THEME).resolve(style);
}

/** The terminal's own foreground on its own background. */
const TERMINAL_GROUND = Style.parse("default on default");

/**
 * `style` as the depth the render is encoded at can draw it. A style that
 * paints its own ground in fixed colours chose its ink and ground as a pair;
 * at sixteen colours the writer rounds a fixed colour to an ANSI slot, which
 * the terminal paints in its own theme's colour, and no pair of slots reads in
 * every bundled theme. So where the depth would turn a fixed colour of the
 * pair into a slot, the pair is dropped and the run is drawn on the
 * terminal's own foreground and background, which its theme does make
 * readable; its attributes still set it apart. Both are named, not left
 * unset, so the colour of whatever the run sits in — a quote, a link — does
 * not show through: Rich's code keeps its own colours inside a quote, and the
 * terminal's are the ones it keeps here. A style whose colours are
 * slots already (`white on blue`), or that paints no ground (`bold magenta`),
 * was written for the terminal's own colours and is drawn as written. Rich
 * draws a highlighted line number the same way below 256 colours
 * (`Syntax._get_number_styles`).
 */
export function groundedStyle(options: RenderOptions, style: Style): Style {
  const drawn = style.drawnColors(options.colorSystem ?? undefined);
  const lost = (written: ColorSpec | undefined, shown: ColorSpec | undefined): boolean =>
    written?.fixedValue !== undefined && shown?.fixedValue === undefined;
  const pairLost = style.bgcolor !== undefined && (lost(style.color, drawn.color) || lost(style.bgcolor, drawn.bgcolor));
  return pairLost ? style.add(TERMINAL_GROUND) : style;
}

/**
 * The options a renderable should work from: the caller's, with `maxWidth`
 * parsed into an actual count of cells.
 *
 * [LAW:parse-dont-validate] The stamp has to travel, which is the whole reason
 * this returns options rather than a number. Parsing `options.maxWidth` into a
 * local leaves the caller's raw value sitting in `options` for whatever the
 * renderable forwards it to — and every renderable forwards it, to a child's
 * `render`, to `Measurement.get`, to a nested layout. `Columns` was fixed that
 * way first and still threw `Invalid array length` on a NaN width, because it
 * handed the unparsed original to `Measurement.get` and got a NaN column count
 * back. Replace the field, and nothing downstream can see the number the
 * caller actually wrote.
 *
 * [LAW:single-enforcer] This is the width checkpoint for the render contract.
 * There is no second one: a renderable that re-derives its own answer is how
 * `Panel`, `Table`, `Tree`, `Columns` and `Layout` came to disagree about what
 * a NaN width means — one collapsed to a cell of garbage, two threw, one
 * ignored the request and emitted its full natural width.
 */
export function withCellWidth(options: RenderOptions): RenderOptions {
  return { ...options, maxWidth: cellCount(options.maxWidth) };
}

/** Under one column there is nothing to draw, or to measure. */
export function drawsNothing(options: { readonly maxWidth: number }): boolean {
  return cellCount(options.maxWidth) < 1;
}

/**
 * One render pass: the outermost `render` or `measure` call — a host's frame,
 * a print — and every `next()` of what it returned, at any depth. Opaque: it
 * is only an identity, which a `State` compares to say whether this pass made
 * it.
 */
export interface Pass {
  readonly __pass: unique symbol;
}

/**
 * A pass as it is being drawn: its identity, and the effects its renders handed
 * it to run once it ends (`afterPass`). A measurement is a pass of the same
 * identity with effects of its own, which nothing runs.
 */
interface Phase {
  readonly pass: Pass;
  readonly effects: (() => void)[];
}

// [LAW:no-shared-mutable-globals] The render phase, owned here and nowhere
// else: only `render` and `measure` below open or enter a pass, and the rest of
// the library reads it through `activePass` and `afterPass`. Set and restored
// like a stack, so "not rendering" is `undefined` and needs no counter.
let active: Phase | undefined;

function runIn<T>(phase: Phase | undefined, run: () => T): T {
  const outer = active;
  active = phase;
  try {
    return run();
  } finally {
    active = outer;
  }
}

/**
 * `handler` run as if between passes: a callback a render makes to user code to
 * report something it met, such as `onStyleError`, is an event handler, and may
 * write what one may — print to a console, set a `State` — as React lets an
 * event handler set state.
 */
export function betweenPasses<T>(handler: () => T): T {
  return runIn(undefined, handler);
}

/** The pass a render or measure in progress belongs to, or `undefined` between passes. */
export function activePass(): Pass | undefined {
  return active?.pass;
}

/**
 * `effect` run once the render pass in progress has drawn its last segment,
 * between passes, where it may write what an event handler may: React's commit
 * phase. A render that learns something only drawing can tell it — the lines
 * content shown through a `Viewport` runs to at the width it was handed —
 * draws from what it learned and hands the commit here, rather than writing it
 * as it draws.
 *
 * Effects run in the order they were handed over, which is document order. A
 * measurement commits nothing, and neither does a pass that throws or whose
 * caller stops iterating it early: nobody saw what it drew. Outside a pass — a
 * renderable's `render` called directly — there is nothing to wait for, and
 * `effect` runs now.
 */
export function afterPass(effect: () => void): void {
  if (active === undefined) effect();
  else active.effects.push(effect);
}

/** The pass in progress, or a new one when this call is the outermost. */
const phaseHere = (): Phase => active ?? { pass: {} as Pass, effects: [] };

/**
 * Every effect `phase`'s renders handed it, run now that it has ended — between
 * passes even when the iteration that ended it was stepped inside another.
 */
function commit(phase: Phase): void {
  runIn(undefined, () => {
    for (const effect of phase.effects.splice(0)) effect();
  });
}

/**
 * `drawn` with every step of its iteration run in `phase`, and its effects
 * committed when the last step is done. A render is often a generator, whose
 * body runs as its caller iterates — after `render` has returned — so the pass
 * is re-entered on each `next()`, however many `yield`s a write sits behind,
 * and ends only when the iteration does. An array has nothing left to run, so
 * its pass has already ended.
 *
 * Only the call that opens the pass is wrapped. A nested render's steps run
 * inside its parent's, which are already in the pass; a nested iterable could
 * only be stepped outside it by being kept somewhere past the render, which
 * takes a writable location `test/seam/render-purity.test.ts` refuses. Wrapping
 * every level cost a third of the render time, once per segment per level.
 */
function withinPass(phase: Phase, drawn: Iterable<Segment>): Iterable<Segment> {
  if (Array.isArray(drawn)) {
    commit(phase);
    return drawn;
  }
  return {
    [Symbol.iterator]: () => {
      const steps = runIn(phase, () => drawn[Symbol.iterator]());
      // On `%IteratorPrototype%`, as a generator's iterator is: iterable
      // itself, and carrying the iterator helpers where the engine has them.
      return Object.assign(Object.create(ITERATOR_PROTOTYPE) as Iterator<Segment>, {
        next: () => {
          const step = runIn(phase, () => steps.next());
          if (step.done === true) commit(phase);
          return step;
        },
        return: (value?: unknown) => runIn(phase, () => steps.return?.(value) ?? { done: true as const, value: undefined }),
        throw: (error?: unknown) =>
          runIn(phase, () => {
            if (steps.throw) return steps.throw(error);
            throw error;
          }),
      });
    },
  };
}

const ITERATOR_PROTOTYPE: object = Object.getPrototypeOf(Object.getPrototypeOf([][Symbol.iterator]()));

/**
 * `renderable` drawn under `options`: Rich's `Console.render`, which every
 * renderable there is drawn through, so under one column nothing is.
 *
 * [LAW:single-enforcer] The one place that rule is kept. Every call of a
 * `Renderable`'s `render` in `src/` goes through here — a container drawing
 * its child, a renderable drawing the text it built, a host drawing a frame —
 * and `test/seam/render-calls.test.ts` fails on one that does not. Before
 * this, each container asked `drawsNothing` itself, and the ones that forgot
 * drew a child handed no column anyway.
 *
 * It is where a render pass is entered (`Pass`), so it is the one place a
 * write during render is refused at: a `State` set in a pass that did not make
 * it throws (`./state.ts`).
 *
 * It is also the one reporter of what the view holds (`onPresent`). Under one
 * column a renderable is held: in the view, with nothing of it on the frame.
 * It is drawn all the same and what it drew dropped (`holding`), so what a held
 * container is reported holding is what it draws, under the options it hands
 * each child — one description of a container's traversal, not a second
 * kept beside it.
 */
export function render(renderable: Renderable, options: RenderOptions): Iterable<Segment> {
  const opens = active === undefined;
  const presence: Presence = drawsNothing(options) ? "held" : "drawn";
  const { phase, drawing } = presence === "drawn" ? { phase: phaseHere(), drawing: options } : holding(options);
  const drawn = runIn(phase, () => {
    options.onPresent?.(renderable, presence);
    return renderable.render(drawing);
  });
  if (presence === "held") {
    runIn(phase, () => {
      for (const _ of drawn);
    });
    return [];
  }
  return opens ? withinPass(phase, drawn) : drawn;
}

/**
 * Where a held renderable is drawn, and the options it is drawn under: what
 * it draws is dropped, and everything it draws is reported held, whatever
 * width it hands it. What it tells of its hold (`onHold`) still reaches the
 * frame: an element not yet entered is held at no width, and must say when it
 * enters and takes some. It commits nothing, as a measurement commits nothing —
 * its effects (`afterPass`) are learned at a width nobody sees, so a
 * `Viewport` it shows content through keeps the scroll the last frame shown
 * left it.
 *
 * [LAW:parse-dont-validate] It is drawn at no column, 0, whatever width under
 * one its container worked out: `drawsNothing` reads a negative or NaN width
 * as none, so none reaches a `render`, where it would be a count no string
 * can repeat.
 */
function holding(options: RenderOptions): { phase: Phase; drawing: RenderOptions } {
  const { onPresent } = options;
  return {
    phase: { pass: phaseHere().pass, effects: [] },
    drawing: { ...options, maxWidth: 0, onPresent: onPresent && ((content) => onPresent(content, "held")) },
  };
}

/**
 * What `measurable` reports under `options`: asked in a render pass, as
 * `render` draws in one, with `measuring`'s options.
 *
 * [LAW:single-enforcer] Every call of a `Measurable`'s `measure` in `src/`
 * goes through here, as every `render` goes through `render`;
 * `test/seam/render-calls.test.ts` holds both.
 */
export function measure(measurable: Measurable, options: RenderOptions): { minimum: number; maximum: number } {
  // The pass's identity, with effects nothing runs: a measurement commits nothing.
  return runIn({ pass: phaseHere().pass, effects: [] }, () => measurable.measure(measuring(options)));
}

/**
 * `options` as a measurement is asked with. A `measure` that renders to learn
 * its shape draws nothing on the frame, so it reports nothing to `onPresent` —
 * one that did would put a widget in the view at the moment a container
 * measured it, and keep one the frame then cropped away. It still tells its
 * hold (`onHold`): a layout decided by a measurement changes when it does.
 *
 * [LAW:single-enforcer] Every measurement starts here: `measure` asks with it.
 */
function measuring(options: RenderOptions): RenderOptions {
  return { ...options, onPresent: undefined };
}

/**
 * The options a renderable should *lay out against*: `withCellWidth`, with an
 * unbounded offer resolved to the renderable's own natural width.
 *
 * [LAW:parse-dont-validate] `cellCount` cannot finish the job alone. It floors
 * a negative width and NaN to zero from the number alone, but `Infinity` is not
 * a quantity it can floor — the only finite answer is "as wide as this
 * renderable's content wants", which is a question about the renderable and not
 * about the number. So the parse is completed here, where the renderable is in
 * hand, and the stamped options travel exactly as `withCellWidth`'s do.
 *
 * [LAW:single-enforcer] One checkpoint for the whole rule, not one per
 * renderable. `Panel`, `Padding`, `Columns` and `Layout` each expand into the
 * width they are offered, and each independently reached `" ".repeat(Infinity)`
 * — Columns twice over, since its column *count* is derived from the width too
 * and `new Array(Infinity)` throws a different error again.
 *
 * The natural width comes from `measure`, which every one of them already
 * implements, and the recursion terminates because `measure` reports content
 * rather than the offer: `Panel.measure({maxWidth: Infinity})` is `{9, 9}` for
 * nine cells of content and frame, not `{9, Infinity}`.
 *
 * So this belongs at the top of `render` and never at the top of `measure`:
 * `measure` is the method being asked, and asking it through here would ask it
 * with itself. `measure` parses with `withCellWidth` and reports a natural
 * width of its own — that is the half of the contract that makes this half work.
 *
 * A `maximum` of `Infinity` means the renderable genuinely cannot answer. Two
 * ways in: it wraps a `Renderable` with no `measure`, so nothing in the tree
 * knows how wide the content wants to be; or something inside it asked for an
 * unbounded width of its own, as a `Table` column declared
 * `{ ratio: Infinity }` does. [LAW:no-silent-failure] Both are unanswerable
 * rather than zero, and saying so names the cause — where `String.repeat` and
 * `new Array` only ever name their own argument.
 */
export function withBoundedWidth(
  options: RenderOptions,
  self: Measurable,
): RenderOptions {
  const parsed = withCellWidth(options);
  if (Number.isFinite(parsed.maxWidth)) return parsed;

  const natural = measure(self, parsed).maximum;
  if (!Number.isFinite(natural)) {
    throw new RangeError(
      "maxWidth is unbounded and this renderable has no natural width to fall " +
        "back on: its content does not implement measure(), or something inside " +
        "it asked for an unbounded width of its own. Render it at a finite " +
        "width, or give the content a measure() that reports a finite maximum.",
    );
  }
  return { ...parsed, maxWidth: cellCount(natural) };
}

export interface Renderable {
  render(options: RenderOptions): Iterable<Segment>;
}

export interface Measurable {
  measure(options: RenderOptions): { minimum: number; maximum: number };
}

/**
 * What the wheel scrolls: an owner of anchors on the frame (`./anchor.ts`)
 * that moves by lines. `canScrollBy` says whether `scrollBy` with the same
 * `lines` would move it; one that would not passes the wheel outward.
 */
export interface Scrollable {
  canScrollBy(lines: number): boolean;
  scrollBy(lines: number): void;
}

export function isRenderable(obj: unknown): obj is Renderable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "render" in obj &&
    typeof (obj as Renderable).render === "function"
  );
}

export function isMeasurable(obj: unknown): obj is Measurable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "measure" in obj &&
    typeof (obj as Measurable).measure === "function"
  );
}

export function isScrollable(obj: object): obj is Scrollable {
  return (
    "canScrollBy" in obj &&
    typeof (obj as Scrollable).canScrollBy === "function" &&
    "scrollBy" in obj &&
    typeof (obj as Scrollable).scrollBy === "function"
  );
}
