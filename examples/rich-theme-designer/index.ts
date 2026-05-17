/**
 * rich-theme-designer — interactive palette-key + theme + category visualizer.
 *
 * Three controls compose a single styling decision:
 *   - Category:   *which* part of the UI to recolor (borders, titles,
 *                 scroll indicators, cursor, content text).
 *   - Theme:      *which* palette to draw from (18 built-in themes).
 *   - Palette key: *which* color in that palette to apply.
 *
 * The preview area below renders a variety of widgets so the chosen
 * (category, theme, key) triple can be evaluated in context, not in
 * isolation. Every widget reads the active theme for its non-overridden
 * styles, so the surrounding chrome stays cohesive while the chosen
 * category snaps to the picked color.
 *
 * Tab / Shift+Tab → navigate · Enter / Space → open dropdown · Esc → close
 * Ctrl+C → exit
 */

import { autorun, runInAction, makeAutoObservable } from "mobx";
import {
  DefaultScreen,
  DefaultFocusManager,
  EventRouter,
  Dropdown,
  TextInput,
  Panel,
  StaticItem,
  Segment,
  Style,
  ColorSpec,
  Rule,
  DEFAULT_TERMINAL_THEME,
  MONOKAI,
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
import type { TerminalTheme, ColorRgba } from "../../src/core/color.js";
import type { InteractiveWidget, MountEntry } from "../../src/widgets/types.js";
import type { Renderable } from "../../src/core/protocol.js";
import { contrastFor } from "../../src/themes/colorMath.js";

// ─── Catalogues ────────────────────────────────────────────────────────────

const THEMES: { name: string; theme: TerminalTheme }[] = [
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
  { name: "Rosé Pine", theme: ROSE_PINE },
  { name: "Rosé Pine Moon", theme: ROSE_PINE_MOON },
  { name: "Rosé Pine Dawn", theme: ROSE_PINE_DAWN },
  { name: "Atom One Dark", theme: ATOM_ONE_DARK },
  { name: "Atom One Light", theme: ATOM_ONE_LIGHT },
];

// [LAW:one-source-of-truth] CATEGORIES is the only enumeration of what's
// stylable; widgets read state.styleFor(name) and the names here are the
// keys. Adding a category = adding one entry here + one read site below.
const CATEGORIES = [
  "(none)",
  "borders",
  "titles",
  "scroll indicator",
  "cursor highlight",
  "content text",
] as const;
type Category = (typeof CATEGORIES)[number];

const ACCENTS = ["primary", "secondary", "accent", "success", "warning", "error"];
const PALETTE_KEYS: string[] = [
  ...ACCENTS,
  ...ACCENTS.map((a) => `${a}-muted`),
  ...ACCENTS.map((a) => `text-${a}`),
  ...ACCENTS.map((a) => `on-${a}`),
  "background",
  "foreground",
  "surface",
];

// ─── State ────────────────────────────────────────────────────────────────

class State {
  categoryIdx = 0;
  themeIdx = 0;
  paletteKeyIdx = 0;

  constructor() {
    makeAutoObservable(this);
  }

  get theme(): TerminalTheme { return THEMES[this.themeIdx]!.theme; }
  get themeName(): string { return THEMES[this.themeIdx]!.name; }
  get category(): Category { return CATEGORIES[this.categoryIdx]!; }
  get paletteKey(): string { return PALETTE_KEYS[this.paletteKeyIdx]!; }

  get rgba(): ColorRgba | undefined {
    return this.theme.palette.get(this.paletteKey);
  }
  get colorSpec(): ColorSpec | undefined {
    const c = this.rgba;
    return c === undefined ? undefined : ColorSpec.fromRgba(c);
  }

  // The single style that the picked (theme, key) compose into, applied
  // *only* to whichever category the user chose. Returns `undefined` for
  // every other category — those keep their widget defaults.
  //
  // [LAW:dataflow-not-control-flow] cursor-highlight wants the chosen
  // color as a *background* (with auto-contrast foreground); every other
  // category wants it as a foreground. The branch is a one-shot data
  // transform per category, not a scattered policy.
  styleFor(cat: Category): Style | undefined {
    if (this.category !== cat) return undefined;
    const color = this.colorSpec;
    if (color === undefined) return undefined;
    if (cat === "cursor highlight" && this.rgba !== undefined) {
      const onColor = ColorSpec.fromRgba(contrastFor(this.rgba));
      return new Style({ bgcolor: color, color: onColor });
    }
    return new Style({ color });
  }
}

const state = new State();

// ─── Dropdowns ────────────────────────────────────────────────────────────

const catDD = new Dropdown({ options: [...CATEGORIES], id: "dd-cat" });
const themeDD = new Dropdown({ options: THEMES.map((t) => t.name), id: "dd-theme" });
const keyDD = new Dropdown({ options: PALETTE_KEYS, selectedIndex: 0, id: "dd-key" });

catDD.onSubmit(() => runInAction(() => { state.categoryIdx = catDD.selectedIndex; }));
themeDD.onSubmit(() => runInAction(() => { state.themeIdx = themeDD.selectedIndex; }));
keyDD.onSubmit(() => runInAction(() => { state.paletteKeyIdx = keyDD.selectedIndex; }));

// ─── Preview widgets ──────────────────────────────────────────────────────

// Static showcase content. These TextInputs are rendered as preview
// panels — they are NOT registered with the FocusManager (Tab does not
// land on them) and so don't receive key/mouse events. The sample text
// is here to give the scroll-indicator showcase real multi-line content
// to wrap; it is not meant to suggest the previews are interactive.
const sampleText =
  "Multi-line content that\n" +
  "extends past the\n" +
  "viewport so the scroll\n" +
  "arrows and cursor\n" +
  "styling are exercised.\n" +
  "This preview is read-only —\n" +
  "the dropdowns above are\n" +
  "the editable widgets.";

const tiArrows = new TextInput({
  value: sampleText,
  multiline: true,
  maxRows: 4,
  scrollIndicator: "arrows",
  id: "ti-arrows",
});

const tiIndices = new TextInput({
  value: sampleText,
  multiline: true,
  maxRows: 4,
  scrollIndicator: "indices",
  id: "ti-indices",
});

// Focus targets: dropdowns only. The preview TextInputs are NOT in
// this list because they aren't mounted on the Screen / registered with
// the FocusManager — including them would let focusableAt(x, y) return
// a widget that fm.focus() then rejects (silent no-op, confusing UX).
const focusTargets: InteractiveWidget[] = [catDD, themeDD, keyDD];
// Theme-target widgets: everything that resolves palette colors,
// including the read-only previews so swapping the theme repaints them.
const themeTargets: InteractiveWidget[] = [catDD, themeDD, keyDD, tiArrows, tiIndices];

// ─── Style autorun ────────────────────────────────────────────────────────

// Mirror state-derived styles onto the widgets each time state changes.
// Doing this in an autorun (not inside render) keeps render free of
// side effects — Screen's render path stays a pure function of widget
// observables.
let disposeStyle: (() => void) | null = null;
function startStyleAutorun(): void {
  disposeStyle = autorun(() => {
    runInAction(() => {
      const indicatorS = state.styleFor("scroll indicator");
      const cursorS = state.styleFor("cursor highlight");
      const contentS = state.styleFor("content text");
      for (const ti of [tiArrows, tiIndices]) {
        ti.indicatorStyleOverride = indicatorS;
        ti.cursorStyleOverride = cursorS;
        ti.contentStyleOverride = contentS;
      }
    });
  });
}

// ─── Theme autorun (applies selected theme to every widget) ───────────────

let disposeTheme: (() => void) | null = null;
function startThemeAutorun(): void {
  disposeTheme = autorun(() => {
    const theme = state.theme;
    for (const w of themeTargets) {
      const setTheme = (w as { setTheme?: (t: TerminalTheme) => void }).setTheme;
      if (typeof setTheme === "function") setTheme.call(w, theme);
    }
  });
}

// ─── Static items ─────────────────────────────────────────────────────────

const dimStyle = new Style({ dim: true });
const cyanBoldStyle = new Style({
  color: ColorSpec.fromRgb(80, 200, 220),
  bold: true,
});

const headerItem = new StaticItem({
  id: "static-header",
  render: () => [
    new Segment("rich-theme-designer", cyanBoldStyle),
    new Segment("   pick a category + theme + palette key, see it live", dimStyle),
  ],
});

function spacer(id: string): StaticItem {
  return new StaticItem({ id, render: () => [new Segment("")] });
}

function staticLabel(text: string): StaticItem {
  return new StaticItem({
    id: `lbl-${text.replace(/\s+/g, "-")}`,
    render: () => [new Segment(text, dimStyle)],
  });
}

// "Selection" status row — always reflects the current (cat, theme, key)
// and shows a colored swatch using the picked palette color so the user
// can sanity-check the color before applying it.
const selectionItem = new StaticItem({
  id: "static-selection",
  render: () => {
    const color = state.colorSpec;
    const swatchStyle = color !== undefined
      ? new Style({ bgcolor: color })
      : new Style({ dim: true });
    return [
      new Segment(" Picked: ", dimStyle),
      new Segment(`${state.themeName} / ${state.paletteKey}`, new Style({ bold: true })),
      new Segment("  →  ", dimStyle),
      new Segment("        ", swatchStyle),
      new Segment("   applies to: ", dimStyle),
      new Segment(state.category, new Style({ bold: true, color: state.colorSpec })),
    ];
  },
});

// All palette keys as little colored chips, so the user can see every
// color at once for the current theme. Helpful for choosing keys.
const swatchesItem = new StaticItem({
  id: "static-swatches",
  render: (opts) => {
    const segs: Segment[] = [];
    let col = 0;
    const maxCol = opts.maxWidth - 1;
    for (const key of PALETTE_KEYS) {
      const rgba = state.theme.palette.get(key);
      if (rgba === undefined) continue;
      const chipBg = new Style({ bgcolor: ColorSpec.fromRgba(rgba) });
      const labelStyle = key === state.paletteKey
        ? new Style({ bold: true })
        : dimStyle;
      const label = ` ${key}`;
      const chip = "  ";
      const cellWidth = chip.length + label.length + 2;
      if (col + cellWidth > maxCol) {
        segs.push(new Segment("\n"));
        col = 0;
      }
      segs.push(new Segment(chip, chipBg));
      segs.push(new Segment(label, labelStyle));
      segs.push(new Segment("  "));
      col += cellWidth;
    }
    return segs;
  },
});

// Preview area: a small assortment of Panels exercising every category.
// Re-constructed per render so it can read state-derived Panel options
// (borderStyle, titleStyle) — Panels are construction-time renderables.
const previewItem = new StaticItem({
  id: "static-preview",
  render: (opts) => {
    const borderStyle = state.styleFor("borders");
    const titleStyle = state.styleFor("titles");
    const helloPanel = new Panel(
      "Plain text content inside a panel. Useful for evaluating border\n" +
      "and title color choices in isolation from interactive widgets.",
      { title: "Hello", borderStyle, titleStyle, width: Math.min(72, opts.maxWidth) },
    );
    const arrowsPanel = new Panel(tiArrows, {
      title: "scroll: arrows",
      borderStyle,
      titleStyle,
      width: Math.min(72, opts.maxWidth),
    });
    const indicesPanel = new Panel(tiIndices, {
      title: "scroll: indices",
      borderStyle,
      titleStyle,
      bottomRightAccessory: () => tiIndices.scrollIndicatorText,
      width: Math.min(72, opts.maxWidth),
    });

    const collect = (r: Renderable): Segment[] => [...r.render({ ...opts, maxWidth: Math.min(72, opts.maxWidth) })];
    const out: Segment[] = [];
    out.push(...collect(helloPanel));
    out.push(...collect(new Rule(undefined, { style: dimStyle })));
    out.push(...collect(arrowsPanel));
    out.push(...collect(new Rule(undefined, { style: dimStyle })));
    out.push(...collect(indicesPanel));
    return out;
  },
});

const footerItem = new StaticItem({
  id: "static-footer",
  render: () => [
    new Segment("Tab/Shift+Tab navigate · Enter to open dropdown · Esc closes · Ctrl+C exits", dimStyle),
  ],
});

// ─── Mount layout ─────────────────────────────────────────────────────────

const fm = new DefaultFocusManager();
const screen = new DefaultScreen({ focusManager: fm, out: process.stdout });

// [LAW:single-enforcer] EventRouter owns stdin → KeyEvent / WidgetMouseEvent
// parsing, raw-mode and mouse-tracking lifecycle, the three-stage key
// dispatch chain (high → focused widget → normal), and the topmost-hit
// click dispatch.
const router = new EventRouter({
  screen,
  input: process.stdin,
  output: process.stdout,
});

const mountList: MountEntry[] = [
  headerItem,
  spacer("sp-0"),
  staticLabel("Category:"),
  { widget: catDD, placement: { kind: "inline" } },
  staticLabel("Theme:"),
  { widget: themeDD, placement: { kind: "inline" } },
  staticLabel("Palette key:"),
  { widget: keyDD, placement: { kind: "inline" } },
  spacer("sp-1"),
  selectionItem,
  spacer("sp-2"),
  swatchesItem,
  spacer("sp-3"),
  previewItem,
  spacer("sp-4"),
  footerItem,
];

// ─── Input handling ───────────────────────────────────────────────────────

// Ctrl+C is the only key this demo overrides; everything else flows through
// the router's chain (focused widget → FocusManager Tab traversal). High
// priority so it beats whichever widget has focus.
router.onKey((event) => {
  if (event.ctrl && event.key === "c") { shutdown(); event.stop(); }
}, { priority: "high" });

// Mouse_up → focus the topmost focusable widget under the cursor. The
// router already delivers the click to the topmost mounted widget and
// updates hover via each widget's setHovered fast-path; this hook covers
// only the focus transfer, which is application policy.
router.onMouse((event) => {
  if (event.type !== "mouse_up") return;
  const hit = focusableAt(event.x, event.y);
  if (hit) fm.focus(hit);
});

function focusableAt(x: number, y: number): InteractiveWidget | null {
  for (let i = focusTargets.length - 1; i >= 0; i--) {
    const w = focusTargets[i]!;
    if (w.containsPoint(x, y)) return w;
  }
  return null;
}

// ─── Lifecycle ────────────────────────────────────────────────────────────

function startup(): void {
  if (!process.stdin.isTTY) {
    process.stderr.write("Error: rich-theme-designer requires an interactive terminal.\n");
    process.exit(1);
  }
  // Raw mode + mouse tracking + stdin parsing are owned by EventRouter.start().
  process.stdout.write("\x1b[?1049h");
  process.stdout.write("\x1b[H");

  screen.mount(...mountList);
  startThemeAutorun();
  startStyleAutorun();
  screen.start();
  router.start();
}

function shutdown(): void {
  router.stop();
  if (disposeTheme) disposeTheme();
  if (disposeStyle) disposeStyle();
  screen.stop();
  process.stdout.write("\x1b[?1049l");
  process.stdout.write("\x1b[1;36mGoodbye!\x1b[0m\n");
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

startup();
