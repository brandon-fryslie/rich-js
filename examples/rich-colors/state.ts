import { ColorSpec, TerminalTheme, DEFAULT_TERMINAL_THEME, MONOKAI, SVG_EXPORT_THEME, ANSI_COLOR_NAMES } from "../../src/index.js";
import { generatePalette } from "./color-math.js";

/**
 * Application state for rich-colors demo.
 *
 * [LAW:one-source-of-truth] All UI state lives in AppState. Derived data
 * (generated palettes) is computed on-demand in reducers.
 *
 * [LAW:dataflow-not-control-flow] Every frame executes the same render and
 * reduce operations. Variability lives in the data (null vs ColorSpec, different
 * palette modes), never in skipped operations.
 */

export type PaletteMode = "complementary" | "analogous" | "triadic" | "tetradic" | "square" | "monochromatic" | "shades" | "tints";
export type ColorSystemMode = "truecolor" | "256" | "16" | "windows";
export type AppMode = "browsing" | "inputting";
export type FocusTarget = "palette_grid" | "color_system" | "theme";

export interface AppState {
  // Input & parsing
  readonly inputFilter: string;                    // what user typed for filtering
  readonly filteredColorNames: string[];           // matching color names
  readonly filteredColorIndex: number;             // current selection in filtered list
  readonly baseColor: ColorSpec | null;                // parsed ColorSpec, null if none selected
  readonly parseError: string | null;              // error message if parse fails

  // Palette generation - store all 8 modes simultaneously
  readonly allPalettes: Record<PaletteMode, ColorSpec[] | null>;  // all 8 palette modes
  readonly selectedPaletteMode: PaletteMode;      // which mode is selected (for expansion)

  // Display options
  readonly colorSystemMode: ColorSystemMode;
  readonly selectedTheme: TerminalTheme;
  readonly showDetails: boolean;

  // Navigation
  readonly focus: FocusTarget;
  readonly selectedColorIndexInPalette: number;

  // UI state
  readonly mode: AppMode;
  readonly statusMessage: string | null;
}

export type Action =
  | { type: "set-input-filter"; value: string }
  | { type: "navigate-filtered-colors"; delta: 1 | -1 }
  | { type: "select-filtered-color"; name: string }
  | { type: "cycle-palette-mode"; delta: 1 | -1 }
  | { type: "cycle-color-system"; delta: 1 | -1 }
  | { type: "cycle-theme"; delta: 1 | -1 }
  | { type: "toggle-details" }
  | { type: "move-palette-selection"; delta: 1 | -1 }
  | { type: "move-focus"; delta: 1 | -1 }
  | { type: "set-status"; message: string }
  | { type: "start-input-mode" }
  | { type: "exit-input-mode" }
  | { type: "clear-status" }
  | { type: "quit" }
  | { type: "none" };

const PALETTE_MODES: PaletteMode[] = ["complementary", "analogous", "triadic", "tetradic", "square", "monochromatic", "shades", "tints"];
const COLOR_SYSTEMS: ColorSystemMode[] = ["truecolor", "256", "16", "windows"];
const THEMES: TerminalTheme[] = [DEFAULT_TERMINAL_THEME, MONOKAI, SVG_EXPORT_THEME];
const FOCUS_TARGETS: FocusTarget[] = ["palette_grid", "color_system", "theme"];

/**
 * Create initial application state.
 */
export function initialState(startColor: string = "#2b923e"): AppState {
  const baseColor = parseColor(startColor);
  const allPalettes = computeAllPalettes(baseColor);

  return {
    inputFilter: "",
    filteredColorNames: [],
    filteredColorIndex: 0,
    baseColor,
    parseError: baseColor ? null : `Invalid color: ${startColor}`,
    allPalettes,
    selectedPaletteMode: "complementary",
    colorSystemMode: "truecolor",
    selectedTheme: DEFAULT_TERMINAL_THEME,
    showDetails: false,
    focus: "palette_grid",
    selectedColorIndexInPalette: 0,
    mode: "browsing",
    statusMessage: null,
  };
}

/**
 * Reduce application state given an action.
 *
 * [LAW:single-enforcer] All state mutations happen here. No mutations outside.
 */
export function reduce(state: AppState, action: Action): AppState {
  if (action.type === "set-input-filter") {
    return reduceSetInputFilter(state, action.value);
  } else if (action.type === "navigate-filtered-colors") {
    return reduceNavigateFilteredColors(state, action.delta);
  } else if (action.type === "select-filtered-color") {
    return reduceSelectFilteredColor(state, action.name);
  } else if (action.type === "cycle-palette-mode") {
    return reduceCyclePaletteMode(state, action.delta);
  } else if (action.type === "cycle-color-system") {
    return reduceCycleColorSystem(state, action.delta);
  } else if (action.type === "cycle-theme") {
    return reduceCycleTheme(state, action.delta);
  } else if (action.type === "toggle-details") {
    return { ...state, showDetails: !state.showDetails };
  } else if (action.type === "move-palette-selection") {
    return reduceMoveSelection(state, action.delta);
  } else if (action.type === "move-focus") {
    return reduceMoveForward(state, action.delta);
  } else if (action.type === "start-input-mode") {
    return { ...state, mode: "inputting", inputFilter: "", filteredColorIndex: 0, parseError: null };
  } else if (action.type === "exit-input-mode") {
    return { ...state, mode: "browsing" };
  } else if (action.type === "set-status") {
    return { ...state, statusMessage: action.message };
  } else if (action.type === "clear-status") {
    return { ...state, statusMessage: null };
  } else {
    return state;
  }
}

function reduceSetInputFilter(state: AppState, filter: string): AppState {
  // [LAW:dataflow-not-control-flow] Filter is applied uniformly. If filter is empty,
  // all colors are available; if filter matches nothing, result is empty. No special cases.
  // Filter color names from ANSI_COLOR_NAMES record
  const colorNames = Object.keys(ANSI_COLOR_NAMES);
  const filtered = colorNames.filter((name) =>
    name.toLowerCase().includes(filter.toLowerCase())
  );

  return {
    ...state,
    inputFilter: filter,
    filteredColorNames: filtered.slice(0, 10), // Show max 10 matches
    filteredColorIndex: 0,
  };
}

function reduceNavigateFilteredColors(state: AppState, delta: 1 | -1): AppState {
  const nextIndex = (state.filteredColorIndex + delta + state.filteredColorNames.length) % Math.max(1, state.filteredColorNames.length);
  return { ...state, filteredColorIndex: nextIndex };
}

function reduceSelectFilteredColor(state: AppState, name: string): AppState {
  const color = parseColor(name);
  if (!color) {
    return { ...state, parseError: `Invalid color: ${name}` };
  }

  const allPalettes = computeAllPalettes(color);
  return {
    ...state,
    baseColor: color,
    parseError: null,
    allPalettes,
    inputFilter: "",
    filteredColorNames: [],
    filteredColorIndex: 0,
    mode: "browsing",
  };
}

function reduceCyclePaletteMode(state: AppState, delta: 1 | -1): AppState {
  if (!state.baseColor) return state;

  const currentIndex = PALETTE_MODES.indexOf(state.selectedPaletteMode);
  const nextIndex = (currentIndex + delta + PALETTE_MODES.length) % PALETTE_MODES.length;
  const nextMode = PALETTE_MODES[nextIndex]!;

  return {
    ...state,
    selectedPaletteMode: nextMode,
    selectedColorIndexInPalette: 0,
  };
}

function reduceCycleColorSystem(state: AppState, delta: 1 | -1): AppState {
  const currentIndex = COLOR_SYSTEMS.indexOf(state.colorSystemMode);
  const nextIndex = (currentIndex + delta + COLOR_SYSTEMS.length) % COLOR_SYSTEMS.length;
  const nextMode = COLOR_SYSTEMS[nextIndex]!;

  return { ...state, colorSystemMode: nextMode };
}

function reduceCycleTheme(state: AppState, delta: 1 | -1): AppState {
  const currentIndex = THEMES.indexOf(state.selectedTheme);
  const nextIndex = (currentIndex + delta + THEMES.length) % THEMES.length;
  const nextTheme = THEMES[nextIndex]!;

  return { ...state, selectedTheme: nextTheme };
}

function reduceMoveSelection(state: AppState, delta: 1 | -1): AppState {
  const palette = state.allPalettes[state.selectedPaletteMode];
  if (!palette) return state;

  const nextIndex = (state.selectedColorIndexInPalette + delta + palette.length) % palette.length;
  return { ...state, selectedColorIndexInPalette: nextIndex };
}

function reduceMoveForward(state: AppState, delta: 1 | -1): AppState {
  const currentIndex = FOCUS_TARGETS.indexOf(state.focus);
  const nextIndex = (currentIndex + delta + FOCUS_TARGETS.length) % FOCUS_TARGETS.length;
  const nextFocus = FOCUS_TARGETS[nextIndex]!;

  return { ...state, focus: nextFocus };
}

/**
 * Parse a color string using rich-js Color.parse().
 */
function parseColor(input: string): ColorSpec | null {
  if (!input || input.trim() === "") return null;

  try {
    return Color.parse(input);
  } catch {
    return null;
  }
}

/**
 * Generate all 8 palettes for a given base color.
 */
function computeAllPalettes(baseColor: ColorSpec | null): Record<PaletteMode, ColorSpec[] | null> {
  if (!baseColor) {
    return {
      complementary: null,
      analogous: null,
      triadic: null,
      tetradic: null,
      square: null,
      monochromatic: null,
      shades: null,
      tints: null,
    };
  }

  return {
    complementary: generatePalette(baseColor, "complementary"),
    analogous: generatePalette(baseColor, "analogous"),
    triadic: generatePalette(baseColor, "triadic"),
    tetradic: generatePalette(baseColor, "tetradic"),
    square: generatePalette(baseColor, "square"),
    monochromatic: generatePalette(baseColor, "monochromatic"),
    shades: generatePalette(baseColor, "shades"),
    tints: generatePalette(baseColor, "tints"),
  };
}

/**
 * Get the currently selected palette colors after downgrading.
 */
export function getSelectedPaletteColors(state: AppState): ColorSpec[] {
  const palette = state.allPalettes[state.selectedPaletteMode];
  if (!palette) return [];

  return palette.map((color) => downgradeColor(color, state.colorSystemMode));
}

/**
 * Get all palette names.
 */
export function getPaletteNames(): PaletteMode[] {
  return PALETTE_MODES;
}

/**
 * Downgrade a color to the target color system.
 */
function downgradeColor(color: ColorSpec, _system: ColorSystemMode): ColorSpec {
  // For now, all color systems return truecolor (which the terminal will downgrade if needed).
  // TODO: Implement proper downgrading once ColorDepth enum is available in public API
  return color;
}

/**
 * Format a color for display in hex format.
 */
export function colorToHex(color: ColorSpec): string {
  const triplet = color.getTruecolor();
  return triplet.hex;
}
