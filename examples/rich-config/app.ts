/**
 * rich-config demo body — interactive theme + widgets explorer.
 *
 * [LAW:dataflow-not-control-flow] Demos do not branch on environment; the
 * `TerminalHost` parameter is the value that differs between node and browser.
 *
 * Press Tab to navigate · Space/Enter to interact.
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
  EventRouter,
  StaticItem,
} from "../../src/widgets/index.js";
import type { TerminalHost } from "../../src/host/index.js";
import {
  Segment,
  Style,
  ColorSpec,
  Panel,
  ProgressBar,
  ROUNDED,
  DEFAULT_TERMINAL_THEME,
  asCodePoint,
  MONOKAI,
  SVG_EXPORT_THEME,
  NORD,
  GRUVBOX,
  DRACULA,
  TOKYO_NIGHT,
  FLEXOKI,
  CYBERPUNK,
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
import type { InteractiveWidget, MountEntry } from "../../src/widgets/types.js";
import type { ColorRgba } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

export interface DemoHandle {
  stop(): void;
}

export interface RunDemoOptions {
  /**
   * Called from inside the demo when the user signals shutdown (e.g. Ctrl-C).
   * Node bootstrap supplies `process.exit(0)`; the browser bootstrap omits it.
   */
  onShutdown?: () => void;
}

const THEMES = [
  { name: "Default", theme: DEFAULT_TERMINAL_THEME },
  { name: "Monokai", theme: MONOKAI },
  { name: "Nord", theme: NORD },
  { name: "Gruvbox", theme: GRUVBOX },
  { name: "Dracula", theme: DRACULA },
  { name: "Tokyo Night", theme: TOKYO_NIGHT },
  { name: "Flexoki", theme: FLEXOKI },
  { name: "Cyberpunk", theme: CYBERPUNK },
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

class AppState {
  selectedThemeIdx = 0;
  constructor() { makeAutoObservable(this); }
  get selectedTheme() { return THEMES[this.selectedThemeIdx]!.theme; }
  get selectedName() { return THEMES[this.selectedThemeIdx]!.name; }
  selectTheme(idx: number): void { this.selectedThemeIdx = idx; }
}

const MAX_LOGS = 3;

class LogBuffer {
  entries: string[] = [];
  constructor() { makeAutoObservable(this); }
  push(msg: string): void {
    this.entries.push(msg);
    if (this.entries.length > MAX_LOGS) this.entries.shift();
  }
}

export function runDemo(host: TerminalHost, options?: RunDemoOptions): DemoHandle {
  const state = new AppState();
  const logs = new LogBuffer();
  const log = (msg: string): void => logs.push(msg);

  const TERMINAL_ROWS = host.size().rows;
  const LOG_Y = Math.max(MAX_LOGS, TERMINAL_ROWS - MAX_LOGS);
  const SEPARATOR_Y = LOG_Y - 1;
  const STATUS_Y = LOG_Y - 2;

  const btnExport = new Button({ label: "Export", variant: "success", id: "btn-export" });
  const btnReset = new Button({ label: "Reset", variant: "danger", id: "btn-reset" });
  const btnDisabled = new Button({ label: "Locked", variant: "default", disabled: true, id: "btn-locked" });

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
  const inSearch = new TextInput({ placeholder: "Search palette", id: "in-search" });

  themeDropdown.onSubmit(() => {
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
  inSearch.onSubmit(() => log(`Palette search: ${JSON.stringify(inSearch.value)}`));

  const flashOff = (b: Button): void => {
    setTimeout(() => runInAction(() => { b.active = false; }), 80);
  };
  btnExport.onSubmit(() => { log(`Exported ${state.selectedName} theme`); flashOff(btnExport); });
  btnReset.onSubmit(() => {
    runInAction(() => {
      inSearch.value = "";
      inSearch.cursorPosition = asCodePoint(0);
      state.selectTheme(0);
    });
    log("Reset to Default theme");
    flashOff(btnReset);
  });

  const allWidgets: InteractiveWidget[] = [
    themeDropdown, inSearch, cbMuted, cbAnsi, cbProgress, tgDarkOnly,
    slContrast, slFill, btnExport, btnReset, btnDisabled,
  ];

  const fm = new DefaultFocusManager();
  const screen = new DefaultScreen({ focusManager: fm, host });
  const router = new EventRouter({ screen, host });

  const paletteColor = (c: ColorRgba): ColorSpec => ColorSpec.fromRgba(c);
  const styledLine = (text: string, style: Style): Renderable => ({
    render(_options: RenderOptions): Iterable<Segment> { return [new Segment(text, style)]; },
  });
  const luminance = (c: ColorRgba): number => {
    const ch = (v: number): number => {
      const x = v / 255;
      return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
    };
    return 0.2126 * ch(c.red) + 0.7152 * ch(c.green) + 0.0722 * ch(c.blue);
  };

  const headerStyle = new Style({ color: ColorSpec.fromRgb(0, 200, 200), bold: true });
  const dimStyle = new Style({ dim: true });
  const sectionHeadStyle = new Style({ color: ColorSpec.fromRgb(220, 200, 80), bold: true });

  const headerItem = new StaticItem({ id: "static-header", render: styledLine("rich-js Theme + Widgets Explorer", headerStyle) });
  const subtitleItem = new StaticItem({ id: "static-subtitle", render: styledLine("Tab · Space/Enter · Click · Ctrl-C to exit", dimStyle) });
  const widgetsHeading = new StaticItem({ id: "static-widgets-heading", render: styledLine("Interactive Widgets", sectionHeadStyle) });

  const spacer = (id: string): StaticItem =>
    new StaticItem({ id, render: () => [new Segment(" ")] });

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

  const PALETTE_ROW_WIDTH = 76;
  const paletteSearchItem = new StaticItem({
    id: "static-palette-search",
    render: (_options) => {
      const palette = state.selectedTheme.palette;
      const query = inSearch.value.toLowerCase();
      const all = [...palette.vars.entries()];
      const matches = all.filter(([key]) => key.toLowerCase().includes(query));
      const header = `palette ${matches.length}/${all.length}  `;
      const out: Segment[] = [new Segment(header, sectionHeadStyle)];
      let used = header.length;
      let shown = 0;
      for (const [key, c] of matches) {
        const chip = ` ${key} `;
        if (used + chip.length + 1 > PALETTE_ROW_WIDTH) break;
        const fgLight = luminance(c) > 0.179;
        out.push(
          new Segment(chip, new Style({
            bgcolor: ColorSpec.fromRgba(c),
            color: fgLight ? ColorSpec.fromRgb(0, 0, 0) : ColorSpec.fromRgb(255, 255, 255),
          })),
        );
        out.push(new Segment(" "));
        used += chip.length + 1;
        shown++;
      }
      const overflow = matches.length - shown;
      if (overflow > 0) {
        const marker = `+${overflow}`;
        if (used + marker.length <= PALETTE_ROW_WIDTH) out.push(new Segment(marker, dimStyle));
      }
      return out;
    },
  });

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
        const swatchStyle = new Style({ color: ColorSpec.fromRgba(c), bgcolor: ColorSpec.fromRgba(c) });
        segments.push(new Segment("  ", swatchStyle));
        segments.push(new Segment(`██${String(i).padStart(2, " ")} `, new Style({ color: ColorSpec.fromRgba(c) })));
      }
      return segments;
    },
  });

  const statusItem = new StaticItem({
    id: "static-status",
    render: (_options) => {
      const focused = fm.current;
      const id = focused?.id ?? "none";
      const focusedFlag = focused?.focused ?? false;
      const activeFlag = focused?.active ?? false;
      const arrowStyle = new Style({ color: ColorSpec.fromRgb(220, 200, 80), bold: true });
      return [
        new Segment("▸ ", arrowStyle),
        new Segment(`${id}  `),
        new Segment(`focused=${focusedFlag} active=${activeFlag}`, dimStyle),
      ];
    },
  });

  const separatorItem = new StaticItem({ id: "static-separator", render: styledLine("─".repeat(76), dimStyle) });

  const logItem = new StaticItem({
    id: "static-logs",
    render: (_options) => {
      const segments: Segment[] = [];
      for (let i = 0; i < MAX_LOGS; i++) {
        const entry = logs.entries[i];
        if (entry !== undefined) segments.push(new Segment(`  ${entry}`, dimStyle));
        if (i < MAX_LOGS - 1) segments.push(new Segment("\n"));
      }
      return segments;
    },
  });

  const mountList: MountEntry[] = [
    headerItem, subtitleItem, spacer("sp-1"), widgetsHeading,
    themeDropdown, { widget: inSearch, placement: { kind: "inline" } },
    spacer("sp-2"),
    cbMuted,
    { widget: cbAnsi, placement: { kind: "inline" } },
    { widget: cbProgress, placement: { kind: "inline" } },
    { widget: tgDarkOnly, placement: { kind: "inline" } },
    spacer("sp-3"),
    slContrast, { widget: slFill, placement: { kind: "inline" } },
    spacer("sp-4"),
    btnExport,
    { widget: btnReset, placement: { kind: "inline" } },
    { widget: btnDisabled, placement: { kind: "inline" } },
    spacer("sp-5"),
    titlePanelItem, spacer("sp-6"), swatchesItem, paletteSearchItem, spacer("sp-7"),
    progressItem, spacer("sp-8"), ansiItem,
    { widget: statusItem, placement: { kind: "fixed", x: 0, y: STATUS_Y } },
    { widget: separatorItem, placement: { kind: "fixed", x: 0, y: SEPARATOR_Y } },
    { widget: logItem, placement: { kind: "fixed", x: 0, y: LOG_Y } },
  ];

  const focusableAt = (x: number, y: number): InteractiveWidget | null => {
    for (let i = allWidgets.length - 1; i >= 0; i--) {
      const widget = allWidgets[i]!;
      if (widget.containsPoint(x, y)) return widget;
    }
    return null;
  };

  let stopped = false;
  let disposeTheme: (() => void) | null = null;
  let disposeFilter: (() => void) | null = null;

  const handle: DemoHandle = {
    stop(): void {
      if (stopped) return;
      stopped = true;
      router.stop();
      if (disposeTheme) disposeTheme();
      if (disposeFilter) disposeFilter();
      screen.stop();
      host.write("\x1b[?1049l\x1b[1;36mGoodbye!\x1b[0m\n");
    },
  };

  router.onKey((event) => {
    if (event.ctrl && event.key === "c") {
      handle.stop();
      options?.onShutdown?.();
      event.stop();
    }
  }, { priority: "high" });

  router.onMouse((event) => {
    if (event.type !== "mouse_up") return;
    const hit = focusableAt(event.x, event.y);
    if (hit) fm.focus(hit);
  });

  // [LAW:single-enforcer] Alt-screen state has exactly one restore site
  // (`handle.stop()`). The startup block below enters the alt-screen and
  // brings the autoruns/screen/router online; if anything throws inside,
  // the catch routes through the same `handle.stop()` so the restore
  // sequence runs and the terminal is never left in the alternate buffer.
  try {
    host.write("\x1b[?1049h\x1b[H");
    screen.mount(...mountList);

    disposeFilter = autorun(() => {
      const darkOnly = tgDarkOnly.on;
      const canonicalTheme = THEMES[state.selectedThemeIdx]!;
      const filtered = THEMES.filter((t) => !darkOnly || t.theme.palette.dark);
      runInAction(() => {
        themeDropdown.options = filtered.map((t) => t.name);
        themeDropdown.selectedIndex = filtered.indexOf(canonicalTheme);
      });
    });

    disposeTheme = autorun(() => {
      const theme = state.selectedTheme;
      for (const widget of allWidgets) {
        const setTheme = (widget as { setTheme?: (t: typeof theme) => void }).setTheme;
        if (typeof setTheme === "function") setTheme.call(widget, theme);
      }
    });

    screen.start();
    router.start();
  } catch (err) {
    handle.stop();
    throw err;
  }

  return handle;
}
