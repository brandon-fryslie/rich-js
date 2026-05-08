/**
 * rich-config — interactive theme + widgets explorer for rich-js.
 *
 * Mounts every interactive widget (Button, Checkbox, Toggle, TextInput,
 * Dropdown, Slider) plus the surrounding static content (header, palette
 * swatches, progress bars, status row, log buffer) into a single
 * DefaultScreen. Screen owns the render loop, the overlay pass, and
 * widget bounds — there is no parallel writeAt-based render path.
 *
 * Layout uses three placement kinds (see src/widgets/types.ts):
 *   flow   — vertical stack at x=0 (header/subtitle/heading/content)
 *   inline — horizontal continuation of the preceding row (filter input
 *            beside the dropdown; checkbox/slider/button clusters)
 *   fixed  — absolute (x, y) for the status row and log buffer that
 *            anchor at the bottom regardless of content growth.
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
  DefaultScreen,
  DefaultFocusManager,
  StaticItem,
  Segment,
  Style,
  ColorSpec,
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
import type { InteractiveWidget, KeyEvent, WidgetMouseEvent, MountEntry } from "../../src/widgets/types.js";
import type { ColorRgba } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";
import {
  enterRawMode,
  leaveRawMode,
  enableMouse,
  disableMouse,
  startReading,
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

// --- Layout constants (0-indexed; Screen owns absolute coordinates) ---

// [LAW:dataflow-not-control-flow] Bottom-anchored rows derive from the
// terminal's height at startup so the demo fits any reasonable size instead
// of forcing a hardcoded 45-row layout that scrolls off short terminals.
// The flow content above takes ~26 rows, so any terminal >= 30 rows works
// without overlap; smaller terminals still render but the bottom anchors
// will overlap the flow content.
const MAX_LOGS = 3;
const TERMINAL_ROWS = process.stdout.rows ?? 45;
const LOG_Y = Math.max(MAX_LOGS, TERMINAL_ROWS - MAX_LOGS);
const SEPARATOR_Y = LOG_Y - 1;
const STATUS_Y = LOG_Y - 2;

// --- Log buffer ---

class LogBuffer {
  entries: string[] = [];
  constructor() { makeAutoObservable(this); }
  push(msg: string): void {
    this.entries.push(msg);
    if (this.entries.length > MAX_LOGS) this.entries.shift();
  }
}
const logs = new LogBuffer();
const log = (msg: string): void => logs.push(msg);

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
const slFill = new Slider({ value: 60, min: 0, max: 100, step: 5, width: 25, id: "sl-fill" });
const slContrast = new Slider({ value: 0.179, min: 0, max: 1, step: 0.05, width: 25, id: "sl-contrast" });
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
slFill.onChange(() => log(`Progress fill → ${slFill.value}%`));
slContrast.onChange(() => log(`Contrast threshold → ${slContrast.value.toFixed(2)}`));
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
  slContrast,
  slFill,
  btnExport,
  btnReset,
  btnDisabled,
];

// --- Focus manager + Screen ---

const fm = new DefaultFocusManager();
const screen = new DefaultScreen({
  focusManager: fm,
  out: process.stdout,
});

// --- Static-content rendering helpers ---

function paletteColor(c: ColorRgba): ColorSpec {
  return ColorSpec.fromRgba(c);
}

// Build a renderable that emits a fixed Style + text. Tiny helper to keep
// the StaticItem definitions terse.
function styledLine(text: string, style: Style): Renderable {
  return {
    render(_options: RenderOptions): Iterable<Segment> {
      return [new Segment(text, style)];
    },
  };
}

function luminance(c: ColorRgba): number {
  const ch = (v: number): number => {
    const x = v / 255;
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
  };
  return 0.2126 * ch(c.red) + 0.7152 * ch(c.green) + 0.0722 * ch(c.blue);
}

// --- StaticItem definitions ---

const headerStyle = new Style({
  color: ColorSpec.fromRgb(0, 200, 200),
  bold: true,
});
const dimStyle = new Style({ dim: true });
const sectionHeadStyle = new Style({
  color: ColorSpec.fromRgb(220, 200, 80),
  bold: true,
});

const headerItem = new StaticItem({
  id: "static-header",
  render: styledLine("rich-js Theme + Widgets Explorer", headerStyle),
});
const subtitleItem = new StaticItem({
  id: "static-subtitle",
  render: styledLine("Tab · Space/Enter · Click · Ctrl-C to exit", dimStyle),
});
const widgetsHeading = new StaticItem({
  id: "static-widgets-heading",
  render: styledLine("Interactive Widgets", sectionHeadStyle),
});

// A blank one-row spacer used to introduce vertical gaps between flow groups.
function spacer(id: string): StaticItem {
  return new StaticItem({
    id,
    render: () => [new Segment(" ")],
  });
}

// Theme name panel — re-renders each frame because it depends on
// state.selectedTheme + state.selectedName. The function form of
// StaticItem.render is called inside Screen's autorun, so reads of
// observables here subscribe Screen to them.
const titlePanelItem = new StaticItem({
  id: "static-title-panel",
  render: (_options) => {
    const theme = state.selectedTheme;
    const name = state.selectedName;
    const fg = paletteColor(theme.foregroundColor);
    const bg = paletteColor(theme.backgroundColor);
    const palette = theme.palette;
    const panel = new Panel(` ${name} `, {
      box: ROUNDED,
      style: new Style({ color: fg, bgcolor: bg, bold: true }),
      borderStyle: new Style({ color: paletteColor(palette.get("primary")!) }),
      width: 78,
      padding: 0,
    });
    return panel.render({ maxWidth: 80 });
  },
});

// Palette swatch row. Reads cbMuted.checked + slContrast.value so the
// swatch composition reacts to those toggles.
const swatchesItem = new StaticItem({
  id: "static-swatches",
  render: (_options) => {
    const theme = state.selectedTheme;
    const palette = theme.palette;
    const showMuted = cbMuted.checked;
    const contrastThreshold = slContrast.value;
    const accentKeys = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
    const segments: Segment[] = [];
    for (const key of accentKeys) {
      const c = palette.get(key)!;
      const lum = luminance(c);
      const fgLight = lum > 0.179;
      const swatchStyle = new Style({
        color: fgLight ? ColorSpec.fromRgb(0, 0, 0) : ColorSpec.fromRgb(255, 255, 255),
        bgcolor: ColorSpec.fromRgba(c),
        bold: true,
      });
      segments.push(new Segment(` ${key.padEnd(9)}`, swatchStyle));

      const isOk = lum > contrastThreshold;
      const tagColor = palette.get(isOk ? "success" : "warning")!;
      const tagStyle = new Style({ color: ColorSpec.fromRgba(tagColor) });
      segments.push(new Segment(isOk ? " OK " : "low ", tagStyle));

      if (showMuted) {
        const muted = palette.get(`${key}-muted`)!;
        const mutedFgLight = luminance(muted) > 0.179;
        const mutedStyle = new Style({
          color: mutedFgLight ? ColorSpec.fromRgb(0, 0, 0) : ColorSpec.fromRgb(200, 200, 200),
          bgcolor: ColorSpec.fromRgba(muted),
        });
        segments.push(new Segment(" muted ", mutedStyle));
      }
      segments.push(new Segment(" "));
    }
    return segments;
  },
});

// Progress section. When cbProgress.checked is false, render returns [] —
// pass 1 produces a 0-height widget and the flow cursor doesn't advance
// (dataflow-not-control-flow: variability lives in the data, not in
// whether the renderer runs).
const progressItem = new StaticItem({
  id: "static-progress",
  render: (_options) => {
    if (!cbProgress.checked) return [];
    const theme = state.selectedTheme;
    const palette = theme.palette;
    const fillPct = slFill.value;
    const segments: Segment[] = [];
    const progressData = [
      { label: "primary", color: "primary", pct: fillPct },
      { label: "success", color: "success", pct: fillPct },
      { label: "warning", color: "warning", pct: fillPct },
      { label: "error",   color: "error",   pct: fillPct },
    ];
    for (let i = 0; i < progressData.length; i++) {
      const p = progressData[i]!;
      const labelStyle = new Style({ color: paletteColor(palette.get(p.color)!), bold: true });
      segments.push(new Segment(` ${p.label.padEnd(10)} `, labelStyle));
      const bar = new ProgressBar({
        total: 100,
        completed: p.pct,
        width: 30,
        completeStyle: new Style({ bgcolor: paletteColor(palette.get(p.color)!) }),
        style: new Style({ bgcolor: paletteColor(palette.get(`${p.color}-muted`)!) }),
      });
      for (const seg of bar.render({ maxWidth: 50 })) segments.push(seg);
      if (i < progressData.length - 1) segments.push(new Segment("\n"));
    }
    return segments;
  },
});

// ANSI palette. Same dataflow pattern: returns [] when unchecked.
const ansiItem = new StaticItem({
  id: "static-ansi",
  render: (_options) => {
    if (!cbAnsi.checked) return [];
    const theme = state.selectedTheme;
    const palette = theme.palette;
    const headingStyle = new Style({ color: paletteColor(palette.get("secondary")!), bold: true });
    const segments: Segment[] = [new Segment("ANSI Palette", headingStyle), new Segment("\n")];
    const ansiTable = theme.ansiColors;
    for (let i = 0; i < 16; i++) {
      const c = ansiTable.get(i);
      const swatchStyle = new Style({
        color: ColorSpec.fromRgba(c),
        bgcolor: ColorSpec.fromRgba(c),
      });
      segments.push(new Segment("  ", swatchStyle));
      segments.push(new Segment(`██${String(i).padStart(2, " ")} `, new Style({ color: ColorSpec.fromRgba(c) })));
    }
    return segments;
  },
});

// Status row (focus diagnostic). Reads fm.current observables.
const statusItem = new StaticItem({
  id: "static-status",
  render: (_options) => {
    const focused = fm.current;
    const id = focused?.id ?? "none";
    const focusedFlag = focused?.focused ?? false;
    const activeFlag = focused?.active ?? false;
    const arrowStyle = new Style({
      color: ColorSpec.fromRgb(220, 200, 80),
      bold: true,
    });
    return [
      new Segment("▸ ", arrowStyle),
      new Segment(`${id}  `),
      new Segment(`focused=${focusedFlag} active=${activeFlag}`, dimStyle),
    ];
  },
});

// Separator above the log buffer — single static row.
const separatorItem = new StaticItem({
  id: "static-separator",
  render: styledLine("─".repeat(76), dimStyle),
});

// Log buffer — three rows, newest at the bottom. Reads logs.entries.
const logItem = new StaticItem({
  id: "static-logs",
  render: (_options) => {
    const segments: Segment[] = [];
    for (let i = 0; i < MAX_LOGS; i++) {
      const entry = logs.entries[i];
      if (entry !== undefined) {
        segments.push(new Segment(`  ${entry}`, dimStyle));
      }
      if (i < MAX_LOGS - 1) segments.push(new Segment("\n"));
    }
    return segments;
  },
});

// --- Mount layout ---

// [LAW:single-enforcer] All layout flows through Screen. Mount order +
// placements together describe the entire frame; there is no second
// render path.
const mountList: MountEntry[] = [
  // Top: header / subtitle / heading.
  headerItem,
  subtitleItem,
  spacer("sp-1"),
  widgetsHeading,

  // Row of dropdown + filter input.
  themeDropdown,
  { widget: inName, placement: { kind: "inline" } },

  spacer("sp-2"),

  // Row of visibility checkboxes + dark-only toggle.
  cbMuted,
  { widget: cbAnsi, placement: { kind: "inline" } },
  { widget: cbProgress, placement: { kind: "inline" } },
  { widget: tgDarkOnly, placement: { kind: "inline" } },

  spacer("sp-3"),

  // Row of sliders.
  slContrast,
  { widget: slFill, placement: { kind: "inline" } },

  spacer("sp-4"),

  // Row of action buttons.
  btnExport,
  { widget: btnReset, placement: { kind: "inline" } },
  { widget: btnDisabled, placement: { kind: "inline" } },

  spacer("sp-5"),

  // Theme presentation: panel + swatches.
  titlePanelItem,
  spacer("sp-6"),
  swatchesItem,
  spacer("sp-7"),

  // Optional sections (each renders 0 rows when its checkbox is off).
  progressItem,
  spacer("sp-8"),
  ansiItem,

  // Bottom-anchored: status row + separator + log buffer.
  { widget: statusItem, placement: { kind: "fixed", x: 0, y: STATUS_Y } },
  { widget: separatorItem, placement: { kind: "fixed", x: 0, y: SEPARATOR_Y } },
  { widget: logItem, placement: { kind: "fixed", x: 0, y: LOG_Y } },
];

// --- Input handling ---

function handleInput(key: KeyEvent | null, mouse: WidgetMouseEvent | null): void {
  if (key?.ctrl && key.key === "c") { shutdown(); return; }

  if (key?.key === "tab") {
    key.shift ? fm.prev() : fm.next();
    return;
  }

  if (key && fm.current) {
    fm.current.handleKey(key);
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
let disposeTheme: (() => void) | null = null;
let disposeFilter: (() => void) | null = null;

function startup(): void {
  if (!process.stdin.isTTY) {
    process.stderr.write("Error: demo-inputs requires an interactive terminal.\n");
    process.exit(1);
  }

  enterRawMode();
  enableMouse();
  // Move below current shell prompt so Screen's first frame doesn't paint
  // over the user's existing terminal content.
  process.stdout.write("\n");

  // Mount everything before starting Screen — Screen's first render then
  // produces a complete frame in one go.
  screen.mount(...mountList);

  // [LAW:single-enforcer] Filter pipeline: inName.value (substring) +
  // tgDarkOnly.on (dark-only) + state.selectedThemeIdx (canonical
  // selection) → themeDropdown.options (filtered names) +
  // themeDropdown.selectedIndex (filtered position of the canonical
  // theme, or -1 if filtered out).
  disposeFilter = autorun(() => {
    const filterText = inName.value.toLowerCase();
    const darkOnly = tgDarkOnly.on;
    const canonicalTheme = THEMES[state.selectedThemeIdx]!;
    const filtered = THEMES
      .filter((t) => !darkOnly || t.theme.palette.dark)
      .filter((t) => filterText === "" || t.name.toLowerCase().includes(filterText));
    runInAction(() => {
      themeDropdown.options = filtered.map((t) => t.name);
      themeDropdown.selectedIndex = filtered.indexOf(canonicalTheme);
    });
  });

  // Apply the active theme to every themable widget. State changes here
  // do not directly drive Screen — Screen subscribes to widget observables
  // and re-renders on its own.
  disposeTheme = autorun(() => {
    const theme = state.selectedTheme;
    for (const widget of allWidgets) {
      const setTheme = (widget as { setTheme?: (t: typeof theme) => void }).setTheme;
      if (typeof setTheme === "function") setTheme.call(widget, theme);
    }
  });

  screen.start();
  stopReading = startReading((key, mouse) => handleInput(key, mouse));
}

function shutdown(): void {
  if (stopReading) stopReading();
  if (disposeTheme) disposeTheme();
  if (disposeFilter) disposeFilter();
  screen.stop();
  disableMouse();
  process.stdout.write("\n\x1b[1;36mGoodbye!\x1b[0m\n");
  leaveRawMode();
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

startup();
