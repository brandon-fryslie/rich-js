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
  Panel,
  Rule,
  Table,
  Tree,
  ProgressBar,
  Console,
  ROUNDED,
  HEAVY_HEAD,
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
  SVG_EXPORT_THEME,
  NORD,
  GRUVBOX,
  DRACULA,
  TOKYO_NIGHT,
  FLEXOKI,
  CATPPUCCIN_MOCHA,
  CATPPUCCIN_LATTE,
  CATPPUCCIN_FRAPPE,
  CATPPUCCIN_MACCHIATO,
  SOLARIZED_DARK,
  SOLARIZED_LIGHT,
  ROSE_PINE,
  ROSE_PINE_MOON,
  ROSE_PINE_DAWN,
  ATOM_ONE_DARK,
  ATOM_ONE_LIGHT,
} from "../../src/index.js";
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent } from "../../src/widgets/types.js";
import type { ColorRgba, TerminalTheme } from "../../src/core/color.js";
import type { RenderOptions } from "../../src/core/protocol.js";
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
  { name: "Nord", theme: NORD },
  { name: "Gruvbox", theme: GRUVBOX },
  { name: "Dracula", theme: DRACULA },
  { name: "Tokyo Night", theme: TOKYO_NIGHT },
  { name: "Flexoki", theme: FLEXOKI },
  { name: "Catppuccin Mocha", theme: CATPPUCCIN_MOCHA },
  { name: "Catppuccin Latte", theme: CATPPUCCIN_LATTE },
  { name: "Catppuccin Frapp\u00e9", theme: CATPPUCCIN_FRAPPE },
  { name: "Catppuccin Macchiato", theme: CATPPUCCIN_MACCHIATO },
  { name: "Solarized Dark", theme: SOLARIZED_DARK },
  { name: "Solarized Light", theme: SOLARIZED_LIGHT },
  { name: "Rose Pine", theme: ROSE_PINE },
  { name: "Rose Pine Moon", theme: ROSE_PINE_MOON },
  { name: "Rose Pine Dawn", theme: ROSE_PINE_DAWN },
  { name: "Atom One Dark", theme: ATOM_ONE_DARK },
  { name: "Atom One Light", theme: ATOM_ONE_LIGHT },
  { name: "SVG Export", theme: SVG_EXPORT_THEME },
];

// --- Observable app state ---

class AppState {
  selectedThemeIdx = 0;

  constructor() { makeAutoObservable(this); }

  get selectedTheme() { return THEMES[this.selectedThemeIdx]!.theme; }
  get selectedName() { return THEMES[this.selectedThemeIdx]!.name; }

  selectTheme(idx: number): void { this.selectedThemeIdx = idx; }
}

const state = new AppState();

// --- Layout ---

const HEADER_ROW = 1;
const SUBTITLE_ROW = 2;
const BUTTON_START_ROW = 4;
const MAX_BUTTON_COLS = 78;
const CONTENT_START = 10;
const STATUS_ROW = 45;
const LOG_ROW = 47;
const MAX_LOGS = 3;

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
    id: `theme-${t.name.toLowerCase().replace(/\s+/g, "-")}`,
  })
);

const btnExport = new Button({ label: "Export", variant: "success", id: "btn-export" });
const btnReset = new Button({ label: "Reset", variant: "danger", id: "btn-reset" });
const btnDisabled = new Button({ label: "Locked", variant: "default", disabled: true, id: "btn-locked" });

const allWidgets: InteractiveWidget[] = [...themeButtons, btnExport, btnReset, btnDisabled];

themeButtons.forEach((btn, i) => {
  btn.onSubmit(() => {
    state.selectTheme(i);
    log(`Switched to ${THEMES[i]!.name} theme`);
  });
});
btnExport.onSubmit(() => log(`Exported ${state.selectedName} theme`));
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
  let maxWidth = 0;
  for (const line of lines) {
    const w = line.reduce((sum, s) => sum + s.cellLength, 0);
    if (w > maxWidth) maxWidth = w;
  }
  widget.bounds = { x: col, y: row - 1, width: maxWidth, height: lines.length };
  for (let i = 0; i < lines.length; i++) {
    const ansi = segmentsToString(lines[i]!, ColorDepth.TRUECOLOR);
    writeAt(row + i, col, ansi);
  }
  return col + maxWidth + 2;
}

function renderHeader(): void {
  writeAt(HEADER_ROW, 2, "\x1b[1;36mrich-js Theme Explorer\x1b[0m");
  writeAt(SUBTITLE_ROW, 2, "\x1b[2mTab \u00b7 Space/Enter \u00b7 Click \u00b7 Ctrl-C to exit\x1b[0m");
}

function renderButtons(): void {
  let row = BUTTON_START_ROW;
  let col = 2;
  for (const widget of allWidgets) {
    const { minimum } = widget.measure({ maxWidth: 80 });
    if (col + minimum > MAX_BUTTON_COLS && col > 2) {
      row++;
      col = 2;
    }
    col = renderWidget(widget, row, col);
  }
}

function renderRenderable(renderable: { render(options: RenderOptions): Iterable<Segment> }, row: number, col: number): number {
  const segments = [...renderable.render({ maxWidth: 80 })];
  const lines = Segment.splitLines(segments);
  for (let i = 0; i < lines.length; i++) {
    const ansi = segmentsToString(lines[i]!, ColorDepth.TRUECOLOR);
    writeAt(row + i, col, ansi);
  }
  return lines.length;
}

function renderContent(): void {
  const theme = state.selectedTheme;
  const name = state.selectedName;
  const fg = theme.foregroundColor;
  const bg = theme.backgroundColor;
  const palette = theme.palette;
  let row = CONTENT_START;

  // --- Theme name panel ---
  const titlePanel = new Panel(` ${name} `, {
    box: ROUNDED,
    style: new Style({ color: fg, bgcolor: bg, bold: true }),
    borderStyle: new Style({ color: palette.get("primary")! }),
    width: 78,
    padding: 0,
  });
  row += renderRenderable(titlePanel, row, 2);
  row++;

  // --- Semantic palette swatches ---
  const accentKeys = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
  let swatchLine = "";
  for (const key of accentKeys) {
    const c = palette.get(key)!;
    const muted = palette.get(`${key}-muted`)!;
    const bgAnsi = `\x1b[48;2;${c.red};${c.green};${c.blue}m`;
    const mutedAnsi = `\x1b[48;2;${muted.red};${muted.green};${muted.blue}m`;
    const reset = "\x1b[0m";
    const fgContrast = luminance(c) > 0.179 ? "30" : "37";
    const fgMuted = luminance(muted) > 0.179 ? "30" : "37";
    swatchLine += `${bgAnsi}\x1b[${fgContrast};1m ${key.padEnd(9)}${reset}${mutedAnsi}\x1b[${fgMuted}m muted ${reset} `;
  }
  writeAt(row, 2, swatchLine);
  row++;
  row++;

  // --- Rich components showcase ---
  // Rule
  const rule = new Rule("rich-js components", {
    characters: "\u2500",
    style: new Style({ color: palette.get("primary")! }),
  });
  row += renderRenderable(rule, row, 2);
  row++;

  // Table
  const table = new Table({ box: HEAVY_HEAD, showEdge: true, width: 78,
    borderStyle: new Style({ color: palette.get("primary-muted")! }),
    headerStyle: new Style({ color: palette.get("primary")!, bold: true }),
    style: new Style({ color: fg, bgcolor: bg }),
  });
  table.addColumn("Component", { width: 14 });
  table.addColumn("Description", { width: 40 });
  table.addColumn("Status", { justify: "center", width: 10 });
  table.addRow("Panel", "Bordered container with title", "\u2713 ready");
  table.addRow("Table", "Tabular data with header styles", "\u2713 ready");
  table.addRow("Tree", "Hierarchical data display", "\u2713 ready");
  table.addRow("ProgressBar", "Visual progress indicator", "\u2713 ready");
  table.addRow("Button", "Interactive widget with variants", "\u2713 ready");
  // Color the status cells
  row += renderRenderable(table, row, 2);
  row++;

  // Tree
  const tree = new Tree(`\x1b[1m${name}\x1b[0m`, {
    guide_style: new Style({ color: palette.get("secondary-muted")! }).toString(),
  });
  const colors = tree.add("Semantic Colors");
  colors.add(`primary  ${palette.get("primary")!.hex}`);
  colors.add(`secondary  ${palette.get("secondary")!.hex}`);
  colors.add(`accent  ${palette.get("accent")!.hex}`);
  const semantics = tree.add("Derived");
  semantics.add(`surface  ${palette.get("surface")!.hex}`);
  semantics.add(`primary-muted  ${palette.get("primary-muted")!.hex}`);
  semantics.add(`text-primary  ${palette.get("text-primary")!.hex}`);
  row += renderRenderable(tree, row, 2);
  row++;

  // Progress bars
  const progressData = [
    { label: "primary", color: "primary", pct: 75 },
    { label: "success", color: "success", pct: 100 },
    { label: "warning", color: "warning", pct: 45 },
    { label: "error",   color: "error",   pct: 20 },
  ];
  for (const p of progressData) {
    const bar = new ProgressBar({
      total: 100,
      completed: p.pct,
      width: 30,
      completeStyle: new Style({ bgcolor: palette.get(p.color)! }),
      style: new Style({ bgcolor: palette.get(`${p.color}-muted`)! }),
    });
    const labelStyle = new Style({ color: palette.get(p.color)!, bold: true });
    const labelSeg = new Segment(` ${p.label.padEnd(10)}`, labelStyle);
    writeAt(row, 2, segmentsToString([labelSeg], ColorDepth.TRUECOLOR));
    row += renderRenderable(bar, row, 16);
  }
  row++;

  // Text styles row
  const ss = new Style({ color: fg, bgcolor: bg });
  const styleSegs = [
    new Segment(" Normal ", ss),
    new Segment(" Bold ", new Style({ ...ss, bold: true })),
    new Segment(" Dim ", new Style({ ...ss, dim: true })),
    new Segment(" Italic ", new Style({ ...ss, italic: true })),
    new Segment(" Underline ", new Style({ ...ss, underline: true })),
    new Segment(" Reverse ", new Style({ ...ss, reverse: true })),
  ];
  writeAt(row, 2, segmentsToString(styleSegs, ColorDepth.TRUECOLOR));
  row++;

  // ANSI palette
  row++;
  writeAt(row, 2, new Style({ color: palette.get("secondary")!, bold: true }).toAnsi(false) + "ANSI Palette" + "\x1b[0m");
  row++;
  const ansiTable = theme.ansiColors;
  const COLS = 8;
  for (let i = 0; i < 16; i++) {
    const c = ansiTable.get(i);
    const r = row + Math.floor(i / COLS);
    const col = 2 + (i % COLS) * 10;
    writeAt(r, col, `${colorSwatch(c)} ${String(i).padStart(2, " ")}`);
  }
}

function luminance(c: ColorRgba): number {
  const ch = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.red) + 0.7152 * ch(c.green) + 0.0722 * ch(c.blue);
}

function renderStatus(): void {
  const focused = fm.current;
  const id = focused?.id ?? "none";
  const details = focused ? `focused=${focused.focused} active=${focused.active}` : "";
  writeAt(STATUS_ROW, 2, `\x1b[1;33m\u25b8\x1b[0m ${id}  \x1b[2m${details}\x1b[0m`);
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
  renderContent();
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
    for (const widget of allWidgets) {
      widget.hovered = widget === hit;
    }
  });

  if (hit) {
    hit.handleMouse(mouse);
    if (mouse.type === "mouse_up") {
      fm.focus(hit);
    }
  }

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
