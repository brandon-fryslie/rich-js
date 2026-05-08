/**
 * rich-config — interactive theme explorer for rich-js.
 *
 * Run with: npm run demo-inputs
 * Press Ctrl-C or q to exit.
 */

import { autorun, runInAction, makeAutoObservable } from "mobx";
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

// --- Observable app state ---

class AppState {
  selectedThemeIdx = 0;

  constructor() { makeAutoObservable(this); }

  get selectedTheme() { return THEMES[this.selectedThemeIdx]!.theme; }
  get selectedName() { return THEMES[this.selectedThemeIdx]!.name; }

  selectTheme(idx: number): void { this.selectedThemeIdx = idx; }
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

function colorSwatch(c: ColorRgba): string {
  const bg = `\x1b[48;2;${c.red};${c.green};${c.blue}m`;
  const fg = `\x1b[38;2;${c.red};${c.green};${c.blue}m`;
  return `${bg}  ${fg}\u2588\u2588\x1b[0m`;
}

function renderWidget(widget: InteractiveWidget, row: number, col: number): number {
  const segments = [...widget.render({ maxWidth: 80 })];
  const lines = Segment.splitLines(segments);
  // Width is the max cell length across all lines
  let maxWidth = 0;
  for (const line of lines) {
    const w = line.reduce((sum, s) => sum + s.cellLength, 0);
    if (w > maxWidth) maxWidth = w;
  }
  // writeAt uses 1-based columns (CUP semantics) but mouse-event x is 0-based —
  // store bounds in 0-based coordinates so hit-testing aligns with WidgetMouseEvent.x.
  widget.bounds = { x: col - 1, y: row - 1, width: maxWidth, height: lines.length };
  for (let i = 0; i < lines.length; i++) {
    const ansi = segmentsToString(lines[i]!, ColorDepth.TRUECOLOR);
    writeAt(row + i, col, ansi);
  }
  return col + maxWidth + 2;
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
  const fg = theme.foregroundColor;
  const bg = theme.backgroundColor;

  writeAt(THEME_NAME_ROW, 2, `\x1b[1mTheme:\x1b[0m ${name}`);
  writeAt(BG_FG_ROW, 2, `Background ${colorSwatch(bg)} ${bg.hex}   Foreground ${colorSwatch(fg)} ${fg.hex}`);

  const table = theme.ansiColors;
  const COLS = 8;
  for (let i = 0; i < 16; i++) {
    const c = table.get(i);
    const row = COLOR_GRID_ROW + Math.floor(i / COLS);
    const col = 2 + (i % COLS) * 10;
    writeAt(row, col, `${colorSwatch(c)} ${String(i).padStart(2, " ")}`);
  }

  const sampleRow = COLOR_GRID_ROW + 3;
  const ss = new Style({ color: ColorSpec.parse(fg.hex), bgcolor: ColorSpec.parse(bg.hex) });
  const sampleSegs = [
    new Segment(" Normal ", ss),
    new Segment(" Bold ", new Style({ ...ss, bold: true })),
    new Segment(" Dim ", new Style({ ...ss, dim: true })),
    new Segment(" Italic ", new Style({ ...ss, italic: true })),
    new Segment(" Underline ", new Style({ ...ss, underline: true })),
    new Segment(" Reverse ", new Style({ ...ss, reverse: true })),
  ];
  writeAt(sampleRow, 2, segmentsToString(sampleSegs, ColorDepth.TRUECOLOR));
}

function renderStatus(): void {
  const focused = fm.current;
  const id = focused?.id ?? "none";
  const details = focused ? `focused=${focused.focused} active=${focused.active} disabled=${focused.disabled}` : "";
  writeAt(STATUS_ROW, 2, `\x1b[1;33m\u25b8 Focus:\x1b[0m ${id}  \x1b[2m${details}\x1b[0m`);
  if (focused instanceof Button) {
    writeAt(STATUS_ROW, 65, `\x1b[2mvariant=${focused.variant}\x1b[0m`);
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

  // Forward key to focused widget
  if (key && fm.current) {
    fm.current.handleKey(key);
    // Keyboard activation is momentary — clear after a frame so the visual flash is visible
    if (key.key === "enter" || key.key === "space") {
      const widget = fm.current;
      setTimeout(() => runInAction(() => { widget.active = false; }), 80);
    }
    return;
  }

  if (mouse) {
    handleMouse(mouse);
  }
}

function handleMouse(mouse: WidgetMouseEvent): void {
  const hit = widgetAt(mouse.x, mouse.y);

  runInAction(() => {
    // Update hover state for all widgets
    for (const widget of allWidgets) {
      widget.hovered = widget === hit;
    }
  });

  // Forward ALL mouse events to the hit widget
  if (hit) {
    hit.handleMouse(mouse);

    // Focus on click
    if (mouse.type === "mouse_up") {
      fm.focus(hit);
    }
  }

  // Clear active on mouse_up regardless of hit location
  if (mouse.type === "mouse_up") {
    runInAction(() => {
      for (const widget of allWidgets) {
        widget.active = false;
      }
    });
  }
}

function widgetAt(x: number, y: number): InteractiveWidget | null {
  for (const widget of allWidgets) {
    if (widget.containsPoint(x, y)) return widget;
  }
  return null;
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

  disposeRender = autorun(() => {
    // Propagate theme to all buttons
    const theme = state.selectedTheme;
    for (const widget of allWidgets) {
      if (widget instanceof Button) widget.setTheme(theme);
    }
    void state.selectedThemeIdx;
    void fm.current?.focused;
    void fm.current?.active;
    void fm.current?.hovered;
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
