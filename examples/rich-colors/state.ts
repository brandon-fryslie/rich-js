import { Color, TerminalTheme, DEFAULT_TERMINAL_THEME, MONOKAI, SVG_EXPORT_THEME } from "../../src/index.js";
import { generatePalette } from "./color-math.js";

/**
 * Application state for rich-colors demo.
 *
 * [LAW:one-source-of-truth] All UI state lives in AppState. Derived data
 * (generated palettes) is computed on-demand in reducers.
 *
 * [LAW:dataflow-not-control-flow] Every frame executes the same render and
 * reduce operations. Variability lives in the data (null vs Color, different
 * palette modes), never in skipped operations.
 */

export type PaletteMode = "complementary" | "analogous" | "triadic" | "tetradic" | "square" | "monochromatic" | "shades" | "tints";
export type ColorSystemMode = "truecolor" | "256" | "16" | "windows";
export type AppMode = "browsing" | "inputting";
export type Focus = "input" | "palette_mode" | "color_system" | "theme" | "palette_display";

export interface AppState {
  // Input & parsing
  readonly inputColor: string;
  readonly baseColor: Color | null;
  readonly parseError: string | null;

  // Palette generation
  readonly paletteMode: PaletteMode;
  readonly generatedPalette: Color[] | null;

  // Display options
  readonly colorSystemMode: ColorSystemMode;
  readonly selectedTheme: TerminalTheme;
  readonly compareMode: boolean;
  readonly showDetails: boolean;

  // Navigation
  readonly focus: Focus;
  readonly selectedPaletteIndex: number;

  // UI state
  readonly mode: AppMode;
  readonly statusMessage: string | null;
}

export type Action =
  | { type: "set-input"; value: string }
  | { type: "submit-input" }
  | { type: "cycle-palette-mode"; delta: 1 | -1 }
  | { type: "cycle-color-system"; delta: 1 | -1 }
  | { type: "cycle-theme"; delta: 1 | -1 }
  | { type: "toggle-compare" }
  | { type: "toggle-details" }
  | { type: "move-palette-selection"; delta: 1 | -1 }
  | { type: "focus"; target: Focus }
  | { type: "start-input-mode" }
  | { type: "exit-input-mode" }
  | { type: "clear-status" }
  | { type: "quit" }
  | { type: "none" };

const PALETTE_MODES: PaletteMode[] = ["complementary", "analogous", "triadic", "tetradic", "square", "monochromatic", "shades", "tints"];
const COLOR_SYSTEMS: ColorSystemMode[] = ["truecolor", "256", "16", "windows"];
const THEMES: TerminalTheme[] = [DEFAULT_TERMINAL_THEME, MONOKAI, SVG_EXPORT_THEME];

/**
 * Create initial application state.
 */
export function initialState(startColor: string = "#2b923e"): AppState {
  const baseColor = parseColor(startColor);
  const generatedPalette = baseColor ? generatePalette(baseColor, "complementary") : null;

  return {
    inputColor: startColor,
    baseColor,
    parseError: baseColor ? null : `Invalid color: ${startColor}`,
    paletteMode: "complementary",
    generatedPalette,
    colorSystemMode: "truecolor",
    selectedTheme: DEFAULT_TERMINAL_THEME,
    compareMode: false,
    showDetails: false,
    focus: "palette_display",
    selectedPaletteIndex: 0,
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
  if (action.type === "set-input") {
    return reduceSetInput(state, action.value);
  } else if (action.type === "submit-input") {
    return reduceSubmitInput(state);
  } else if (action.type === "cycle-palette-mode") {
    return reduceCyclePaletteMode(state, action.delta);
  } else if (action.type === "cycle-color-system") {
    return reduceCycleColorSystem(state, action.delta);
  } else if (action.type === "cycle-theme") {
    return reduceCycleTheme(state, action.delta);
  } else if (action.type === "toggle-compare") {
    return { ...state, compareMode: !state.compareMode };
  } else if (action.type === "toggle-details") {
    return { ...state, showDetails: !state.showDetails };
  } else if (action.type === "move-palette-selection") {
    return reduceMoveSelection(state, action.delta);
  } else if (action.type === "focus") {
    return { ...state, focus: action.target };
  } else if (action.type === "start-input-mode") {
    return { ...state, mode: "inputting", inputColor: "", parseError: null };
  } else if (action.type === "exit-input-mode") {
    return { ...state, mode: "browsing" };
  } else if (action.type === "clear-status") {
    return { ...state, statusMessage: null };
  } else {
    return state;
  }
}

function reduceSetInput(state: AppState, value: string): AppState {
  const baseColor = parseColor(value);
  const parseError = baseColor ? null : `Invalid color: ${value}`;
  const generatedPalette = baseColor ? generatePalette(baseColor, state.paletteMode) : null;

  return {
    ...state,
    inputColor: value,
    baseColor,
    parseError,
    generatedPalette,
    selectedPaletteIndex: 0,
  };
}

function reduceSubmitInput(state: AppState): AppState {
  if (!state.baseColor) {
    return { ...state, statusMessage: "Invalid color. Try #FF0000 or rgb(255,0,0)", mode: "browsing" };
  }

  return { ...state, mode: "browsing" };
}

function reduceCyclePaletteMode(state: AppState, delta: 1 | -1): AppState {
  if (!state.baseColor) return state;

  const currentIndex = PALETTE_MODES.indexOf(state.paletteMode);
  const nextIndex = (currentIndex + delta + PALETTE_MODES.length) % PALETTE_MODES.length;
  const nextMode = PALETTE_MODES[nextIndex]!;

  const generatedPalette = generatePalette(state.baseColor, nextMode);

  return {
    ...state,
    paletteMode: nextMode,
    generatedPalette,
    selectedPaletteIndex: 0,
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
  if (!state.generatedPalette) return state;

  const nextIndex = (state.selectedPaletteIndex + delta + state.generatedPalette.length) % state.generatedPalette.length;
  return { ...state, selectedPaletteIndex: nextIndex };
}

/**
 * Parse a color string using rich-js Color.parse().
 * Handles hex, rgb, named colors, indexed colors, and default.
 */
function parseColor(input: string): Color | null {
  if (!input || input.trim() === "") return null;

  try {
    return Color.parse(input);
  } catch {
    return null;
  }
}

/**
 * Get colors after applying color system downgrading.
 */
export function visiblePaletteColors(state: AppState): Color[] {
  if (!state.generatedPalette) return [];

  return state.generatedPalette.map((color) => downgradeColor(color, state.colorSystemMode));
}

/**
 * Downgrade a color to the target color system.
 *
 * [LAW:dataflow-not-control-flow] This function always processes the color
 * the same way; system determines what result is produced, not whether processing occurs.
 */
function downgradeColor(color: Color, _system: ColorSystemMode): Color {
  // For now, all color systems return truecolor (which the terminal will downgrade if needed).
  // TODO: Implement proper downgrading once ColorSystem enum is available in public API
  return color;
}

/**
 * Format a color for display in hex format.
 */
export function colorToHex(color: Color): string {
  const triplet = color.getTruecolor();
  return triplet.hex;
}

/**
 * Format a color for display in rgb format.
 */
export function colorToRgb(color: Color): string {
  const triplet = color.getTruecolor();
  return `rgb(${triplet.red}, ${triplet.green}, ${triplet.blue})`;
}
