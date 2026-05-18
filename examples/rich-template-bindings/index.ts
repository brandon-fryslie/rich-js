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
  EventRouter,
  DefaultScreen,
  DefaultFocusManager,
  StaticItem,
  TextInput,
  Segment,
  type MountEntry,
  type Renderable,
  type RenderOptions,
} from "../../src/index.js";
import type { WrapStrategy } from "../../src/widgets/text-input.js";
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
import { PaletteResolver } from "../../src/themes/paletteResolver.js";
import type { TerminalTheme } from "../../src/core/color.js";
import {
  richTextFuncs,
  paletteFuncs,
  renderTemplate,
} from "../../src/template-bindings/index.js";
import { makeAutoObservable, autorun, runInAction } from "mobx";

// ─── Engines ───────────────────────────────────────────────────────────────
//
// Every scene now uses palette-aware engines (palette/auto/paletteOver are
// pervasive in the redesigned demo), so the plain `richTextFuncs()`-only
// engine that the old per-attribute sections used has been retired.

function makeEngine(theme: TerminalTheme): Engine<RichText> {
  return createEngine<RichText>({
    fromString: (s) => new RichText(s),
    toString: (rt) => rt.plain,
    funcs: {
      ...richTextFuncs(),
      ...paletteFuncs(new PaletteResolver(theme.palette)),
    },
  });
}

const gruvboxEngine = makeEngine(GRUVBOX);
const tokyoEngine   = makeEngine(TOKYO_NIGHT);

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
  if (line.length === 0) return [{ content: "", start: 0 }];

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

  const rows: { content: string; start: number }[] = [];
  let buf = "";
  let bufStart = -1;
  let isFirst = true;

  const emitBuf = (): void => {
    rows.push({ content: buf, start: bufStart });
    isFirst = false;
    buf = "";
    bufStart = -1;
  };

  const placeOverflow = (text: string, textStart: number): void => {
    const isTag = text.startsWith("{{") && text.endsWith("}}");
    let p = 0;
    while (p < text.length) {
      const cap = isFirst ? firstWidth : continuationWidth;
      const remaining = text.length - p;
      let take: number;
      if (remaining <= cap) take = remaining;
      else if (isTag) take = cap;
      else {
        const chunk = text.slice(p, p + cap);
        const lastSpace = chunk.lastIndexOf(" ");
        take = lastSpace > 0 ? lastSpace + 1 : cap;
      }
      rows.push({ content: text.slice(p, p + take), start: textStart + p });
      isFirst = false;
      p += take;
    }
  };

  for (const atom of atoms) {
    const cap = isFirst ? firstWidth : continuationWidth;
    if (buf === "") {
      if (atom.text.length <= cap) {
        buf = atom.text;
        bufStart = atom.start;
      } else placeOverflow(atom.text, atom.start);
    } else if (buf.length + atom.text.length <= cap) {
      buf += atom.text;
    } else {
      emitBuf();
      if (atom.text.length <= continuationWidth) {
        buf = atom.text;
        bufStart = atom.start;
      } else placeOverflow(atom.text, atom.start);
    }
  }
  if (buf !== "") emitBuf();
  return rows.length === 0 ? [{ content: "", start: 0 }] : rows;
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
// Two synthetic "commits" share five `$style` definitions. The user can
// recolour all SHAs by editing `$sha` once; the same goes for `$when`,
// `$branch`, `$hot`, `$linkfx`.

const PUSH_TMPL =
`{{- $sha    := "#7c7c7c" -}}
{{- $when   := "italic dim" -}}
{{- $branch := "italic on #2d2d2d bold" -}}
{{- $hot    := "underline #00d9ff bold" -}}
{{- $linkfx := "underline cyan" -}}
{{ "abc1234" | style $sha }}  {{ "2026-05-13 21:42" | style $when }}  {{ "bmf" | primary | bold }}
  {{ " feat/sunrise " | style $branch }} → {{ "rework demo into three scenes" | accent }}
  {{ "ci " | dim }}{{ "✓ 1458 passed" | success }}  ·  {{ "△ 1 flaky" | palette "warning-muted" }}  ·  {{ "open run" | style $linkfx | link "https://example.com/run/42" }}
  {{ "deploy " | dim }}{{ "preview.app/sunrise" | style $hot }}
{{ "e8c19d2" | style $sha }}  {{ "2026-05-13 21:38" | style $when }}  {{ "alice" | primary | bold }}
  {{ " feat/measurements " | style $branch }} → {{ "tighten widget measure() contract" | accent }}
  {{ "more" | style $linkfx | link "https://example.com/run/41" }}`;

const pushRow = makeDemoRow("edit any $var → every reference updates", PUSH_TMPL, tokyoEngine);

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
// One reusable `$bg` participates in both `auto $bg` (contrast pick) and
// `on $bg` (painted background) — edit it once, both shift consistently.
// The same template source renders once per theme below.

const NOTICE_TMPL =
`{{- $bg     := "#1a1a2e" -}}
{{- $badge  := "bold" -}}
{{- $linkfx := "underline" -}}
{{ " ⚠ HEADS UP " | auto $bg | on $bg }}  {{ "deploy paused" | warning | style $badge }}  {{ "30s ago" | dim }}
{{ "  retries exhausted — " | palette "warning-muted" }}{{ "see incident" | accent | style $linkfx | link "https://example.com/incident/8" }}`;

const noticeRow = makeDemoRow("edit $bg → contrast + bg shift together", NOTICE_TMPL, GALLERY_THEMES[0]![1]);

const themeGridItem = new StaticItem({
  id: uid("theme-grid"),
  render: (opts) => {
    const tmpl = noticeRow.input.value;
    const swatchTmpl =
      `{{ "██" | primary }}{{ "██" | accent }}{{ "██" | success }}{{ "██" | warning }}{{ "██" | error }}`;
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

// ─── §3 — Ramps (palette modifiers, alpha, color forms) ────────────────────
// The "value" axis of the binding — palette modifiers (darken/lighten),
// alpha compositing, and the three constructor forms (hex / rgb / color N)
// — read as side-by-side ramps. Still pipe-first.

const RAMP_LUM =
`{{ "███" | palette "primary-darken-3" }}{{ "███" | palette "primary-darken-2" }}{{ "███" | palette "primary-darken-1" }}{{ "███" | primary }}{{ "███" | palette "primary-lighten-1" }}{{ "███" | palette "primary-lighten-2" }}{{ "███" | palette "primary-lighten-3" }}  primary  ↓3 ↓2 ↓1  ·  ↑1 ↑2 ↑3`;

const RAMP_ALPHA =
`{{- $bg := "#282828" -}}
{{ "█████" | paletteOver "accent 25%" $bg }}{{ "█████" | paletteOver "accent 50%" $bg }}{{ "█████" | paletteOver "accent 75%" $bg }}{{ "█████" | paletteOver "accent 100%" $bg }}  accent / #282828 @ 25 · 50 · 75 · 100`;

const RAMP_FORMS =
`{{ "hex #ff6b6b" | hex "#ff6b6b" }}  ·  {{ "rgb(255,107,107)" | rgb 255 107 107 }}  ·  {{ "color(203)" | color 203 }}  ·  {{ "bright_blue" | bright_blue }}`;

const secRamps = makeSection("Ramps — palette modifiers · alpha · color forms", [
  makeDemoRow("primary luminance (7-step)", RAMP_LUM,   gruvboxEngine),
  makeDemoRow("paletteOver alpha (× $bg)",  RAMP_ALPHA, gruvboxEngine),
  makeDemoRow("hex / rgb / color N / named", RAMP_FORMS, gruvboxEngine),
]);

// ─── Section list ──────────────────────────────────────────────────────────

const SECTIONS: Section[] = [secPush, secThemeMatrix, secRamps];

const SECTION_NAMES = ["Push", "Theme Matrix", "Ramps"];

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

// ─── Screen + router ───────────────────────────────────────────────────────

const fm     = new DefaultFocusManager();
const screen = new DefaultScreen({ focusManager: fm, out: process.stdout });
const router = new EventRouter({ screen, input: process.stdin, output: process.stdout });

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
  if (event.ctrl && event.key === "c") { shutdown(); event.stop(); return; }
  const n = SECTIONS.length;
  if (event.ctrl && event.key === "pageup")        { state.prev(n); focusFirst(state.sectionIdx); event.stop(); }
  else if (event.ctrl && event.key === "pagedown") { state.next(n); focusFirst(state.sectionIdx); event.stop(); }
}, { priority: "high" });

// ─── Lifecycle ─────────────────────────────────────────────────────────────

function shutdown(): void {
  unsubKey();
  disposeVisibility();
  router.stop();
  screen.stop();
  process.stdout.write("\x1b[?1049l");
  process.stdout.write("\x1b[1;36mGoodbye!\x1b[0m\n");
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

process.stdout.write("\x1b[?1049h");
process.stdout.write("\x1b[H");
screen.start();
router.start();
