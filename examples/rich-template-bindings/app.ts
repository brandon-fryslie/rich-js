/**
 * Template Bindings — Interactive TUI Demo
 *
 * Side-by-side textarea layout:
 *   left  — editable template box (3 content rows, wraps long templates,
 *            cursor tracked in 2D, border turns cyan when focused)
 *   right — live rendered output box, updates on every keystroke
 *
 * TextInputs are always invisible (visible=false, focusable=true).
 * Each combinedItem reads input.value / cursorPosition / focused (all MobX
 * observables) so Screen's autorun re-renders on every change.
 *
 * Ctrl+PageUp / Ctrl+PageDown — navigate sections
 *                  (Ctrl+P / Ctrl+N are reserved for cursor up/down inside
 *                  the editable templates, per readline conventions)
 * Tab / Shift+Tab  — cycle inputs
 * Ctrl+C           — exit
 */

import {
  RichText,
  Style,
  Rule,
  Panel,
  Layout,
  Padding,
  Segment,
  type Renderable,
  type RenderOptions,
  asCodePoint,
  asCellCol,
  cellLen,
  cellFit,
} from "../../src/index.js";
import {
  EventRouter,
  DefaultScreen,
  DefaultFocusManager,
  StaticItem,
  TextInput,
  charGreedyWrap,
  type MountEntry,
  type WrapStrategy,
  type WrapRow,
} from "../../src/widgets/index.js";
import type { TerminalHost } from "../../src/host/index.js";
import { createEngine, type Engine } from "@promptctl/go-template-js";
import {
  MONOKAI,
  NORD,
  GRUVBOX,
  DRACULA,
  TOKYO_NIGHT,
  FLEXOKI,
  CATPPUCCIN_MOCHA,
  CATPPUCCIN_LATTE,
  ROSE_PINE,
  ROSE_PINE_DAWN,
  SOLARIZED_DARK,
  SOLARIZED_LIGHT,
  ATOM_ONE_DARK,
} from "../../src/themes/terminalThemes.js";
import type { TerminalTheme } from "../../src/core/color.js";
import {
  richTextFuncs,
  createRichTextEngine,
  paletteFuncs,
  colorFuncs,
  renderTemplate,
} from "../../src/template-bindings/index.js";
import { makeAutoObservable, autorun, runInAction } from "mobx";

// ─── Engines ───────────────────────────────────────────────────────────────
//
// Two registrations, split by what needs a theme:
//
//   richTextFuncs()          — the colour sinks `fg`/`bg`, the palette-free
//                              colour math (`darken`, `mix`, `contrastOn`, the
//                              OKLCH axes…), text attributes, `link`.
//   paletteFuncs(getPalette) — the single function `color`, which turns a
//                              palette variable name into a `#RRGGBB` value.
//
// `paletteFuncs` takes a *getter*, not a palette: templates are parsed once and
// evaluated many times, so a captured palette would freeze a live theme picker
// to whatever was current at construction. Every engine here has a fixed theme,
// but the getter is the shape the API asks for and costs nothing.

function makeEngine(theme: TerminalTheme): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: {
      ...richTextFuncs(),
      ...paletteFuncs(() => theme.palette),
    },
  });
}

// A deliberately *sink-free* engine: `colorFuncs()` (the palette-free colour
// math) plus `color` — and nothing that can paint. Every expression it can
// evaluate therefore produces a colour *value*, which lands in the output as
// the literal `#RRGGBB` text it is. That is the point of §4 below: colours are
// ordinary values that flow through the template language, hold in `$vars`, and
// only become style when a sink (`fg`/`bg`) consumes them.

function makeCalculatorEngine(theme: TerminalTheme): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: {
      ...colorFuncs(),
      ...paletteFuncs(() => theme.palette),
    },
  });
}

const gruvboxEngine    = makeEngine(GRUVBOX);
const tokyoEngine      = makeEngine(TOKYO_NIGHT);
const gruvboxCalcEngine = makeCalculatorEngine(GRUVBOX);

// The third shape, and the one you reach for first: `createRichTextEngine()`
// is `makeEngine` minus the palette — `richTextFuncs()` wired to RichText in a
// single call, no `createEngine` boilerplate and no theme to thread. It paints
// and it does colour math; what it cannot do is resolve a palette variable,
// because `color` lives in `paletteFuncs`. Colours arrive as literals instead.
const themelessEngine = createRichTextEngine();

const GALLERY_THEMES: [string, Engine<RichText>][] = [
  ["GRUVBOX",          makeEngine(GRUVBOX)],
  ["DRACULA",          makeEngine(DRACULA)],
  ["NORD",             makeEngine(NORD)],
  ["TOKYO_NIGHT",      makeEngine(TOKYO_NIGHT)],
  ["CATPPUCCIN_MOCHA", makeEngine(CATPPUCCIN_MOCHA)],
  ["CATPPUCCIN_LATTE", makeEngine(CATPPUCCIN_LATTE)],
  ["ROSE_PINE",        makeEngine(ROSE_PINE)],
  ["ROSE_PINE_DAWN",   makeEngine(ROSE_PINE_DAWN)],
  ["SOLARIZED_DARK",   makeEngine(SOLARIZED_DARK)],
  ["SOLARIZED_LIGHT",  makeEngine(SOLARIZED_LIGHT)],
  ["MONOKAI",          makeEngine(MONOKAI)],
  ["FLEXOKI",          makeEngine(FLEXOKI)],
  ["ATOM_ONE_DARK",    makeEngine(ATOM_ONE_DARK)],
];

// ─── Styles ────────────────────────────────────────────────────────────────

const dimStyle      = Style.parse("dim");
const cyanStyle     = Style.parse("cyan");
const cyanBoldStyle = Style.parse("bold cyan");

// ─── State ─────────────────────────────────────────────────────────────────

class AppState {
  sectionIdx = 0;
  constructor() { makeAutoObservable(this); }
  prev(n: number): void { this.sectionIdx = (this.sectionIdx + n - 1) % n; }
  next(n: number): void { this.sectionIdx = (this.sectionIdx + 1) % n; }
}
const state = new AppState();

// ─── Utilities ─────────────────────────────────────────────────────────────

let _uid = 0;
const uid = (p: string): string => `${p}-${_uid++}`;

function makeSpacerItem(): StaticItem {
  return new StaticItem({ id: uid("sp"), render: () => [new Segment("")] });
}

// ─── Template-atom wrap strategy ────────────────────────────────────────────
//
// `WrapStrategy` that breaks at `{{ ... }}` atom boundaries instead of mid-
// character. Atoms wider than the budget fall back to char-break (tags) or
// last-space (text). The widget consumes this through its `wrap` option;
// everything below "what to break on" lives in the widget itself.

const templateAtomWrap: WrapStrategy = (line, { firstWidth, continuationWidth }) => {
  if (line.length === 0) return [{ content: "", start: asCodePoint(0) }];

  // Tokenize: each {{...}} is one atom; text runs between are atoms.
  const atoms: { text: string; start: number }[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "{" && line[i + 1] === "{") {
      let j = i + 2;
      while (j < line.length - 1 && !(line[j] === "}" && line[j + 1] === "}")) j++;
      const end = j < line.length - 1 ? j + 2 : line.length;
      atoms.push({ text: line.slice(i, end), start: i });
      i = end;
    } else {
      let j = i;
      while (j < line.length && !(line[j] === "{" && line[j + 1] === "{")) j++;
      atoms.push({ text: line.slice(i, j), start: i });
      i = j;
    }
  }

  // Coalesce a pure-whitespace leading atom with the atom that follows so
  // the wrap doesn't emit a row whose content is invisible. Mid-line
  // whitespace runs (e.g. ` → `) are left alone — only the leading edge
  // is special, because that's where indentation lives.
  if (atoms.length >= 2 && /^\s+$/.test(atoms[0]!.text)) {
    atoms[0] = { text: atoms[0]!.text + atoms[1]!.text, start: atoms[0]!.start };
    atoms.splice(1, 1);
  }

  const rows: WrapRow[] = [];
  let buf = "";
  let bufStart = -1;
  let isFirst = true;

  const emitBuf = (): void => {
    rows.push({ content: buf, start: asCodePoint(bufStart) });
    isFirst = false;
    buf = "";
    bufStart = -1;
  };

  const placeOverflow = (text: string, textStart: number): void => {
    // A tag has no break points of its own — every position inside `{{ ... }}`
    // is equally bad — so "break wherever it stops fitting" is not a fallback
    // here, it is the right answer. That is exactly the library's built-in
    // strategy, so use it rather than restating it.
    if (text.startsWith("{{") && text.endsWith("}}")) {
      for (const row of charGreedyWrap(text, {
        firstWidth: asCellCol(isFirst ? firstWidth : continuationWidth),
        continuationWidth,
      })) {
        rows.push({ content: row.content, start: asCodePoint(textStart + row.start) });
        isFirst = false;
      }
      return;
    }
    // Text runs do have break points, so retreat to the last space in the
    // chunk char-greedy would have taken.
    let p = 0;
    while (p < text.length) {
      const cap = asCellCol(isFirst ? firstWidth : continuationWidth);
      const slice = text.slice(p);
      if (cellLen(slice) === 0) break;
      let chunk = cellFit(slice, cap);
      if (chunk.length === 0) chunk = [...slice][0]!; // force-take first code point
      const lastSpace = chunk.lastIndexOf(" ");
      if (lastSpace > 0) chunk = chunk.slice(0, lastSpace + 1);
      rows.push({ content: chunk, start: asCodePoint(textStart + p) });
      isFirst = false;
      p += chunk.length;
    }
  };

  for (const atom of atoms) {
    const cap = isFirst ? firstWidth : continuationWidth;
    if (buf === "") {
      if (cellLen(atom.text) <= cap) {
        buf = atom.text;
        bufStart = atom.start;
      } else placeOverflow(atom.text, atom.start);
    } else if (cellLen(buf) + cellLen(atom.text) <= cap) {
      buf += atom.text;
    } else {
      emitBuf();
      if (cellLen(atom.text) <= continuationWidth) {
        buf = atom.text;
        bufStart = atom.start;
      } else placeOverflow(atom.text, atom.start);
    }
  }
  if (buf !== "") emitBuf();
  return rows.length === 0 ? [{ content: "", start: asCodePoint(0) }] : rows;
};

// ─── Two-column row composition ─────────────────────────────────────────────
//
// `Padding([0,0,0,2])` for the screen-edge indent, `Layout.splitRow` for the
// multi-line side-by-side merge, `Panel` for each titled box. Each row is
// reconstructed every frame so the left Panel's border can track
// `input.focused` reactively via the StaticItem render callback.
//
// (Not `Columns`: that one is a single-row chip grid — it intentionally
// emits only the first visual line of each item, so it doesn't compose with
// multi-line Panel content. `Layout` is the right primitive here, with
// `_renderRow` doing the line-by-line merge.)

function buildRowSegments(
  input: TextInput,
  label: string,
  engine: Engine<RichText>,
  options: RenderOptions,
): Segment[] {
  const outputRenderable: Renderable = {
    render: (opts) => renderTemplate(engine, input.value, {}, { maxWidth: opts.maxWidth }),
  };
  const borderStyle = input.focused ? cyanStyle : dimStyle;

  const row = new Layout();
  row.splitRow(
    new Layout(new Panel(input, {
      title: label,
      borderStyle,
      bottomRightAccessory: () => input.scrollIndicatorText,
    })),
    new Layout(new Panel(outputRenderable, { title: "output", borderStyle: dimStyle })),
  );
  return [...new Padding(row, [0, 0, 0, 2]).render(options)];
}

// ─── Demo row ──────────────────────────────────────────────────────────────

interface DemoRow {
  combinedItem: StaticItem;
  input: TextInput;
  spacer: StaticItem;
}

function makeDemoRow(label: string, template: string, engine: Engine<RichText>): DemoRow {
  const input = new TextInput({
    value: template,
    id: uid("ti"),
    multiline: true,
    wrap: templateAtomWrap,
    minRows: 1,
    maxRows: 10,
    scrollIndicator: "indices",
  });
  runInAction(() => { input.visible = false; });

  const combinedItem = new StaticItem({
    id: uid("row"),
    render: (opts) => buildRowSegments(input, label, engine, opts),
  });

  return { combinedItem, input, spacer: makeSpacerItem() };
}

// ─── Section ───────────────────────────────────────────────────────────────

interface Section {
  rows: DemoRow[];
  allInteractiveWidgets: (StaticItem | TextInput)[];
  mountEntries: MountEntry[];
}

function makeSection(title: string, rows: DemoRow[], extraVisibleItems: StaticItem[] = []): Section {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) => new Rule(title, { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer  = makeSpacerItem();
  const trailingSpacer = makeSpacerItem();

  const visibleItems: StaticItem[] = [
    headerItem, headerSpacer,
    ...rows.flatMap((r) => [r.combinedItem, r.spacer]),
    ...extraVisibleItems,
    trailingSpacer,
  ];

  return {
    rows,
    allInteractiveWidgets: [...visibleItems, ...rows.map((r) => r.input)],
    mountEntries: [
      headerItem, headerSpacer,
      ...rows.flatMap((r): MountEntry[] => [r.combinedItem, r.spacer, r.input]),
      ...extraVisibleItems,
      trailingSpacer,
    ] as MountEntry[],
  };
}

// ─── Section definitions ───────────────────────────────────────────────────
//
// Three pipe-first / reuse-first scenes. Every styled span uses pipe form
// ("x | a | b"); composition reads left-to-right. Reusable styles are named
// once at the top of each template and applied many times in the body —
// edit one `$var` and every site downstream updates.

// ─── §1 — Push (commit-stream Panel) ───────────────────────────────────────
// Two synthetic "commits" share eight `$` definitions — five style specs and
// three colours. The user can recolour every author name by editing `$who`
// once, exactly the way `$sha` governs every SHA. Colours name-once/use-many
// like any other value because `color` *returns* one instead of applying it.

const PUSH_TMPL =
`{{- $sha    := "#7c7c7c" -}}
{{- $when   := "italic dim" -}}
{{- $branch := "italic on #2d2d2d bold" -}}
{{- $hot    := "underline #00d9ff bold" -}}
{{- $linkfx := "underline cyan" -}}
{{- $who    := color "primary" -}}
{{- $topic  := color "accent" -}}
{{- $flaky  := color "warning-muted" -}}
{{ "abc1234" | style $sha }}  {{ "2026-05-13 21:42" | style $when }}  {{ "bmf" | fg $who | bold }}
  {{ " feat/sunrise " | style $branch }} → {{ "rework demo into three scenes" | fg $topic }}
  {{ "ci " | dim }}{{ "✓ 1458 passed" | fg (color "success") }}  ·  {{ "△ 1 flaky" | fg $flaky }}  ·  {{ "open run" | style $linkfx | link "https://example.com/run/42" }}
  {{ "deploy " | dim }}{{ "preview.app/sunrise" | style $hot }}
{{ "e8c19d2" | style $sha }}  {{ "2026-05-13 21:38" | style $when }}  {{ "alice" | fg $who | bold }}
  {{ " feat/measurements " | style $branch }} → {{ "tighten widget measure() contract" | fg $topic }}
  {{ "more" | style $linkfx | link "https://example.com/run/41" }}`;

const pushRow = makeDemoRow("edit any $var (spec or colour) → every reference updates", PUSH_TMPL, tokyoEngine);

const pushPanelItem = new StaticItem({
  id: uid("push-panel"),
  render: (opts) => {
    const tmpl = pushRow.input.value;  // MobX subscription
    const bodyRenderable = { render: () => renderTemplate(tokyoEngine, tmpl) };
    const title = new RichText(" git push ", { style: cyanBoldStyle, end: "" });
    return new Panel(bodyRenderable, { borderStyle: cyanBoldStyle, title, padding: [1, 2] }).render(opts);
  },
});

const pushPanelLabel = new StaticItem({
  id: uid("push-lbl"),
  render: () => [new Segment("  composed into Panel", dimStyle)],
});

const secPush = makeSection(
  "Push — pipes + reusable $style at scale",
  [pushRow],
  [pushPanelLabel, pushPanelItem],
);

// ─── §2 — Theme matrix (same notice, every theme) ──────────────────────────
// One reusable `$bg` feeds both `contrastOn $bg` (pick readable ink for it)
// and `bg $bg` (paint it) — edit it once, both shift consistently. That pairing
// is only expressible because `contrastOn` hands back a colour instead of
// consuming it. The same template source renders once per theme below.

const NOTICE_TMPL =
`{{- $bg     := "#1a1a2e" -}}
{{- $badge  := "bold" -}}
{{- $linkfx := "underline" -}}
{{ " ⚠ HEADS UP " | fg (contrastOn $bg) | bg $bg }}  {{ "deploy paused" | fg (color "warning") | style $badge }}  {{ "30s ago" | dim }}
{{ "  retries exhausted — " | fg (color "warning-muted") }}{{ "see incident" | fg (color "accent") | style $linkfx | link "https://example.com/incident/8" }}`;

const noticeRow = makeDemoRow("edit $bg → contrast + bg shift together", NOTICE_TMPL, GALLERY_THEMES[0]![1]);

const themeGridItem = new StaticItem({
  id: uid("theme-grid"),
  render: (opts) => {
    const tmpl = noticeRow.input.value;
    const swatchTmpl =
      `{{ "██" | fg (color "primary") }}{{ "██" | fg (color "accent") }}{{ "██" | fg (color "success") }}{{ "██" | fg (color "warning") }}{{ "██" | fg (color "error") }}`;
    const segs: Segment[] = [];
    for (let i = 0; i < GALLERY_THEMES.length; i++) {
      const [name, engine] = GALLERY_THEMES[i]!;
      segs.push(new Segment(`  ${name.padEnd(22)}`, dimStyle));
      segs.push(...Segment.adjustLineLength(renderTemplate(engine, swatchTmpl), 14));
      segs.push(new Segment("  "));
      segs.push(...Segment.adjustLineLength(renderTemplate(engine, tmpl), opts.maxWidth - 42));
      if (i < GALLERY_THEMES.length - 1) segs.push(new Segment("\n"));
    }
    return segs;
  },
});

const secThemeMatrix = makeSection(
  "Theme matrix — same template, every theme",
  [noticeRow],
  [themeGridItem],
);

// ─── §3 — Ramps (lightness, mixing, the colour-spec vocabulary) ────────────
// The "value" axis of the binding. A ramp used to need one spec-grammar
// production per step (`"primary-darken-3"`, `"accent 50%"`); now each step is
// the same function applied with a different number, so the ramp is a fold over
// data rather than a list of hand-spelled strings.

const RAMP_LUM =
`{{- $p := color "primary" -}}
{{ "███" | fg (darken $p 3) }}{{ "███" | fg (darken $p 2) }}{{ "███" | fg (darken $p 1) }}{{ "███" | fg $p }}{{ "███" | fg (lighten $p 1) }}{{ "███" | fg (lighten $p 2) }}{{ "███" | fg (lighten $p 3) }}  primary  ↓3 ↓2 ↓1  ·  ↑1 ↑2 ↑3`;

const RAMP_MIX =
`{{- $bg := "#282828" -}}
{{- $a  := color "accent" -}}
{{ "█████" | fg (mix $bg $a 25) }}{{ "█████" | fg (mix $bg $a 50) }}{{ "█████" | fg (mix $bg $a 75) }}{{ "█████" | fg (mix $bg $a 100) }}  mix $bg → accent @ 25 · 50 · 75 · 100`;

// `fg`/`bg` accept the whole `ColorSpec.parse` vocabulary, not just the hex the
// colour math produces: `"red"` and `"color(203)"` are *symbolic* colours the
// terminal resolves against its own theme, so they can be painted but not
// darkened. One sink, every colour that can mean something in a terminal.
const RAMP_FORMS =
`{{ "hex #ff6b6b" | fg "#ff6b6b" }}  ·  {{ "rgb(255,107,107)" | fg "rgb(255,107,107)" }}  ·  {{ "color(203)" | fg "color(203)" }}  ·  {{ "bright_blue" | fg "bright_blue" }}`;

const secRamps = makeSection("Ramps — lightness · mixing · the fg colour vocabulary", [
  makeDemoRow("primary luminance (7-step)",  RAMP_LUM,   gruvboxEngine),
  makeDemoRow("mix toward accent (× $bg)",   RAMP_MIX,   gruvboxEngine),
  makeDemoRow("hex / rgb() / color(N) / named", RAMP_FORMS, gruvboxEngine),
]);

// ─── §4 — Colour values (compute → name → paint) ───────────────────────────
//
// The redesign in one scene. `color` and everything in `colorFuncs()` take
// colours and return colours, carried across the template seam as `#RRGGBB`
// strings — so a colour holds in a `$var`, prints, and only becomes *style*
// when a sink (`fg`/`bg`) consumes it.
//
// The first row proves it by removing the sinks entirely: `gruvboxCalcEngine`
// registers `colorFuncs()` + `color` and nothing that can paint, so every
// expression lands in the output as the literal hex it evaluates to. The two
// rows below it feed those same expressions to a sink.

const CALC_TMPL =
`{{- $p := color "primary" -}}
color "primary"                  → {{ $p }}
darken $p 3                      → {{ darken $p 3 }}
lighten $p 2                     → {{ lighten $p 2 }}
mix (color "background") $p 50   → {{ mix (color "background") $p 50 }}
contrastOn (color "surface")     → {{ contrastOn (color "surface") }}
readableOn "#4b6a8a" $p          → {{ readableOn "#4b6a8a" $p }}
shiftHue $p 120                  → {{ shiftHue $p 120 }}
scaleChroma $p 0.2               → {{ scaleChroma $p 0.2 }}
scaleLightness $p 1.25           → {{ scaleLightness $p 1.25 }}
shiftLightness $p -0.08          → {{ shiftLightness $p -0.08 }}`;

// Every swatch picks its own ink with `contrastOn`, so a computed background
// can never end up with unreadable text on it — the old `"auto"` spec form,
// now an ordinary call whose result you can also hold in a `$var`.
const SWATCH_TMPL =
`{{- $p := color "primary" -}}
{{- $d := darken $p 3 -}}
{{- $l := lighten $p 2 -}}
{{- $h := shiftHue $p 120 -}}
{{- $g := scaleChroma $p 0.2 -}}
{{ " darken 3 " | bg $d | fg (contrastOn $d) }}{{ " base " | bg $p | fg (contrastOn $p) }}{{ " lighten 2 " | bg $l | fg (contrastOn $l) }}{{ " hue +120 " | bg $h | fg (contrastOn $h) }}{{ " chroma ×0.2 " | bg $g | fg (contrastOn $g) }}`;

// `contrastOn` maximizes legibility (black or white); `readableOn` keeps the
// colour recognizably itself and only slides its OKLCH lightness until it
// clears WCAG AA — so the "after" swatch is still blue, just a legible blue.
const READABLE_TMPL =
`{{- $bg  := color "surface" -}}
{{- $raw := "#4b6a8a" -}}
{{ "  raw #4b6a8a on surface  " | bg $bg | fg $raw }}  {{ "  readableOn → clears AA  " | bg $bg | fg (readableOn $raw $bg) }}`;

// Same colour math, same sinks, no palette: every colour is a literal, and
// `contrastOn` still picks the ink. This is what `createRichTextEngine()` gets
// you in one call.
const NO_PALETTE_TMPL =
`{{- $base := "#8f5fd0" -}}
{{ "  base  " | bg $base | fg (contrastOn $base) }}{{ "  darken 3  " | bg (darken $base 3) | fg (contrastOn (darken $base 3)) }}{{ "  hue +120  " | bg (shiftHue $base 120) | fg (contrastOn (shiftHue $base 120)) }}`;

const secColorValues = makeSection("Colour values — compute · name · paint", [
  makeDemoRow("no sinks registered → colours print as hex", CALC_TMPL, gruvboxCalcEngine),
  makeDemoRow("same expressions, painted (contrastOn ink)", SWATCH_TMPL, gruvboxEngine),
  makeDemoRow("contrastOn vs readableOn",                   READABLE_TMPL, gruvboxEngine),
  makeDemoRow("createRichTextEngine() — no palette, literals only",
                                                            NO_PALETTE_TMPL, themelessEngine),
]);

// ─── Section list ──────────────────────────────────────────────────────────

const SECTIONS: Section[] = [secPush, secThemeMatrix, secRamps, secColorValues];

const SECTION_NAMES = ["Push", "Theme Matrix", "Ramps", "Colour Values"];

// ─── Always-visible header ─────────────────────────────────────────────────

const appTitleItem = new StaticItem({
  id: "app-title",
  render: () => {
    const idx = state.sectionIdx;
    return [
      new Segment("  @promptctl/rich-js · Template Bindings", Style.parse("bold")),
      new Segment(`   §${idx + 1}/${SECTIONS.length}: ${SECTION_NAMES[idx] ?? ""}`, cyanBoldStyle),
    ];
  },
});

const navHintItem = new StaticItem({
  id: "nav-hint",
  render: () => [new Segment("  Ctrl+PgUp/PgDn: sections  ·  Tab: focus  ·  arrows/Ctrl+A·E·W·U·K·etc: edit  ·  Ctrl+C: exit", dimStyle)],
});

const headerSpacer = makeSpacerItem();

// ─── Demo entry ────────────────────────────────────────────────────────────
//
// [LAW:dataflow-not-control-flow] runDemo takes a TerminalHost as a value;
// node bootstrap passes NodeTerminalHost, browser bootstrap passes
// BrowserTerminalHost. Same code path either way.

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

export function runDemo(host: TerminalHost, options?: RunDemoOptions): DemoHandle {
  const fm     = new DefaultFocusManager();
  const screen = new DefaultScreen({ focusManager: fm, host });
  const router = new EventRouter({ screen, host });

// ─── Mount list ────────────────────────────────────────────────────────────

screen.mount(appTitleItem, navHintItem, headerSpacer, ...SECTIONS.flatMap((s) => s.mountEntries));

// ─── Visibility + focus ────────────────────────────────────────────────────

const disposeVisibility = autorun(() => {
  const idx = state.sectionIdx;
  runInAction(() => {
    SECTIONS.forEach((sec, si) => {
      const active = si === idx;
      for (const w of sec.allInteractiveWidgets) {
        if (w instanceof TextInput) {
          (w as TextInput).disabled = !active;
          // TextInputs are always invisible; only disabled changes per section.
        } else {
          w.visible = active;
        }
      }
    });
    const firstInput = SECTIONS[idx]?.rows[0]?.input;
    if (firstInput) fm.focus(firstInput);
  });
});

// ─── Key handling ──────────────────────────────────────────────────────────

function focusFirst(idx: number): void {
  const row = SECTIONS[idx]?.rows[0];
  if (row && !row.input.disabled) fm.focus(row.input);
}

// Section nav uses Ctrl+PageUp / Ctrl+PageDown rather than Ctrl+P/Ctrl+N —
// the latter are readline line-motion bindings that TextInput now consumes
// for cursor up/down inside the editable templates. PageUp/PageDown have
// no readline meaning, so the two layers don't fight over the same keys.
// High-priority: these run BEFORE the focused widget, so a focused
// TextInput can't accidentally swallow Ctrl+C or our section-nav chords.
// Stopping the event prevents the focused widget from also reacting to
// the same press.
const unsubKey = router.onKey((event) => {
  if (event.ctrl && event.key === "c") {
    shutdown();
    options?.onShutdown?.();
    event.stop();
    return;
  }
  const n = SECTIONS.length;
  if (event.ctrl && event.key === "pageup")        { state.prev(n); focusFirst(state.sectionIdx); event.stop(); }
  else if (event.ctrl && event.key === "pagedown") { state.next(n); focusFirst(state.sectionIdx); event.stop(); }
}, { priority: "high" });

// ─── Lifecycle ─────────────────────────────────────────────────────────────

  let stopped = false;
  function shutdown(): void {
    if (stopped) return;
    stopped = true;
    unsubKey();
    disposeVisibility();
    router.stop();
    screen.stop();
    host.write("\x1b[?1049l\x1b[1;36mGoodbye!\x1b[0m\n");
  }

  // [LAW:single-enforcer] Alt-screen state has exactly one restore site
  // (`shutdown()`). If `screen.start()` / `router.start()` throws after the
  // alt-screen entry, the catch routes through the same `shutdown()` so
  // the restore sequence runs and the terminal is never left in the
  // alternate buffer.
  try {
    host.write("\x1b[?1049h\x1b[H");
    screen.start();
    router.start();
  } catch (err) {
    shutdown();
    throw err;
  }

  return { stop: shutdown };
}
