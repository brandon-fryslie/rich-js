/**
 * Pure model for the interactive OKLCH theme explorer.
 *
 * Everything here is a pure function of `ExplorerState` — no stdin, no
 * terminal, no MobX. The I/O shell (`explore.ts`) holds one observable
 * `ExplorerState`, feeds keys through `reduce`, and paints `renderFrame`.
 * Keeping the logic pure is what lets the contract be tested without a TTY:
 * "every preview cell is readable", "the selected theme is highlighted",
 * "changing the theme leaves the controls untouched" are all assertions over
 * these functions. [LAW:verifiable-goals]
 *
 * The state is one flat record. Selecting a theme touches only `themeIndex`;
 * the transposition controls keep their values because nothing in the
 * theme-change path writes them — the "orthogonal controls don't reset"
 * requirement holds by construction, not by a guard. [LAW:one-source-of-truth]
 */

import {
  ColorRgba,
  ColorSpec,
  Oklch,
  Palette,
  Panel,
  ProgressBar,
  RichText,
  Segment,
  Style,
  Table,
  cellLen,
  getThemePalette,
  listThemePalettes,
  themeKeyForRoot,
  transposePalette,
  type ThemeKey,
} from "../../src/index.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import {
  contrastRatio,
  ensureContrast,
} from "../../src/themes/colorMath.js";

// ---------------------------------------------------------------------------
// Catalogues
// ---------------------------------------------------------------------------

export const THEME_NAMES: readonly string[] = listThemePalettes();

// Which palette var acts as the musical tonic — the note whose pitch the
// "root hue" control sets. Every theme defines all of these.
export const TONIC_VARS = [
  "primary",
  "accent",
  "secondary",
  "background",
  "foreground",
] as const;
export type TonicVar = (typeof TONIC_VARS)[number];

// The adjustable controls. `theme` is *not* here — it is always driven by
// up/down on the left column, independent of which control has focus.
export const CONTROLS = [
  "tonic",
  "rootHue",
  "chroma",
  "lightness",
  "contrast",
] as const;
export type Control = (typeof CONTROLS)[number];

// Swatches shown in the preview — one decorative trio and the three semantic
// anchors, so anchor-hue-locking is visible next to free rotation.
const SWATCH_VARS = [
  "primary",
  "accent",
  "secondary",
  "error",
  "success",
  "warning",
] as const;

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------

export interface ExplorerState {
  readonly themeIndex: number;
  readonly tonicIndex: number;
  readonly rootHue: number; // degrees, [0, 360)
  readonly chromaScale: number; // [0, 2]
  readonly lightnessShift: number; // [-0.4, 0.4]
  readonly minContrast: number; // WCAG ratio, [3, 7]
  readonly focusedControl: Control;
}

const HUE_STEP = 6;
const CHROMA_STEP = 0.05;
const LIGHT_STEP = 0.02;
const CONTRAST_STEP = 0.5;

const CHROMA_RANGE = { min: 0, max: 2 } as const;
const LIGHT_RANGE = { min: -0.4, max: 0.4 } as const;
const CONTRAST_RANGE = { min: 3, max: 7 } as const;

function clamp(v: number, min: number, max: number): number {
  return v < min ? min : v > max ? max : v;
}

function wrap(i: number, n: number): number {
  return ((i % n) + n) % n;
}

function wrap360(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Natural hue of a theme's tonic var — the rootHue value that means "no
 * transposition" for that theme. */
function naturalRootHue(themeIndex: number, tonicIndex: number): number {
  const palette = getThemePalette(THEME_NAMES[themeIndex]!)!;
  const tonic = palette.get(TONIC_VARS[tonicIndex]!)!;
  return Math.round(Oklch.fromRgba(tonic).h);
}

/** Initial state: theme 0 shown as-is (rootHue = its tonic's natural hue, so
 * the starting transposition is identity). */
export function initialState(): ExplorerState {
  return {
    themeIndex: 0,
    tonicIndex: 0,
    rootHue: naturalRootHue(0, 0),
    chromaScale: 1,
    lightnessShift: 0,
    minContrast: 4.5,
    focusedControl: "rootHue",
  };
}

// ---------------------------------------------------------------------------
// Reducer
// ---------------------------------------------------------------------------

export interface KeyInput {
  readonly key: string;
  readonly character: string;
  readonly shift: boolean;
}

/** Step the focused control by `dir` (-1 / +1). Exhaustive over `Control`:
 * adding a control without a case here is a compile error. */
function adjustFocused(state: ExplorerState, dir: -1 | 1): ExplorerState {
  switch (state.focusedControl) {
    case "tonic":
      return { ...state, tonicIndex: wrap(state.tonicIndex + dir, TONIC_VARS.length) };
    case "rootHue":
      return { ...state, rootHue: wrap360(state.rootHue + dir * HUE_STEP) };
    case "chroma":
      return {
        ...state,
        chromaScale: clamp(state.chromaScale + dir * CHROMA_STEP, CHROMA_RANGE.min, CHROMA_RANGE.max),
      };
    case "lightness":
      return {
        ...state,
        lightnessShift: clamp(state.lightnessShift + dir * LIGHT_STEP, LIGHT_RANGE.min, LIGHT_RANGE.max),
      };
    case "contrast":
      return {
        ...state,
        minContrast: clamp(state.minContrast + dir * CONTRAST_STEP, CONTRAST_RANGE.min, CONTRAST_RANGE.max),
      };
  }
}

function cycleControl(state: ExplorerState, dir: -1 | 1): ExplorerState {
  const idx = CONTROLS.indexOf(state.focusedControl);
  return { ...state, focusedControl: CONTROLS[wrap(idx + dir, CONTROLS.length)]! };
}

/**
 * Map a keypress to the next state. Pure and total — an unrecognized key
 * returns the state unchanged (no throw, no side effect). The whole UI is a
 * fold of this reducer over the keystroke stream. [LAW:dataflow-not-control-flow]
 */
export function reduce(state: ExplorerState, input: KeyInput): ExplorerState {
  switch (input.key) {
    case "up":
      return { ...state, themeIndex: wrap(state.themeIndex - 1, THEME_NAMES.length) };
    case "down":
      return { ...state, themeIndex: wrap(state.themeIndex + 1, THEME_NAMES.length) };
    case "left":
      return adjustFocused(state, -1);
    case "right":
      return adjustFocused(state, 1);
    case "tab":
      return cycleControl(state, input.shift ? -1 : 1);
  }
  // 'r' resets the transposition (not the theme selection or contrast knob).
  if (input.character === "r") {
    return {
      ...state,
      rootHue: naturalRootHue(state.themeIndex, state.tonicIndex),
      chromaScale: 1,
      lightnessShift: 0,
    };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export function tonicVar(state: ExplorerState): TonicVar {
  return TONIC_VARS[state.tonicIndex]!;
}

export function sourcePalette(state: ExplorerState): Palette {
  return getThemePalette(THEME_NAMES[state.themeIndex]!)!;
}

/** The ThemeKey the current controls compose into: root-note hue rotation
 * plus the independent chroma/lightness axes. */
export function keyFor(state: ExplorerState): ThemeKey {
  const base = themeKeyForRoot(sourcePalette(state), tonicVar(state), state.rootHue);
  return { ...base, chromaScale: state.chromaScale, lightnessShift: state.lightnessShift };
}

export function transposedPalette(state: ExplorerState): Palette {
  return transposePalette(sourcePalette(state), keyFor(state));
}

export interface PreviewCell {
  readonly varName: string;
  readonly bg: ColorRgba;
  readonly fg: ColorRgba;
}

function flatten(c: ColorRgba, substrate: ColorRgba): ColorRgba {
  return c.compositeOver(substrate);
}

/**
 * The swatch cells for the current state, each carrying a background and a
 * contrast-guaranteed foreground. The readability invariant lives here: the
 * fg is `ensureContrast(themeFg, cellBg, minContrast)`, so no unreadable pair
 * can reach the renderer. [LAW:single-enforcer]
 */
export function previewCells(state: ExplorerState): PreviewCell[] {
  const palette = transposedPalette(state);
  const bgBase = palette.get("background")!;
  const fg = palette.get("foreground")!;
  const cells: PreviewCell[] = [];
  for (const varName of SWATCH_VARS) {
    const raw = palette.get(varName);
    if (raw === undefined) continue;
    const cellBg = flatten(raw, bgBase);
    cells.push({ varName, bg: cellBg, fg: ensureContrast(fg, cellBg, state.minContrast) });
  }
  return cells;
}

/** The background/foreground sample pair — the most direct readability
 * demonstration (inverted dark themes used to render dark-on-dark here). */
export function sampleCell(state: ExplorerState): PreviewCell {
  const palette = transposedPalette(state);
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;
  return { varName: "sample", bg, fg: ensureContrast(fg, bg, state.minContrast) };
}

// ---------------------------------------------------------------------------
// Rendering (pure: state -> lines of Segments)
// ---------------------------------------------------------------------------

const LIST_WIDTH =
  THEME_NAMES.reduce((m, n) => Math.max(m, cellLen(n)), 0) + 3;
const GAP = " │ ";

function segLen(segs: readonly Segment[]): number {
  return segs.reduce((n, s) => n + cellLen(s.text), 0);
}

function pad(segs: Segment[], width: number): Segment[] {
  const deficit = width - segLen(segs);
  return deficit > 0 ? [...segs, new Segment(" ".repeat(deficit))] : segs;
}

function spec(c: ColorRgba): ColorSpec {
  return ColorSpec.fromRgba(c);
}

/** Window of theme rows that keeps `selected` visible within `capacity`
 * rows. Pure; tested directly. */
export function themeWindow(
  count: number,
  selected: number,
  capacity: number,
): { start: number; end: number } {
  if (count <= capacity) return { start: 0, end: count };
  let start = selected - Math.floor(capacity / 2);
  start = clamp(start, 0, count - capacity);
  return { start, end: start + capacity };
}

const DIM = new Style({ dim: true });
const BOLD = new Style({ bold: true });

function themeColumn(state: ExplorerState, capacity: number): Segment[][] {
  const { start, end } = themeWindow(THEME_NAMES.length, state.themeIndex, capacity);
  const lines: Segment[][] = [];
  for (let i = start; i < end; i++) {
    const name = THEME_NAMES[i]!;
    const selected = i === state.themeIndex;
    const marker = selected ? "▸ " : "  ";
    const style = selected
      ? new Style({ bold: true, reverse: true })
      : DIM;
    lines.push([new Segment(`${marker}${name}`, style)]);
  }
  return lines;
}

function bar(value: number, min: number, max: number, width: number): string {
  const frac = max === min ? 0 : clamp((value - min) / (max - min), 0, 1);
  const pos = Math.round(frac * (width - 1));
  let s = "";
  for (let i = 0; i < width; i++) s += i === pos ? "●" : "─";
  return `◀${s}▶`;
}

function controlLine(
  state: ExplorerState,
  control: Control,
  label: string,
  valueText: string,
  barText: string,
): Segment[] {
  const focused = state.focusedControl === control;
  const marker = focused ? "▸ " : "  ";
  const labelStyle = focused ? new Style({ bold: true, color: spec(new ColorRgba(120, 220, 230)) }) : DIM;
  return [
    new Segment(marker, labelStyle),
    new Segment(`${label}: `, labelStyle),
    new Segment(valueText, focused ? BOLD : new Style({})),
    new Segment(`  ${barText}`, DIM),
  ];
}

// ---------------------------------------------------------------------------
// Application mock — a representative dashboard recolored from the palette.
//
// Decorative roles (primary border, accent nav/progress, secondary button)
// appear as *fills* so their hue is visible and rotates with the root note.
// Semantic roles (success/warning/error) are anchored, so the service
// statuses keep their meaning in every key — "down" stays red. All text is
// run through ensureContrast against its actual fill, so nothing renders
// unreadable. [LAW:single-enforcer]
// ---------------------------------------------------------------------------

interface ServiceRow {
  readonly name: string;
  readonly statusVar: "success" | "warning" | "error";
  readonly label: string;
  readonly latency: string;
}

const SERVICES: readonly ServiceRow[] = [
  { name: "auth-gateway", statusVar: "success", label: "ok", latency: "12 ms" },
  { name: "billing", statusVar: "warning", label: "degraded", latency: "88 ms" },
  { name: "search-index", statusVar: "error", label: "down", latency: "—" },
  { name: "cdn-edge", statusVar: "success", label: "ok", latency: "9 ms" },
];

/** Foreground readable against `bg`, as a ColorSpec. */
function readable(fg: ColorRgba, bg: ColorRgba, min: number): ColorSpec {
  return spec(ensureContrast(fg, bg, min));
}

/** Append a filled "pill": the fill color as background (its hue shows), with
 * readable text on top. */
function appendPill(
  rt: RichText,
  label: string,
  fill: ColorRgba,
  palette: Palette,
  min: number,
): void {
  const bg = palette.get("background")!;
  const fgBase = palette.get("foreground")!;
  const flat = fill.compositeOver(bg);
  rt.append(label, new Style({ bgcolor: spec(flat), color: readable(fgBase, flat, min) }));
}

function collectLines(r: Renderable, width: number): Segment[][] {
  const opts: RenderOptions = { maxWidth: width };
  return Segment.splitLines([...r.render(opts)]);
}

/** Render `lines` back as a Renderable. Splitting each child into its own
 * lines and concatenating the arrays avoids Group's segment-concatenation,
 * which merges adjacent single-line renderables onto one row. */
function linesToRenderable(lines: Segment[][]): Renderable {
  return { render: () => framesToSegments(lines) };
}

export function appMock(palette: Palette, min: number, width: number): Segment[][] {
  const bg = palette.get("background")!;
  const fg = palette.get("foreground")!;
  const get = (v: string): ColorRgba => palette.get(v) ?? fg;
  const accent = get("accent");
  const primary = get("primary");
  const secondary = get("secondary");
  const bodyFg = readable(fg, bg, min);

  const nav = new RichText("");
  nav.append(" ", new Style({}));
  appendPill(nav, " Dashboard ", accent, palette, min);
  nav.append("   Services    Logs    Settings", new Style({ color: bodyFg, dim: true }));

  const reqLabel = new RichText("Requests / min          78%", { style: new Style({ color: bodyFg }) });
  const progress = new ProgressBar({
    total: 100,
    completed: 78,
    width: Math.min(48, Math.max(10, width - 6)),
    completeStyle: new Style({ color: spec(accent.compositeOver(bg)) }),
    style: new Style({ color: bodyFg, dim: true }),
  });

  const table = new Table({ box: null, expand: false, padding: [0, 2, 0, 0], showEdge: false });
  const headCell = (t: string): RichText => new RichText(t, { style: new Style({ bold: true, color: bodyFg }) });
  table.addColumn(headCell("Service"));
  table.addColumn(headCell("Status"));
  table.addColumn(headCell("Latency"), { justify: "right" });
  for (const s of SERVICES) {
    const nameCell = new RichText(s.name, { style: new Style({ color: bodyFg }) });
    const statusCell = new RichText("");
    appendPill(statusCell, ` ${s.label} `, get(s.statusVar), palette, min);
    const latCell = new RichText(s.latency, { style: new Style({ color: bodyFg, dim: true }) });
    table.addRow(nameCell, statusCell, latCell);
  }

  const buttons = new RichText("");
  appendPill(buttons, " Deploy ", primary, palette, min);
  buttons.append("  ");
  appendPill(buttons, " Rollback ", secondary, palette, min);

  const innerWidth = Math.max(20, width - 4); // 2 border + 2 horizontal padding
  const body: Segment[][] = [
    ...collectLines(nav, innerWidth),
    [],
    ...collectLines(reqLabel, innerWidth),
    ...collectLines(progress, innerWidth),
    [],
    ...collectLines(table, innerWidth),
    [],
    ...collectLines(buttons, innerWidth),
  ];
  const panel = new Panel(linesToRenderable(body), {
    title: "aurora-api  ·  dashboard",
    titleStyle: new Style({ bold: true, color: readable(accent.compositeOver(bg), bg, min) }),
    borderStyle: new Style({ color: spec(primary.compositeOver(bg)) }),
    style: new Style({ bgcolor: spec(bg), color: bodyFg }),
    width,
    padding: [0, 1, 0, 1],
  });
  return collectLines(panel, width);
}

function rightPane(state: ExplorerState, rightWidth: number): Segment[][] {
  const palette = transposedPalette(state);
  const src = sourcePalette(state);
  const lines: Segment[][] = [];

  lines.push([
    new Segment("OKLCH Theme Explorer", new Style({ bold: true, color: spec(new ColorRgba(120, 220, 230)) })),
  ]);
  lines.push([
    new Segment(`${THEME_NAMES[state.themeIndex]}`, BOLD),
    new Segment(palette.dark ? "  (dark)" : "  (light)", DIM),
    new Segment(`   source ${src.dark ? "dark" : "light"}`, DIM),
  ]);
  lines.push([]);

  lines.push(controlLine(state, "tonic", "Tonic", tonicVar(state), ""));
  lines.push(
    controlLine(
      state,
      "rootHue",
      "Root hue",
      `${state.rootHue}°`,
      bar(state.rootHue, 0, 360, 18),
    ),
  );
  lines.push(
    controlLine(
      state,
      "chroma",
      "Chroma  ×",
      state.chromaScale.toFixed(2),
      bar(state.chromaScale, CHROMA_RANGE.min, CHROMA_RANGE.max, 14),
    ),
  );
  lines.push(
    controlLine(
      state,
      "lightness",
      "Lightness",
      (state.lightnessShift >= 0 ? "+" : "") + state.lightnessShift.toFixed(2),
      bar(state.lightnessShift, LIGHT_RANGE.min, LIGHT_RANGE.max, 14),
    ),
  );
  lines.push(
    controlLine(
      state,
      "contrast",
      "Min contrast",
      `${state.minContrast.toFixed(1)}:1`,
      bar(state.minContrast, CONTRAST_RANGE.min, CONTRAST_RANGE.max, 14),
    ),
  );
  lines.push([]);

  // Live application preview — the same renderables a real app uses, recolored
  // from the transposed palette. This is where transposition earns its keep:
  // the decorative chrome rotates with the root note while the service
  // statuses hold their meaning.
  for (const l of appMock(palette, state.minContrast, Math.max(40, rightWidth))) {
    lines.push(l);
  }
  lines.push([]);

  // Honest readout: the weakest text/background contrast currently in view.
  const ratios = [...previewCells(state), sampleCell(state)].map((c) =>
    contrastRatio(c.fg, c.bg),
  );
  const worst = Math.min(...ratios);
  lines.push([
    new Segment("weakest text contrast in view: ", DIM),
    new Segment(`${worst.toFixed(1)}:1`, BOLD),
    new Segment(`   (floor ${state.minContrast.toFixed(1)}:1)`, DIM),
  ]);
  lines.push([]);
  lines.push([
    new Segment(
      "↑/↓ theme · Tab control · ←/→ adjust · r reset · q quit",
      DIM,
    ),
  ]);
  return lines;
}

/**
 * Compose the full frame: persistent theme column on the left, live preview
 * on the right, zipped row-by-row. Pure — `renderFrame(s)` is the single
 * source of what the screen shows for state `s`. [LAW:dataflow-not-control-flow]
 */
export function renderFrame(
  state: ExplorerState,
  width: number,
  height: number,
): Segment[][] {
  const capacity = Math.max(1, height - 1);
  const left = themeColumn(state, capacity);
  const rightWidth = width - LIST_WIDTH - cellLen(GAP);
  const right = rightPane(state, rightWidth);
  const rows = Math.max(left.length, right.length);
  const out: Segment[][] = [];
  for (let i = 0; i < rows; i++) {
    const l = pad(left[i] ?? [], LIST_WIDTH);
    const r = right[i] ?? [];
    out.push([...l, new Segment(GAP, DIM), ...r]);
  }
  return out;
}

/** Flatten lines into a single Segment stream with newline separators —
 * the form a `StaticItem` render returns. */
export function framesToSegments(lines: Segment[][]): Segment[] {
  const out: Segment[] = [];
  for (let i = 0; i < lines.length; i++) {
    if (i > 0) out.push(new Segment("\n"));
    out.push(...lines[i]!);
  }
  return out;
}
