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

// The adjustable controls. `theme` is *not* here — it is always driven by
// up/down on the left column, independent of which control has focus.
export const CONTROLS = [
  "rootHue",
  "chroma",
  "lightness",
  "contrast",
] as const;
export type Control = (typeof CONTROLS)[number];

// The two preview views. `showcase` is the dense single page that exercises
// nearly every theme var; `app` is the focused dashboard. Toggled with `v`.
export const VIEWS_ORDER = ["showcase", "app"] as const;
export type View = (typeof VIEWS_ORDER)[number];

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
  readonly rootHue: number; // uniform hue-rotation offset in degrees
  readonly chromaScale: number; // [0, 2]
  readonly lightnessShift: number; // [-0.4, 0.4]
  readonly minContrast: number; // WCAG ratio, [3, 7]
  readonly focusedControl: Control;
  readonly view: View;
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

/** Map [0,360) to a signed offset in (-180, 180] for relative-mode display. */
function signedDeg(deg: number): number {
  return ((wrap360(deg) + 180) % 360) - 180;
}

/** Initial state: 0° offset, so every theme opens exactly as authored and
 * flipping themes keeps you at "as authored" until you dial. */
export function initialState(): ExplorerState {
  return {
    themeIndex: 0,
    rootHue: 0,
    chromaScale: 1,
    lightnessShift: 0,
    minContrast: 4.5,
    focusedControl: "rootHue",
    view: "showcase",
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
  // 'r' resets the transposition (not the theme selection or contrast knob):
  // 0° offset = the theme as authored.
  if (input.character === "r") {
    return {
      ...state,
      rootHue: 0,
      chromaScale: 1,
      lightnessShift: 0,
    };
  }
  // 'v' toggles the preview between the dense showcase and the app dashboard.
  if (input.character === "v") {
    const idx = VIEWS_ORDER.indexOf(state.view);
    return { ...state, view: VIEWS_ORDER[wrap(idx + 1, VIEWS_ORDER.length)]! };
  }
  return state;
}

// ---------------------------------------------------------------------------
// Derivations
// ---------------------------------------------------------------------------

export function sourcePalette(state: ExplorerState): Palette {
  return getThemePalette(THEME_NAMES[state.themeIndex]!)!;
}

/** The ThemeKey the current controls compose into: a uniform hue-rotation
 * offset plus the independent chroma/lightness axes. Transposition is a
 * uniform rotation, so the offset is the hue shift directly — no reference
 * note needed. */
export function keyFor(state: ExplorerState): ThemeKey {
  return {
    hueShift: wrap360(state.rootHue),
    chromaScale: state.chromaScale,
    lightnessScale: 1,
    lightnessShift: state.lightnessShift,
  };
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

/**
 * Stamp the app surface background onto every cell of every line and pad each
 * line to `width`. Segments in this codebase carry independent styles with no
 * cascade, so a foreground-only segment otherwise falls through to the
 * terminal's ambient background — fine on a dark theme, wrong on a light one.
 * Using `surfaceBase.add(seg.style)` lets a pill's own bg win while everything
 * else inherits the theme background. [LAW:single-enforcer] one place owns
 * "the app surface is this color"; no renderable has to remember to set it.
 */
function stampSurface(lines: Segment[][], bgSpec: ColorSpec, width: number): Segment[][] {
  const base = new Style({ bgcolor: bgSpec });
  return lines.map((line) => {
    const stamped = line.map((s) => new Segment(s.text, base.add(s.style)));
    const used = stamped.reduce((n, s) => n + cellLen(s.text), 0);
    if (used < width) stamped.push(new Segment(" ".repeat(width - used), base));
    return stamped;
  });
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
  const surface = stampSurface(body, spec(bg), innerWidth);
  const panel = new Panel(linesToRenderable(surface), {
    title: "aurora-api  ·  dashboard",
    titleStyle: new Style({ bold: true, color: readable(accent.compositeOver(bg), bg, min) }),
    borderStyle: new Style({ color: spec(primary.compositeOver(bg)) }),
    style: new Style({ bgcolor: spec(bg), color: bodyFg }),
    width,
    padding: [0, 1, 0, 1],
  });
  return collectLines(panel, width);
}

// ===========================================================================
// Showcase view — a dense single page exercising as many theme vars as
// possible. Each family of vars drives the UI element it was designed for:
// markdown-h* → a document, footer-* → a command bar, *-darken/lighten-* → a
// tonal ramp, and so on. Color coverage is a consequence of using every
// family for its purpose, not of dumping swatches.
// ===========================================================================

const RAMP_ROLES = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
const RAMP_STEPS = ["darken-3", "darken-2", "darken-1", "", "lighten-1", "lighten-2", "lighten-3"] as const;

/** A var's color flattened over `onBg`, defaulting to foreground if absent. */
function colorOf(palette: Palette, varName: string, onBg: ColorRgba): ColorRgba {
  return (palette.get(varName) ?? palette.get("foreground")!).compositeOver(onBg);
}

/** A solid block of `color` drawn as foreground glyphs (covers its cells
 * regardless of the surface stamp behind it). */
function solid(color: ColorRgba, width: number): Segment {
  return new Segment("█".repeat(width), new Style({ color: spec(color) }));
}

/** Readable text in `varName`'s color against `onBg`. */
function textIn(
  palette: Palette,
  varName: string,
  onBg: ColorRgba,
  min: number,
  extra?: { bold?: boolean; underline?: boolean; dim?: boolean },
): Style {
  const c = palette.get(varName) ?? palette.get("foreground")!;
  return new Style({ color: spec(ensureContrast(c, onBg, min)), ...extra });
}

function pad2(text: string, width: number): string {
  const len = cellLen(text);
  return len >= width ? text : text + " ".repeat(width - len);
}

function headerBar(palette: Palette, min: number, width: number): Segment[][] {
  const barBg = colorOf(palette, "primary-background", palette.get("background")!);
  const line: Segment[] = [
    new Segment(" ⬢ aurora ", new Style({ bgcolor: spec(barBg), color: textIn(palette, "text", barBg, min, { bold: true }).color })),
    new Segment("  Files   Edit   View   ", new Style({ bgcolor: spec(barBg), color: textIn(palette, "text-muted", barBg, min).color })),
    new Segment("Run", new Style({ bgcolor: spec(barBg), color: textIn(palette, "text-accent", barBg, min, { bold: true }).color })),
    new Segment("   ⌘K to search", new Style({ bgcolor: spec(barBg), color: textIn(palette, "text-disabled", barBg, min).color })),
  ];
  return stampSurface([line], spec(barBg), width);
}

function markdownCard(palette: Palette, min: number, width: number): Segment[][] {
  const cardBg = colorOf(palette, "panel", palette.get("background")!);
  const lines: Segment[][] = [];
  lines.push([new Segment(" Document ", new Style({ color: textIn(palette, "text-muted", cardBg, min, { bold: true }).color })) ]);
  for (const lvl of [1, 2, 3, 4, 5, 6] as const) {
    const hbg = colorOf(palette, `markdown-h${lvl}-background`, cardBg);
    const fgc = palette.get(`markdown-h${lvl}-color`) ?? palette.get("foreground")!;
    lines.push([
      new Segment(
        pad2(` H${lvl}  Heading level ${lvl}`, width),
        new Style({ bgcolor: spec(hbg), color: spec(ensureContrast(fgc, hbg, min)), bold: lvl <= 2 }),
      ),
    ]);
  }
  lines.push([
    new Segment("Body copy in ", textIn(palette, "text", cardBg, min)),
    new Segment("text", textIn(palette, "text", cardBg, min, { bold: true })),
    new Segment(", ", textIn(palette, "text", cardBg, min)),
    new Segment("muted", textIn(palette, "text-muted", cardBg, min)),
    new Segment(", ", textIn(palette, "text", cardBg, min)),
    new Segment("disabled", textIn(palette, "text-disabled", cardBg, min)),
  ]);
  lines.push([
    new Segment("→ a hyperlink", textIn(palette, "link-color", cardBg, min, { underline: true })),
    new Segment("   visited", textIn(palette, "link-color-hover", cardBg, min, { underline: true })),
  ]);
  return stampSurface(lines, spec(cardBg), width);
}

function rampGrid(palette: Palette, min: number, width: number): Segment[][] {
  const bg = palette.get("background")!;
  const lines: Segment[][] = [];
  lines.push([
    new Segment("Tonal ramps  ", textIn(palette, "text-muted", bg, min, { bold: true })),
    new Segment("darken ◂ base ▸ lighten        muted", textIn(palette, "text-disabled", bg, min)),
  ]);
  for (const role of RAMP_ROLES) {
    const segs: Segment[] = [new Segment(pad2(role, 10), textIn(palette, `text-${role}`, bg, min, { bold: true }))];
    for (const step of RAMP_STEPS) {
      const v = step ? `${role}-${step}` : role;
      segs.push(solid(colorOf(palette, v, bg), 4));
      segs.push(new Segment(" "));
    }
    segs.push(new Segment("  "));
    segs.push(solid(colorOf(palette, `${role}-muted`, bg), 5));
    lines.push(segs);
  }
  return stampSurface(lines, spec(bg), width);
}

const SURFACE_ROLES = ["background", "surface", "panel", "boost"] as const;

function surfaceRamp(palette: Palette, min: number, width: number): Segment[][] {
  const bg = palette.get("background")!;
  const lines: Segment[][] = [
    [
      new Segment("Surfaces  ", textIn(palette, "text-muted", bg, min, { bold: true })),
      new Segment("darken ◂ base ▸ lighten", textIn(palette, "text-disabled", bg, min)),
    ],
  ];
  const ramp = (label: string, prefix: string, tailVar?: string): Segment[] => {
    const segs: Segment[] = [new Segment(pad2(label, 11), textIn(palette, "text", bg, min))];
    for (const step of RAMP_STEPS) {
      segs.push(solid(colorOf(palette, step ? `${prefix}-${step}` : prefix, bg), 4));
      segs.push(new Segment(" "));
    }
    if (tailVar) {
      segs.push(new Segment("  "));
      segs.push(solid(colorOf(palette, tailVar, bg), 5));
    }
    return segs;
  };
  for (const role of SURFACE_ROLES) lines.push(ramp(role, role));
  lines.push(ramp("foreground", "foreground", "foreground-disabled"));
  return stampSurface(lines, spec(bg), width);
}

function sidebar(palette: Palette, min: number, width: number): Segment[][] {
  const cardBg = colorOf(palette, "panel", palette.get("background")!);
  const fg = palette.get("foreground")!;
  const railWidth = Math.max(8, width - 1);
  const lines: Segment[][] = [
    [new Segment(" Navigation ", new Style({ color: textIn(palette, "text-muted", cardBg, min, { bold: true }).color }))],
  ];
  // selected (block cursor), hovered (block hover), then plain items; a
  // scrollbar rail on the right edge uses thumb/active/track colors.
  const cursorBg = colorOf(palette, "block-cursor-background", cardBg);
  const hoverBg = colorOf(palette, "block-hover-background", cardBg);
  const thumb = colorOf(palette, "scrollbar", cardBg);
  const thumbActive = colorOf(palette, "scrollbar-active", cardBg);
  const track = colorOf(palette, "scrollbar-background", cardBg);
  const rail = (color: ColorRgba): Segment => new Segment("█", new Style({ color: spec(color) }));
  const items: Array<[string, "selected" | "hover" | "plain", ColorRgba]> = [
    ["Overview", "selected", thumbActive],
    ["Services", "hover", thumb],
    ["Metrics", "plain", thumb],
    ["Logs", "plain", track],
    ["Alerts", "plain", track],
  ];
  for (const [label, kind, railColor] of items) {
    const cellWidth = railWidth;
    let cell: Segment;
    if (kind === "selected") {
      cell = new Segment(pad2(` ▸ ${label}`, cellWidth), new Style({ bgcolor: spec(cursorBg), color: spec(ensureContrast(palette.get("block-cursor-foreground") ?? fg, cursorBg, min)) }));
    } else if (kind === "hover") {
      cell = new Segment(pad2(`   ${label}`, cellWidth), new Style({ bgcolor: spec(hoverBg), color: spec(ensureContrast(fg, hoverBg, min)) }));
    } else {
      cell = new Segment(pad2(`   ${label}`, cellWidth), textIn(palette, "text-muted", cardBg, min));
    }
    lines.push([cell, rail(railColor)]);
  }
  // a hairline using the border var
  lines.push([new Segment("─".repeat(railWidth), new Style({ color: spec(colorOf(palette, "border", cardBg)) }))]);
  return stampSurface(lines, spec(cardBg), width);
}

function statusLog(palette: Palette, min: number, width: number): Segment[][] {
  const cardBg = colorOf(palette, "surface", palette.get("background")!);
  const rows: Array<[string, string, string]> = [
    ["error", "search-index", "connection refused (ECONNREFUSED)"],
    ["warning", "billing", "p99 latency 88ms exceeds budget"],
    ["success", "auth-gateway", "health check passed in 12ms"],
    ["success", "cdn-edge", "cache hit ratio 99.2%"],
  ];
  const lines: Segment[][] = [];
  lines.push([new Segment(" Activity ", new Style({ color: textIn(palette, "text-muted", cardBg, min, { bold: true }).color }))]);
  for (const [sev, svc, msg] of rows) {
    const tag = colorOf(palette, sev, cardBg);
    lines.push([
      new Segment(` ${pad2(sev.toUpperCase(), 8)}`, new Style({ bgcolor: spec(tag), color: spec(ensureContrast(palette.get("foreground")!, tag, min)) })),
      new Segment(`  ${pad2(svc, 14)}`, textIn(palette, `text-${sev}`, cardBg, min, { bold: true })),
      new Segment(msg, textIn(palette, "foreground-muted", cardBg, min)),
    ]);
  }
  return stampSurface(lines, spec(cardBg), width);
}

function componentsCard(palette: Palette, min: number, width: number): Segment[][] {
  const cardBg = colorOf(palette, "surface", palette.get("background")!);
  const lines: Segment[][] = [];
  lines.push([new Segment(" Controls ", new Style({ color: textIn(palette, "text-muted", cardBg, min, { bold: true }).color }))]);

  const button = (label: string, fillVar: string): Segment => {
    const fill = colorOf(palette, fillVar, cardBg);
    return new Segment(` ${label} `, new Style({ bgcolor: spec(fill), color: spec(ensureContrast(palette.get("button-foreground") ?? palette.get("foreground")!, fill, min)) }));
  };
  lines.push([
    button("Deploy", "primary"),
    new Segment(" "),
    button("pressed", "primary-darken-1"),
    new Segment("  "),
    button("Stage", "secondary"),
    new Segment(" "),
    button("Review", "accent"),
  ]);

  // Text input mock with a selection span and a block cursor.
  const selBg = colorOf(palette, "input-selection-background", cardBg);
  const curBg = colorOf(palette, "input-cursor-background", cardBg);
  lines.push([
    new Segment(" ", textIn(palette, "text", cardBg, min)),
    new Segment("search ", textIn(palette, "text-muted", cardBg, min)),
    new Segment("aurora", new Style({ bgcolor: spec(selBg), color: spec(ensureContrast(palette.get("foreground")!, selBg, min)) })),
    new Segment("-api", textIn(palette, "text", cardBg, min)),
    new Segment(" ", new Style({ bgcolor: spec(curBg), color: spec(ensureContrast(palette.get("input-cursor-foreground") ?? palette.get("foreground")!, curBg, min)) })),
  ]);

  // A toggle (on = success fill) and a muted off state.
  const onBg = colorOf(palette, "success", cardBg);
  const offBg = colorOf(palette, "surface-lighten-2", cardBg);
  lines.push([
    new Segment(" ●ON ", new Style({ bgcolor: spec(onBg), color: spec(ensureContrast(palette.get("foreground")!, onBg, min)) })),
    new Segment("  "),
    new Segment(" OFF○ ", new Style({ bgcolor: spec(offBg), color: spec(ensureContrast(palette.get("foreground")!, offBg, min)) })),
  ]);
  return stampSurface(lines, spec(cardBg), width);
}

function footerBar(palette: Palette, min: number, width: number): Segment[][] {
  const barBg = colorOf(palette, "footer-background", palette.get("background")!);
  const keyBg = colorOf(palette, "footer-key-background", barBg);
  const descBg = colorOf(palette, "footer-description-background", barBg);
  const seg: Segment[] = [];
  const bind = (key: string, desc: string): void => {
    seg.push(new Segment(` ${key} `, new Style({ bgcolor: spec(keyBg), color: spec(ensureContrast(palette.get("footer-key-foreground") ?? palette.get("foreground")!, keyBg, min)) })));
    seg.push(new Segment(` ${desc} `, new Style({ bgcolor: spec(descBg), color: spec(ensureContrast(palette.get("footer-description-foreground") ?? palette.get("foreground")!, descBg, min)) })));
    seg.push(new Segment(" ", new Style({ bgcolor: spec(barBg) })));
  };
  bind("^p", "palette");
  bind("^s", "save");
  bind("^r", "run");
  bind("^q", "quit");
  return stampSurface([seg], spec(barBg), width);
}

function joinColumns(left: Segment[][], right: Segment[][], leftWidth: number, gap: number): Segment[][] {
  const rows = Math.max(left.length, right.length);
  const out: Segment[][] = [];
  for (let i = 0; i < rows; i++) {
    const l = pad(left[i] ?? [], leftWidth);
    out.push([...l, new Segment(" ".repeat(gap)), ...(right[i] ?? [])]);
  }
  return out;
}

/**
 * The dense single-page showcase. Pure: `renderShowcase(palette)` is the one
 * source of what the page shows. Lays out a header, a two-column body, and a
 * footer command bar, then stamps the page background so margins and gaps
 * read as one surface. [LAW:dataflow-not-control-flow]
 */
export function renderShowcase(palette: Palette, min: number, width: number): Segment[][] {
  const bg = palette.get("background")!;
  const gap = 3;
  const leftWidth = Math.max(30, Math.floor((width - gap) * 0.5));
  const rightWidth = Math.max(30, width - gap - leftWidth);

  const leftCol: Segment[][] = [
    ...markdownCard(palette, min, leftWidth),
    [],
    ...sidebar(palette, min, leftWidth),
    [],
    ...statusLog(palette, min, leftWidth),
  ];
  const rightCol: Segment[][] = [
    ...rampGrid(palette, min, rightWidth),
    [],
    ...surfaceRamp(palette, min, rightWidth),
    [],
    ...componentsCard(palette, min, rightWidth),
  ];

  const page: Segment[][] = [
    ...headerBar(palette, min, width),
    [],
    ...joinColumns(leftCol, rightCol, leftWidth, gap),
    [],
    ...footerBar(palette, min, width),
  ];
  return stampSurface(page, spec(bg), width);
}

// [LAW:dataflow-not-control-flow] The view is a value; this registry maps it
// to a renderer. `rightPane` indexes it instead of branching on the view.
const VIEWS: Record<View, (palette: Palette, min: number, width: number) => Segment[][]> = {
  showcase: renderShowcase,
  app: appMock,
};

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

  {
    // One independent number: the offset applied to the theme. It does not
    // change on theme switch. The effective hue lives in the rendered colors,
    // not as a second (derived) number that would appear to mutate.
    const off = signedDeg(state.rootHue);
    lines.push(
      controlLine(
        state,
        "rootHue",
        "Root hue",
        `${off >= 0 ? "+" : ""}${off}°`,
        bar(off, -180, 180, 16),
      ),
    );
  }
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

  // Live preview, recolored from the transposed palette. The view is data:
  // VIEWS selects which renderer runs, both pure. [LAW:dataflow-not-control-flow]
  for (const l of VIEWS[state.view](palette, state.minContrast, Math.max(40, rightWidth))) {
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
      `↑/↓ theme · Tab control · ←/→ adjust · r reset · v view [${state.view}] · q quit`,
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
