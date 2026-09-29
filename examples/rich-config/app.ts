/**
 * rich-config demo body — interactive theme + widgets explorer.
 *
 * [LAW:dataflow-not-control-flow] Demos do not branch on environment; the
 * `TerminalHost` parameter is the value that differs between node and browser.
 *
 * The widgets are laid out by composition, and nothing tells the app where
 * they went: they sit in a `Panel` in the left pane of a `Layout` split, the
 * preview they drive in a `Panel` in the right pane, and the status and log
 * rows hold the bottom of the screen. `test/examples/rich-config/` (node host)
 * and `e2e/rich-config.spec.ts` (browser host) drive this demo through that
 * nesting, key by key and click by click.
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
  WidgetApp,
  widgetAt,
  StaticItem,
} from "../../src/widgets/index.js";
import type { TerminalHost } from "../../src/host/index.js";
import {
  Segment,
  Style,
  ColorSpec,
  Panel,
  ProgressBar,
  Columns,
  RichText,
  Group,
  Layout,
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
import type { InteractiveWidget } from "../../src/widgets/types.js";
import type { ColorRgba } from "../../src/core/color.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

export interface DemoHandle {
  stop(): void;
  /** Settles once the demo has stopped and handed the terminal back. */
  readonly done: Promise<void>;
  /** The rows on screen now, as painted. */
  readonly frame: readonly (readonly Segment[])[];
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
// The four toggles fit two to a row, and a slider fits whole.
const CONTROLS_WIDTH = 44;

class LogBuffer {
  entries: string[] = [];
  constructor() { makeAutoObservable(this); }
  push(msg: string): void {
    this.entries.push(msg);
    if (this.entries.length > MAX_LOGS) this.entries.shift();
  }
}

export function runDemo(host: TerminalHost): DemoHandle {
  const state = new AppState();
  const logs = new LogBuffer();
  const log = (msg: string): void => logs.push(msg);

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

  const spacer = (id: string): StaticItem =>
    new StaticItem({ id, render: () => [new Segment(" ")] });

  const titlePanelItem = new StaticItem({
    id: "static-title-panel",
    render: (options) => {
      const theme = state.selectedTheme;
      const name = state.selectedName;
      const fg = paletteColor(theme.foregroundColor);
      const bg = paletteColor(theme.backgroundColor);
      const palette = theme.palette;
      const panel = new Panel(` ${name} `, {
        box: ROUNDED,
        style: new Style({ color: fg, bgcolor: bg, bold: true }),
        borderStyle: new Style({ color: paletteColor(palette.get("primary")!) }),
        padding: 0,
      });
      return panel.render({ maxWidth: options.maxWidth });
    },
  });

  const swatchesItem = new StaticItem({
    id: "static-swatches",
    render: (options) => {
      const theme = state.selectedTheme;
      const palette = theme.palette;
      const showMuted = cbMuted.checked;
      const contrastThreshold = slContrast.value;
      const accentKeys = ["primary", "secondary", "accent", "success", "warning", "error"] as const;
      // As many to a row as the pane is wide.
      return new Columns(accentKeys.map((key) => {
        const c = palette.get(key)!;
        const lum = luminance(c);
        const fgLight = lum > 0.179;
        const swatchStyle = new Style({
          color: fgLight ? ColorSpec.fromRgb(0, 0, 0) : ColorSpec.fromRgb(255, 255, 255),
          bgcolor: ColorSpec.fromRgba(c),
          bold: true,
        });
        const isOk = lum > contrastThreshold;
        const tagColor = palette.get(isOk ? "success" : "warning")!;
        const swatch = RichText.assemble([
          [` ${key.padEnd(10)}`, swatchStyle],
          [isOk ? " OK " : "low ", new Style({ color: ColorSpec.fromRgba(tagColor) })],
        ]);
        if (showMuted) {
          const muted = palette.get(`${key}-muted`)!;
          const mutedFgLight = luminance(muted) > 0.179;
          swatch.append(" muted ", new Style({
            color: mutedFgLight ? ColorSpec.fromRgb(0, 0, 0) : ColorSpec.fromRgb(200, 200, 200),
            bgcolor: ColorSpec.fromRgba(muted),
          }));
        }
        return swatch;
      })).render(options);
    },
  });

  const paletteSearchItem = new StaticItem({
    id: "static-palette-search",
    render: (options) => {
      const rowWidth = options.maxWidth;
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
        if (used + chip.length + 1 > rowWidth) break;
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
        if (used + marker.length <= rowWidth) out.push(new Segment(marker, dimStyle));
      }
      return out;
    },
  });

  const progressItem = new StaticItem({
    id: "static-progress",
    render: (options) => {
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
        const label = ` ${p.label.padEnd(10)} `;
        segments.push(new Segment(label, labelStyle));
        const bar = new ProgressBar({
          total: 100,
          completed: p.pct,
          completeStyle: new Style({ bgcolor: paletteColor(palette.get(p.color)!) }),
          style: new Style({ bgcolor: paletteColor(palette.get(`${p.color}-muted`)!) }),
        });
        for (const seg of bar.render({ ...options, maxWidth: options.maxWidth - label.length })) segments.push(seg);
        if (i < progressData.length - 1) segments.push(new Segment("\n"));
      }
      return segments;
    },
  });

  const ansiItem = new StaticItem({
    id: "static-ansi",
    render: (options) => {
      if (!cbAnsi.checked) return [];
      const theme = state.selectedTheme;
      const palette = theme.palette;
      const headingStyle = new Style({ color: paletteColor(palette.get("secondary")!), bold: true });
      const ansiTable = theme.ansiColors;
      const swatches = Array.from({ length: 16 }, (_, i) => RichText.assemble([
        ["██", new Style({ color: ColorSpec.fromRgba(ansiTable.get(i)) })],
        String(i).padStart(2, " "),
      ]));
      return [
        new Segment("ANSI Palette", headingStyle), new Segment("\n"),
        ...new Columns(swatches).render(options),
      ];
    },
  });

  const statusItem = new StaticItem({
    id: "static-status",
    render: (_options) => {
      const focused = app.focusManager.current;
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

  const separatorItem = new StaticItem({
    id: "static-separator",
    render: (options) => [new Segment("─".repeat(options.maxWidth), dimStyle)],
  });

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

  const controls = new Panel(
    new Group(
      themeDropdown, inSearch, spacer("sp-1"),
      new Columns([cbMuted, cbAnsi, cbProgress, tgDarkOnly]), spacer("sp-2"),
      slContrast, slFill, spacer("sp-3"),
      new Columns([btnExport, btnReset, btnDisabled]),
    ),
    { title: "Widgets", box: ROUNDED },
  );
  const preview = new Panel(
    new Group(
      titlePanelItem, swatchesItem, paletteSearchItem, spacer("sp-4"),
      progressItem, spacer("sp-5"), ansiItem,
    ),
    { title: "Preview", box: ROUNDED },
  );
  const main = new Layout();
  main.splitRow(new Layout(controls, { size: CONTROLS_WIDTH }), new Layout(preview));
  const view = new Layout();
  // The status, separator and log rows hold the bottom of the screen.
  view.splitColumn(
    new Layout(new Group(headerItem, subtitleItem), { size: 2 }),
    main,
    new Layout(new Group(statusItem, separatorItem, logItem), { size: MAX_LOGS + 2 }),
  );

  const app = new WidgetApp({ host, surface: "alternate", view: () => view });

  app.onKey((event) => {
    if (event.ctrl && event.key === "c") {
      app.stop();
      event.stop();
    }
  }, { priority: "high" });

  app.onMouse((event) => {
    if (event.type !== "mouse_up") return;
    // The frame on screen says who drew the cell under the pointer; focus()
    // ignores a widget that cannot take focus.
    const hit = widgetAt(app.frame, event.x, event.y);
    if (hit) app.focusManager.focus(hit.widget);
  });

  const disposeFilter = autorun(() => {
    const darkOnly = tgDarkOnly.on;
    const canonicalTheme = THEMES[state.selectedThemeIdx]!;
    const filtered = THEMES.filter((t) => !darkOnly || t.theme.palette.dark);
    runInAction(() => {
      themeDropdown.options = filtered.map((t) => t.name);
      themeDropdown.selectedIndex = filtered.indexOf(canonicalTheme);
    });
  });

  const disposeTheme = autorun(() => {
    const theme = state.selectedTheme;
    for (const widget of allWidgets) {
      const setTheme = (widget as { setTheme?: (t: typeof theme) => void }).setTheme;
      if (typeof setTheme === "function") setTheme.call(widget, theme);
    }
  });

  return {
    stop: () => app.stop(),
    get frame() { return app.frame; },
    done: app.run().finally(() => {
      disposeFilter();
      disposeTheme();
    }),
  };
}
