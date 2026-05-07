/**
 * rich-config — interactive theme + widgets explorer for rich-js.
 *
 * Mounts every interactive widget (Button, Checkbox, Toggle, TextInput,
 * Dropdown, Slider) and re-themes them all when the user selects a new
 * theme. The bottom log line shows widget interactions live so the user
 * can verify state changes as they tab around.
 *
 * Run with: npm run demo-inputs
 * Press Tab to navigate · Space/Enter to interact · Ctrl-C to exit.
 */

import { autorun, runInAction, makeAutoObservable } from "mobx";
import {
  Button,
  Checkbox,
  Toggle,
  TextInput,
  Dropdown,
  Slider,
  DefaultFocusManager,
  segmentsToString,
  Segment,
  Style,
  ColorSpec,
  ColorDepth,
  Panel,
  ProgressBar,
  ROUNDED,
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
import type { ColorRgba } from "../../src/core/color.js";
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
  { name: "Catppuccin Frappé", theme: CATPPUCCIN_FRAPPE },
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
const WIDGETS_START_ROW = 4;
const MAX_BUTTON_COLS = 78;
// Layout below is dynamic — renderInteractiveWidgets returns the next
// free row; renderContent uses what's left between widgets and STATUS_ROW.
const STATUS_ROW = 42;
const LOG_ROW = 44;
const MAX_LOGS = 3;

// --- Log buffer ---

const logs: string[] = [];
function log(msg: string): void {
  logs.push(msg);
  if (logs.length > MAX_LOGS) logs.shift();
}

// --- Action buttons (Button showcases) ---

const btnExport = new Button({ label: "Export", variant: "success", id: "btn-export" });
const btnReset = new Button({ label: "Reset", variant: "danger", id: "btn-reset" });
const btnDisabled = new Button({ label: "Locked", variant: "default", disabled: true, id: "btn-locked" });

// --- Interactive widgets ---

// [LAW:one-source-of-truth] state.selectedThemeIdx is the canonical
// "selected theme" — it indexes the global THEMES array and survives
// filter changes. themeDropdown.options is filter-derived; the dropdown's
// selectedIndex is a positional projection of state.selectedThemeIdx into
// that filtered list, maintained by the filter autorun in startup().
const themeDropdown = new Dropdown({
  options: THEMES.map((t) => t.name),
  selectedIndex: 0,
  id: "dd-theme",
});
const cbMuted = new Checkbox({ label: "Muted", checked: true, id: "cb-muted" });
const cbAnsi = new Checkbox({ label: "ANSI", checked: true, id: "cb-ansi" });
const cbProgress = new Checkbox({ label: "Progress", checked: true, id: "cb-progress" });
const tgDarkOnly = new Toggle({ label: "Dark only", variant: "success", id: "tg-dark-only" });
const slVolume = new Slider({ value: 40, min: 0, max: 100, step: 5, width: 22, id: "sl-volume" });
const inName = new TextInput({ placeholder: "Filter themes", id: "in-filter" });

themeDropdown.onSubmit(() => {
  // Resolve the picked option back to its canonical THEMES index by name —
  // dropdown.options is filter-volatile, so positional indexing is unsafe.
  const name = themeDropdown.options[themeDropdown.selectedIndex];
  if (name === undefined) return;
  const globalIdx = THEMES.findIndex((t) => t.name === name);
  if (globalIdx === -1) return;
  state.selectTheme(globalIdx);
  log(`Switched to ${name} theme`);
});
cbMuted.onChange(() => log(`Muted swatches → ${cbMuted.checked ? "shown" : "hidden"}`));
cbAnsi.onChange(() => log(`ANSI palette → ${cbAnsi.checked ? "shown" : "hidden"}`));
cbProgress.onChange(() => log(`Progress bars → ${cbProgress.checked ? "shown" : "hidden"}`));
tgDarkOnly.onChange(() => log(`Dark only → ${tgDarkOnly.on ? "ON" : "OFF"}`));
slVolume.onChange(() => log(`Volume → ${slVolume.value}`));
inName.onSubmit(() => log(`Filter: ${JSON.stringify(inName.value)} (${themeDropdown.options.length} match)`));

btnExport.onSubmit(() => log(`Exported ${state.selectedName} theme`));
btnReset.onSubmit(() => {
  // Reset state to Default and clear the filter; the filter autorun
  // re-syncs themeDropdown.options/selectedIndex from these canonical inputs.
  runInAction(() => {
    inName.value = "";
    inName.cursorPosition = 0;
    state.selectTheme(0);
  });
  log("Reset to Default theme");
});

// Tab order: dropdown → text input → toggles → slider → action buttons.
const allWidgets: InteractiveWidget[] = [
  themeDropdown,
  inName,
  cbMuted,
  cbAnsi,
  cbProgress,
  tgDarkOnly,
  slVolume,
  btnExport,
  btnReset,
  btnDisabled,
];

// --- Focus manager ---

const fm = new DefaultFocusManager();

// --- Rendering helpers ---

function paletteColor(c: ColorRgba): ColorSpec {
  return ColorSpec.fromRgba(c);
}

function colorSwatch(c: ColorRgba): string {
  const bg = `\x1b[48;2;${c.red};${c.green};${c.blue}m`;
  const fg = `\x1b[38;2;${c.red};${c.green};${c.blue}m`;
  return `${bg}  ${fg}██\x1b[0m`;
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
  writeAt(HEADER_ROW, 2, "\x1b[1;36mrich-js Theme + Widgets Explorer\x1b[0m");
  writeAt(SUBTITLE_ROW, 2, "\x1b[2mTab · Space/Enter · Click · Ctrl-C to exit\x1b[0m");
}

function renderInlineRow(widgets: InteractiveWidget[], startRow: number): number {
  let row = startRow;
  let col = 2;
  for (const widget of widgets) {
    const { minimum } = widget.measure({ maxWidth: 80 });
    if (col + minimum > MAX_BUTTON_COLS && col > 2) {
      row++;
      col = 2;
    }
    col = renderWidget(widget, row, col);
  }
  return row + 1;
}

function renderInteractiveWidgets(startRow: number): number {
  writeAt(startRow, 2, "\x1b[1;33mInteractive Widgets\x1b[0m");
  let row = startRow + 1;

  // Top row: theme dropdown + filter text input side by side. The
  // dropdown's expansion grows downward in its own column, so it doesn't
  // collide with the text input on the right.
  // Reserve full expansion (1 header + N options + spacer) so content
  // below stays at a stable row regardless of the expanded flag —
  // [LAW:dataflow-not-control-flow], layout shape is independent of
  // widget state.
  const ddNextCol = renderWidget(themeDropdown, row, 2);
  renderWidget(inName, row, ddNextCol);
  row += 1 + themeDropdown.options.length + 1;

  // Inline boolean + slider row: Checkbox, Toggle, Slider.
  row = renderInlineRow([cbMuted, cbAnsi, cbProgress, tgDarkOnly, slVolume], row);

  // Action buttons row: Export, Reset, Locked.
  row = renderInlineRow([btnExport, btnReset, btnDisabled], row);

  return row;
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

function renderContent(startRow: number): void {
  const theme = state.selectedTheme;
  const name = state.selectedName;
  const fg = paletteColor(theme.foregroundColor);
  const bg = paletteColor(theme.backgroundColor);
  const palette = theme.palette;
  let row = startRow;

  // --- Theme name panel ---
  const titlePanel = new Panel(` ${name} `, {
    box: ROUNDED,
    style: new Style({ color: fg, bgcolor: bg, bold: true }),
    borderStyle: new Style({ color: paletteColor(palette.get("primary")!) }),
    width: 78,
    padding: 0,
  });
  row += renderRenderable(titlePanel, row, 2);
  row++;

  // --- Semantic palette swatches ---
  // Reading .checked here subscribes the autorun: toggling cbMuted
  // re-fires the render and the muted half disappears/reappears.
  const showMuted = cbMuted.checked;
  const accentKeys = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
  let swatchLine = "";
  for (const key of accentKeys) {
    const c = palette.get(key)!;
    const bgAnsi = `\x1b[48;2;${c.red};${c.green};${c.blue}m`;
    const reset = "\x1b[0m";
    const fgContrast = luminance(c) > 0.179 ? "30" : "37";
    swatchLine += `${bgAnsi}\x1b[${fgContrast};1m ${key.padEnd(9)}${reset}`;
    if (showMuted) {
      const muted = palette.get(`${key}-muted`)!;
      const mutedAnsi = `\x1b[48;2;${muted.red};${muted.green};${muted.blue}m`;
      const fgMuted = luminance(muted) > 0.179 ? "30" : "37";
      swatchLine += `${mutedAnsi}\x1b[${fgMuted}m muted ${reset}`;
    }
    swatchLine += " ";
  }
  writeAt(row, 2, swatchLine);
  row++;
  row++;

  // [LAW:dataflow-not-control-flow] section visibility lives in the
  // section list (data), not as if-guards around side effects. The for
  // loop runs unconditionally; sections excluded by checkbox.checked
  // simply don't appear in the list. Each section is a (row) => row fn.
  type Section = (row: number) => number;
  const sections: Section[] = [
    cbProgress.checked ? (r: number) => renderProgressSection(r, palette) : null,
    cbAnsi.checked ? (r: number) => renderAnsiSection(r, theme, palette) : null,
  ].filter((s): s is Section => s !== null);

  for (const section of sections) row = section(row);
}

function renderProgressSection(startRow: number, palette: import("../../src/themes/palette.js").Palette): number {
  let row = startRow;
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
      completeStyle: new Style({ bgcolor: paletteColor(palette.get(p.color)!) }),
      style: new Style({ bgcolor: paletteColor(palette.get(`${p.color}-muted`)!) }),
    });
    const labelStyle = new Style({ color: paletteColor(palette.get(p.color)!), bold: true });
    const labelSeg = new Segment(` ${p.label.padEnd(10)}`, labelStyle);
    writeAt(row, 2, segmentsToString([labelSeg], ColorDepth.TRUECOLOR));
    row += renderRenderable(bar, row, 16);
  }
  return row + 1;
}

function renderAnsiSection(startRow: number, theme: import("../../src/core/color.js").TerminalTheme, palette: import("../../src/themes/palette.js").Palette): number {
  let row = startRow;
  const headingStyle = new Style({ color: paletteColor(palette.get("secondary")!), bold: true });
  writeAt(row, 2, segmentsToString([new Segment("ANSI Palette", headingStyle)], ColorDepth.TRUECOLOR));
  row++;
  const ansiTable = theme.ansiColors;
  for (let i = 0; i < 16; i++) {
    const c = ansiTable.get(i);
    const col = 2 + i * 5;
    writeAt(row, col, `${colorSwatch(c)}${String(i).padStart(2, " ")}`);
  }
  return row + 1;
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
  writeAt(STATUS_ROW, 2, `\x1b[1;33m▸\x1b[0m ${id}  \x1b[2m${details}\x1b[0m`);
}

function renderLogs(): void {
  writeAt(LOG_ROW - 1, 2, "\x1b[2m" + "─".repeat(76) + "\x1b[0m");
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
  const afterWidgets = renderInteractiveWidgets(WIDGETS_START_ROW);
  renderContent(afterWidgets + 1);
  renderStatus();
  renderLogs();
}

// --- Input handling ---

function handleInput(key: KeyEvent | null, mouse: WidgetMouseEvent | null): void {
  if (key?.ctrl && key.key === "c") { shutdown(); return; }

  if (key?.key === "tab") {
    key.shift ? fm.prev() : fm.next();
    return;
  }

  if (key && fm.current) {
    fm.current.handleKey(key);
    // Buttons momentarily set active=true on submit; reset after a short
    // delay so the visual press registers without sticking. Other widgets
    // don't use the active observable from key input.
    if (fm.current instanceof Button && (key.key === "enter" || key.key === "space")) {
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
  // Reverse iteration so widgets drawn later (e.g. expanded Dropdown
  // option rows) hit-test before earlier ones.
  for (let i = allWidgets.length - 1; i >= 0; i--) {
    const widget = allWidgets[i]!;
    if (widget.containsPoint(x, y)) return widget;
  }
  return null;
}

// --- Lifecycle ---

let stopReading: (() => void) | null = null;
let disposeRender: (() => void) | null = null;
let disposeFilter: (() => void) | null = null;

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

  // [LAW:single-enforcer] Filter pipeline: inName.value (substring) +
  // tgDarkOnly.on (dark-only) + state.selectedThemeIdx (canonical
  // selection) → themeDropdown.options (filtered names) +
  // themeDropdown.selectedIndex (filtered position of the canonical
  // theme, or -1 if filtered out). This is the single place that
  // mutates dropdown.options — both filter predicates compose here.
  disposeFilter = autorun(() => {
    const filterText = inName.value.toLowerCase();
    const darkOnly = tgDarkOnly.on;
    const canonicalTheme = THEMES[state.selectedThemeIdx]!;
    const filtered = THEMES
      .filter((t) => !darkOnly || t.theme.palette.dark)
      .filter((t) => filterText === "" || t.name.toLowerCase().includes(filterText));
    runInAction(() => {
      themeDropdown.options = filtered.map((t) => t.name);
      // -1 when the canonical theme is filtered out → header renders blank,
      // state stays unchanged ("leave the selection where it is").
      themeDropdown.selectedIndex = filtered.indexOf(canonicalTheme);
    });
  });

  disposeRender = autorun(() => {
    const theme = state.selectedTheme;
    // [LAW:single-enforcer] One pass applies the active theme to every
    // themable widget. Each widget owns its own setTheme; we just iterate.
    for (const widget of allWidgets) {
      const setTheme = (widget as { setTheme?: (t: typeof theme) => void }).setTheme;
      if (typeof setTheme === "function") setTheme.call(widget, theme);
    }
    void state.selectedThemeIdx;
    void fm.current?.focused;
    void fm.current?.active;
    void fm.current?.hovered;
    // Touch the new widgets' observables so the autorun re-fires on their changes.
    void cbMuted.checked;
    void cbAnsi.checked;
    void cbProgress.checked;
    void tgDarkOnly.on;
    void slVolume.value;
    void inName.value;
    void inName.cursorPosition;
    void themeDropdown.expanded;
    void themeDropdown.selectedIndex;
    void themeDropdown.highlightedIndex;
    void logs.length;
    render();
  });

  stopReading = startReading((key, mouse) => handleInput(key, mouse));
}

function shutdown(): void {
  if (stopReading) stopReading();
  if (disposeRender) disposeRender();
  if (disposeFilter) disposeFilter();
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
