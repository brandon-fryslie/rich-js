/**
 * rich-config — interactive theme explorer for rich-js.
 *
 * Live demo of the interactive widget stack:
 *   - Button rendering with all variants
 *   - Focus cycling (tab / shift+tab)
 *   - Click triggering
 *   - Keyboard handling (space / enter)
 *   - Mouse hover highlighting
 *   - MobX observable reactivity
 *   - Live theme preview: switches between rich-js TerminalThemes
 *     and shows their ANSI color tables, foreground/background, etc.
 *   - Slot-in architecture for future widgets
 *
 * Run with: npm run config
 * Press Ctrl-C or q to exit.
 */

import { autorun } from "mobx";
import {
  Button,
  DefaultFocusManager,
  segmentsToString,
  Segment,
  Style,
  ColorSpec,
  ColorDepth,
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
} from "../../src/index.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";
import type { ColorRgba } from "../../src/core/color.js";
import {
  enterRawMode,
  leaveRawMode,
  enableMouse,
  disableMouse,
  clearScreen,
  hideCursor,
  showCursor,
  moveCursor,
  eraseBelow,
  startReading,
  writeAt,
} from "./terminal.js";

// --- Available themes ---

const THEMES = [
  { name: "Default", theme: DEFAULT_TERMINAL_THEME },
  { name: "Monokai", theme: MONOKAI },
  { name: "SVG Export", theme: SVG_EXPORT_THEME },
] as const;

// --- Observable app state (minimal MobX store) ---

import { makeAutoObservable } from "mobx";

class AppState {
  selectedThemeIdx = 0;
  hoverIdx = -1; // -1 = no hover

  constructor() { makeAutoObservable(this); }

  get selectedTheme() { return THEMES[this.selectedThemeIdx]!.theme; }
  get selectedName() { return THEMES[this.selectedThemeIdx]!.name; }

  selectTheme(idx: number): void {
    this.selectedThemeIdx = idx;
  }
}

const state = new AppState();

// --- Layout constants ---

const HEADER_ROW = 1;
const SUBTITLE_ROW = 2;
const BUTTON_ROW = 4;
const THEME_NAME_ROW = 6;
const BG_FG_ROW = 7;
const COLOR_GRID_ROW = 9;
const STATUS_ROW = 20;
const LOG_ROW = 22;
const MAX_LOGS = 4;

// --- Log buffer ---

const logs: string[] = [];
function log(msg: string): void {
  logs.push(msg);
  if (logs.length > MAX_LOGS) logs.shift();
}

// --- Buttons ---

const themeButtons = THEMES.map((t, i) =>
  new Button({
    label: t.name,
    variant: i === 0 ? "primary" : "default",
    id: `theme-${t.name.toLowerCase()}`,
  })
);

const btnExport = new Button({ label: "Export", variant: "success", id: "btn-export" });
const btnReset = new Button({ label: "Reset", variant: "danger", id: "btn-reset" });
const btnDisabled = new Button({ label: "Locked", variant: "default", disabled: true, id: "btn-locked" });

const allWidgets: InteractiveWidget[] = [...themeButtons, btnExport, btnReset, btnDisabled];

// Wire submissions
themeButtons.forEach((btn, i) => {
  btn.onSubmit(() => {
    state.selectTheme(i);
    log(`Switched to ${THEMES[i]!.name} theme`);
  });
});
btnExport.onSubmit(() => log(`Exported ${state.selectedName} theme to stdout`));
btnReset.onSubmit(() => {
  state.selectTheme(0);
  log("Reset to Default theme");
});

// --- Focus manager ---

const fm = new DefaultFocusManager();

// --- Rendering helpers ---

function hex(c: ColorRgba): string {
  return c.hex;
}

function colorSwatch(c: ColorRgba): string {
  const bg = `\x1b[48;2;${c.red};${c.green};${c.blue}m`;
  const fg = `\x1b[38;2;${c.red};${c.green};${c.blue}m`;
  return `${bg}  ${fg}\u2588\u2588\x1b[0m`;
}

function renderWidget(widget: InteractiveWidget, row: number, col: number): number {
  const isHovered = state.hoverIdx >= 0 && allWidgets[state.hoverIdx] === widget;

  const segments = [...widget.render({ maxWidth: 80 })];
  const ansi = segmentsToString(segments, ColorDepth.TRUECOLOR);

  let output = ansi;
  if (isHovered && !widget.focused && !widget.disabled) {
    output = `\x1b[7m${ansi}\x1b[0m`;
  }

  const width = segments.reduce((sum, s) => sum + s.cellLength, 0);
  widget.bounds = { x: col, y: row - 1, width, height: 1 }; // terminal rows are 1-based
  writeAt(row, col, output);

  return col + width + 2;
}

function renderHeader(): void {
  writeAt(HEADER_ROW, 2, "\x1b[1;36mrich-js Theme Explorer\x1b[0m");
  writeAt(SUBTITLE_ROW, 2, "\x1b[2mTab to navigate \u00b7 Space/Enter to activate \u00b7 Click to select \u00b7 Ctrl-C to exit\x1b[0m");
}

function renderButtons(): void {
  let col = 2;
  for (const widget of allWidgets) {
    col = renderWidget(widget, BUTTON_ROW, col);
  }
}

function renderThemePreview(): void {
  const theme = state.selectedTheme;
  const name = state.selectedName;

  writeAt(THEME_NAME_ROW, 2, `\x1b[1mTheme:\x1b[0m ${name}`);

  // Background / foreground swatches
  const bg = theme.backgroundColor;
  const fg = theme.foregroundColor;
  const bgSwatch = colorSwatch(bg);
  const fgSwatch = colorSwatch(fg);
  writeAt(BG_FG_ROW, 2, `Background ${bgSwatch} ${hex(bg)}   Foreground ${fgSwatch} ${hex(fg)}`);

  // ANSI color grid (16 standard colors)
  const table = theme.ansiColors;
  const COLS = 8;
  for (let i = 0; i < 16; i++) {
    const c = table.get(i);
    const row = COLOR_GRID_ROW + Math.floor(i / COLS);
    const col = 2 + (i % COLS) * 10;
    const swatch = colorSwatch(c);
    const label = String(i).padStart(2, " ");
    writeAt(row, col, `${swatch} ${label}`);
  }

  // Sample text with the theme colors
  const sampleRow = COLOR_GRID_ROW + 3;
  const sampleStyle = new Style({ color: ColorSpec.parse(hex(fg)), bgcolor: ColorSpec.parse(hex(bg)) });
  const sampleSegs = [
    new Segment(" Normal ", sampleStyle),
    new Segment(" Bold ", new Style({ ...sampleStyle, bold: true })),
    new Segment(" Dim ", new Style({ ...sampleStyle, dim: true })),
    new Segment(" Italic ", new Style({ ...sampleStyle, italic: true })),
    new Segment(" Underline ", new Style({ ...sampleStyle, underline: true })),
    new Segment(" Reverse ", new Style({ ...sampleStyle, reverse: true })),
  ];
  const sampleAnsi = segmentsToString(sampleSegs, ColorDepth.TRUECOLOR);
  writeAt(sampleRow, 2, sampleAnsi);
}

function renderStatus(): void {
  const focused = fm.current;
  const id = focused?.id ?? "none";
  const details = focused
    ? `focused=${focused.focused} disabled=${focused.disabled}`
    : "";
  writeAt(STATUS_ROW, 2, `\x1b[1;33m\u25b8 Focus:\x1b[0m ${id}  \x1b[2m${details}\x1b[0m`);

  // Show variant if button
  if (focused instanceof Button) {
    writeAt(STATUS_ROW, 55, `\x1b[2mvariant=${focused.variant}\x1b[0m`);
  }
}

function renderLogs(): void {
  writeAt(LOG_ROW - 1, 2, "\x1b[2m" + "\u2500".repeat(76) + "\x1b[0m");
  for (let i = 0; i < MAX_LOGS; i++) {
    const row = LOG_ROW + i;
    moveCursor(row, 2);
    process.stdout.write("\x1b[2K");
    if (i < logs.length) {
      const entry = logs[logs.length - MAX_LOGS + i];
      if (entry) writeAt(row, 2, `\x1b[2m  ${entry}\x1b[0m`);
    }
  }
}

function render(): void {
  eraseBelow(HEADER_ROW);
  renderHeader();
  renderButtons();
  renderThemePreview();
  renderStatus();
  renderLogs();
}

// --- Input handling ---

function handleInput(key: KeyEvent | null, mouse: WidgetMouseEvent | null): void {
  if (key?.ctrl && key.key === "c") { shutdown(); return; }
  if (key?.key === "q" && !key.ctrl) { shutdown(); return; }

  if (key?.key === "tab") {
    key.shift ? fm.prev() : fm.next();
    return;
  }

  if (key && fm.current) {
    fm.current.handleKey(key);
  }

  if (mouse) {
    handleMouse(mouse);
  }
}

function handleMouse(mouse: WidgetMouseEvent): void {
  // Update hover state
  state.hoverIdx = -1;
  for (let i = 0; i < allWidgets.length; i++) {
    if (allWidgets[i]!.containsPoint(mouse.x, mouse.y)) {
      state.hoverIdx = i;
      break;
    }
  }

  if (mouse.type === "mouse_up") {
    for (const widget of allWidgets) {
      if (widget.containsPoint(mouse.x, mouse.y)) {
        fm.focus(widget);
        widget.handleClick(mouse);
        break;
      }
    }
  }
}

// --- Lifecycle ---

let stopReading: (() => void) | null = null;
let disposeRender: (() => void) | null = null;

function startup(): void {
  if (!process.stdin.isTTY) {
    process.stderr.write("Error: demo-inputs requires an interactive terminal.\n");
    process.exit(1);
  }

  enterRawMode();
  hideCursor();
  enableMouse();
  clearScreen();

  for (const widget of allWidgets) fm.register(widget);

  // Re-render on any observable change
  disposeRender = autorun(() => {
    // Touch observables to subscribe
    void state.selectedThemeIdx;
    void state.hoverIdx;
    void fm.current?.focused;
    void fm.current?.disabled;
    void logs.length;
    render();
  });

  stopReading = startReading((key, mouse) => handleInput(key, mouse));
}

function shutdown(): void {
  if (stopReading) stopReading();
  if (disposeRender) disposeRender();
  disableMouse();
  showCursor();
  clearScreen();
  process.stdout.write("\x1b[1;36mGoodbye!\x1b[0m\r\n");
  leaveRawMode();
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

startup();
