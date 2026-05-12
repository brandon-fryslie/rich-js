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
 * Ctrl+N / Ctrl+P — navigate sections
 * Tab / Shift+Tab  — cycle inputs
 * Ctrl+C           — exit
 */

import {
  RichText,
  Style,
  Rule,
  Panel,
  EventRouter,
  DefaultScreen,
  DefaultFocusManager,
  StaticItem,
  TextInput,
  Segment,
  type MountEntry,
} from "../../src/index.js";
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
  createRichTextEngine,
} from "../../src/template-bindings/index.js";
import { makeAutoObservable, autorun, runInAction } from "mobx";

// ─── Engines ───────────────────────────────────────────────────────────────

const styleEngine = createRichTextEngine();

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

// Soft-newline syntax: any run of whitespace containing a newline collapses
// to a single space before reaching the engine. Lets template authors split
// long expressions across lines for readability without polluting the output.
// For a *real* newline in output, use a string literal: {{ "\n" }}.
function exec(engine: Engine<RichText>, tmpl: string): RichText {
  const flat = tmpl.replace(/\s*\n\s*/g, " ");
  const frags = engine.compile(flat)({});
  const out = new RichText("", { end: "" });
  for (const f of frags) {
    const start = out.length;
    out.append(f.plain);
    if (!f.style.isNull) out.stylize(f.style, start, out.length);
    for (const span of f.spans) {
      out.stylize(span.style, start + span.start, start + span.end);
    }
  }
  return out;
}

const draculaEngine = makeEngine(DRACULA);
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
const redStyle      = Style.parse("red dim");
const cursorStyle   = Style.parse("reverse");

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

// Render template to Segment[]. Returns dim error on failure.
function renderTmpl(engine: Engine<RichText>, tmpl: string): Segment[] {
  try {
    const result = exec(engine, tmpl);
    return Array.from(result.render({ maxWidth: 400, isTerminal: true, encoding: "utf-8" }));
  } catch (e) {
    return [new Segment(`[error: ${String(e).slice(0, 60)}]`, redStyle)];
  }
}

// ─── Two-column textarea layout ─────────────────────────────────────────────
//
// Left:  editable textarea. `\n` chars in the value are logical line breaks
//        (rendered as visual rows but stripped before the engine renders).
//        Lines that exceed `lc` cells wrap at `{{ }}` action boundaries —
//        never mid-action — with continuation rows indented 2 spaces.
// Right: rendered output, clipped to exactly `rc` cells per row.
//
// Height adapts to the template's wrapped line count, clamped to
// [MIN_HEIGHT, MAX_HEIGHT]. No horizontal scrolling, ever.

const MIN_HEIGHT = 1;
const MAX_HEIGHT = 10;
const INDENT = "  ";

// One visual row in the textarea. `display` already includes the prefix indent;
// `start` is the position in the source template of the first content char
// (after the indent); `prefixLen` is how many cells the indent occupies.
interface VisualRow {
  display: string;
  start: number;
  prefixLen: number;
}

// Tokenize a logical line into atoms — each `{{ ... }}` action is one atom,
// each run of text between actions is one atom. Used as wrap boundaries.
function tokenize(line: string): { text: string; start: number }[] {
  const out: { text: string; start: number }[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === "{" && line[i + 1] === "{") {
      let j = i + 2;
      while (j < line.length - 1 && !(line[j] === "}" && line[j + 1] === "}")) j++;
      const end = j < line.length - 1 ? j + 2 : line.length;
      out.push({ text: line.slice(i, end), start: i });
      i = end;
    } else {
      let j = i;
      while (j < line.length && !(line[j] === "{" && line[j + 1] === "{")) j++;
      out.push({ text: line.slice(i, j), start: i });
      i = j;
    }
  }
  return out;
}

// Wrap text into visual rows. Splits on `\n` first (logical breaks); each
// logical line is then packed by atoms (tag-or-text) up to `width` cells.
// Continuations get a 2-space indent. Atoms wider than the available width
// fall back to hard-break (only relevant for unusually long URLs / strings).
function wrapText(text: string, width: number): VisualRow[] {
  const rows: VisualRow[] = [];
  const logical = text.split("\n");
  let cum = 0;

  for (let li = 0; li < logical.length; li++) {
    const line = logical[li]!;
    if (line.length === 0) {
      rows.push({ display: "", start: cum, prefixLen: 0 });
      cum += 1;
      continue;
    }

    const atoms = tokenize(line);
    let buf = "";
    let bufStart = -1;
    let onFirst = true;

    const emitBuf = (): void => {
      const prefix = onFirst ? "" : INDENT;
      rows.push({ display: prefix + buf, start: bufStart, prefixLen: prefix.length });
      onFirst = false;
      buf = "";
      bufStart = -1;
    };

    // Place an over-wide atom across multiple rows. Tags can only be
    // hard-char-broken (no clean inner boundary); text atoms are word-wrapped
    // at the last space within the available width.
    const placeOverflow = (atom: string, atomStart: number): void => {
      const isTag = atom.startsWith("{{") && atom.endsWith("}}");
      let p = 0;
      while (p < atom.length) {
        const prefix = onFirst ? "" : INDENT;
        const cap = width - prefix.length;
        const remaining = atom.length - p;
        let take: number;
        if (remaining <= cap) {
          take = remaining;
        } else if (isTag) {
          take = cap;
        } else {
          const chunk = atom.slice(p, p + cap);
          const lastSpace = chunk.lastIndexOf(" ");
          take = lastSpace > 0 ? lastSpace + 1 : cap;
        }
        rows.push({
          display: prefix + atom.slice(p, p + take),
          start: cum + atomStart + p,
          prefixLen: prefix.length,
        });
        onFirst = false;
        p += take;
      }
    };

    for (const atom of atoms) {
      const cap = onFirst ? width : width - INDENT.length;
      if (buf === "") {
        if (atom.text.length <= cap) {
          buf = atom.text;
          bufStart = cum + atom.start;
        } else {
          placeOverflow(atom.text, atom.start);
        }
      } else if (buf.length + atom.text.length <= cap) {
        buf += atom.text;
      } else {
        emitBuf();
        const cap2 = width - INDENT.length;
        if (atom.text.length <= cap2) {
          buf = atom.text;
          bufStart = cum + atom.start;
        } else {
          placeOverflow(atom.text, atom.start);
        }
      }
    }
    if (buf !== "") emitBuf();

    cum += line.length + 1; // +1 for the \n
  }

  if (rows.length === 0) rows.push({ display: "", start: 0, prefixLen: 0 });
  return rows;
}

function findCursor(rows: VisualRow[], pos: number): { row: number; col: number } {
  let row = 0;
  for (let i = rows.length - 1; i >= 0; i--) {
    if (rows[i]!.start <= pos) { row = i; break; }
  }
  const r = rows[row]!;
  return { row, col: r.prefixLen + (pos - r.start) };
}

function buildRowSegments(
  input: TextInput,
  label: string,
  engine: Engine<RichText>,
  totalW: number,
): Segment[] {
  const leftOuter = Math.floor(totalW / 2);
  const lc = Math.max(8, leftOuter - 6);
  const rc = Math.max(8, totalW - leftOuter - 2 - 4);

  const tmpl = input.value;
  const pos = input.cursorPosition;
  const focused = input.focused;

  const rows = wrapText(tmpl, lc);
  let { row: curLine, col: curCol } = findCursor(rows, pos);

  // Cursor past the right edge → slide onto a fresh empty row.
  if (curCol >= lc) {
    rows.push({ display: "", start: pos, prefixLen: 0 });
    curLine = rows.length - 1;
    curCol = 0;
  }

  const height = Math.min(MAX_HEIGHT, Math.max(MIN_HEIGHT, rows.length));
  const scrollStart = Math.max(0, Math.min(rows.length - height, curLine - height + 1));

  const rightRaw = renderTmpl(engine, tmpl);
  const rightLines = Segment.splitLines(rightRaw);
  const rightRows = Array.from({ length: height }, (_, i) =>
    Segment.adjustLineLength(rightLines[i] ?? [], rc),
  );

  const bStyle = focused ? cyanStyle : dimStyle;

  function topBorder(text: string, inner: number, leading: string): string {
    const prefix = `─ ${text} `;
    const fill = Math.max(1, inner - prefix.length - 1);
    return `${leading}┌${prefix}${"─".repeat(fill)}─┐`;
  }

  const segs: Segment[] = [];
  segs.push(new Segment(topBorder(label, lc + 2, "  "), bStyle));
  segs.push(new Segment("  ", dimStyle));
  segs.push(new Segment(topBorder("output", rc + 2, ""), dimStyle));
  segs.push(new Segment("\n"));

  for (let row = 0; row < height; row++) {
    const li = scrollStart + row;
    const lineText = rows[li]?.display ?? "";
    const display = lineText.padEnd(lc, " ").slice(0, lc);

    segs.push(new Segment("  │ ", bStyle));
    if (focused && li === curLine) {
      const cc = curCol;
      if (cc > 0) segs.push(new Segment(display.slice(0, cc)));
      segs.push(new Segment(display[cc] ?? " ", cursorStyle));
      if (cc + 1 < lc) segs.push(new Segment(display.slice(cc + 1, lc)));
    } else {
      segs.push(new Segment(display));
    }
    segs.push(new Segment(" │", bStyle));

    segs.push(new Segment("  │ ", dimStyle));
    segs.push(...rightRows[row]!);
    segs.push(new Segment(" │", dimStyle));

    segs.push(new Segment("\n"));
  }

  segs.push(new Segment(`  └${"─".repeat(lc + 2)}┘`, bStyle));
  segs.push(new Segment(`  └${"─".repeat(rc + 2)}┘`, dimStyle));
  return segs;
}

// ─── Demo row ──────────────────────────────────────────────────────────────

interface DemoRow {
  combinedItem: StaticItem;
  input: TextInput;
  spacer: StaticItem;
}

function makeDemoRow(label: string, template: string, engine: Engine<RichText>): DemoRow {
  const input = new TextInput({ value: template, id: uid("ti") });
  runInAction(() => { input.visible = false; });

  const combinedItem = new StaticItem({
    id: uid("row"),
    render: (opts) => buildRowSegments(input, label, engine, opts.maxWidth),
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

const sec0 = makeSection("Text Attributes", [
  makeDemoRow("canonical names",
`{{ bold "bold" }}
{{ dim "dim" }}
{{ italic "italic" }}
{{ underline "underline" }}
{{ strike "strike" }}
{{ overline "overline" }}
{{ reverse "reverse" }}
{{ blink "blink" }}`, styleEngine),
  makeDemoRow("short aliases",
`{{ b "b" }}
{{ i "i" }}
{{ u "u" }}
{{ s "s" }}`, styleEngine),
  makeDemoRow("negation",
`{{ not_bold (bold "un-bolded") }}
← outer not_bold overrides inner bold`, styleEngine),
]);

const sec1 = makeSection("Foreground Colors — Named", [
  makeDemoRow("standard 8",
`{{ black "black" }}
{{ red "red" }}
{{ green "green" }}
{{ yellow "yellow" }}
{{ blue "blue" }}
{{ magenta "magenta" }}
{{ cyan "cyan" }}
{{ white "white" }}`, styleEngine),
  makeDemoRow("bright 8",
`{{ bright_black "br_black" }}
{{ bright_red "br_red" }}
{{ bright_green "br_green" }}
{{ bright_yellow "br_yellow" }}
{{ bright_blue "br_blue" }}
{{ bright_magenta "br_magenta" }}
{{ bright_cyan "br_cyan" }}
{{ bright_white "br_white" }}`, styleEngine),
]);

const sec2 = makeSection("Foreground Colors — Generic Forms", [
  makeDemoRow("hex #ff6b6b",           `{{ hex "#ff6b6b" "coral red" }}`,    styleEngine),
  makeDemoRow("rgb 255 107 107",       `{{ rgb 255 107 107 "coral red" }}`,  styleEngine),
  makeDemoRow("color 203 (256-index)", `{{ color 203 "coral red" }}`,        styleEngine),
  makeDemoRow("light_coral (named)",   `{{ light_coral "coral red" }}`,      styleEngine),
]);

const sec3 = makeSection("Background Colors — on()", [
  makeDemoRow("named colors (auto-wrap between tags)",
    `{{ bright_white (on "red" " red ") }} {{ bright_white (on "green" " green ") }} ` +
    `{{ bright_white (on "blue" " blue ") }} {{ bright_white (on "magenta" " mag ") }} ` +
    `{{ bright_white (on "cyan" " cyan ") }} {{ black (on "yellow" " yellow ") }} ` +
    `{{ black (on "white" " white ") }}`,
    styleEngine),
  makeDemoRow("hex + named 256",
`{{ bright_white (on "#ff6b6b" " #ff6b6b ") }}
{{ bright_white (on "#2d4f67" " #2d4f67 ") }}
{{ bright_white (on "navy_blue" " navy_blue ") }}
{{ black (on "light_coral" " light_coral ") }}`, styleEngine),
]);

const sec4 = makeSection("Composition", [
  makeDemoRow("bold red",            `{{ bold (red "alert!") }}`,                              styleEngine),
  makeDemoRow("italic on navy",      `{{ italic (on "navy_blue" (bright_white "deep sea")) }}`, styleEngine),
  makeDemoRow("underline hex bold",  `{{ underline (hex "#ff6b6b" (bold "alarm!")) }}`,        styleEngine),
  makeDemoRow("dim strike",          `{{ dim (strike "deprecated") }}`,                         styleEngine),
  makeDemoRow("reverse cyan",        `{{ reverse (cyan "flipped") }}`,                          styleEngine),
  makeDemoRow("all three (aliases)", `{{ b (i (u "all three")) }}`,                             styleEngine),
]);

const sec5 = makeSection("Links — OSC 8 Hyperlinks", [
  makeDemoRow("underline cyan",
`{{ link "https://github.com/anthropics/anthropic-sdk-python"
   (underline (cyan "Anthropic SDK")) }}`, styleEngine),
  makeDemoRow("bold link",
`{{ bold (link "https://rich.readthedocs.io"
              (green "Python Rich")) }}`, styleEngine),
  makeDemoRow("hex link",
`{{ link "https://github.com"
   (b (hex "#58a6ff" "GitHub")) }}`, styleEngine),
]);

const sec6 = makeSection("Palette Functions — DRACULA", [
  makeDemoRow("semantic colors",
`{{ primary " primary " }}
{{ secondary " secondary " }}
{{ accent " accent " }}
{{ success " success " }}
{{ warning " warning " }}
{{ error " error " }}
{{ surface " surface " }}`, draculaEngine),
  makeDemoRow("derived (palette func)",
`{{ primary "primary" }}
{{ palette "primary-muted" "primary-muted" }}
{{ palette "text-primary" "text-primary" }}`, draculaEngine),
  makeDemoRow("foreground / background",
`{{ foreground "foreground" }}
{{ background "background" }}`, draculaEngine),
]);

const GRUVBOX_BG = "#282828";
const sec7 = makeSection("Palette Modifiers — darken · lighten · alpha", [
  makeDemoRow("darken gradient",
`{{ primary "base" }}
{{ palette "primary-darken-1" "↓1" }}
{{ palette "primary-darken-2" "↓2" }}
{{ palette "primary-darken-3" "↓3" }}`, gruvboxEngine),
  makeDemoRow("lighten gradient",
`{{ primary "base" }}
{{ palette "primary-lighten-1" "↑1" }}
{{ palette "primary-lighten-2" "↑2" }}
{{ palette "primary-lighten-3" "↑3" }}`, gruvboxEngine),
  makeDemoRow("alpha fade (accent over bg)",
`{{ paletteOver "accent 25%"  "${GRUVBOX_BG}" "█ 25%" }}
{{ paletteOver "accent 50%"  "${GRUVBOX_BG}" "█ 50%" }}
{{ paletteOver "accent 75%"  "${GRUVBOX_BG}" "█ 75%" }}
{{ paletteOver "accent 100%" "${GRUVBOX_BG}" "█ 100%" }}`, gruvboxEngine),
]);

const sec8 = makeSection("Auto-Contrast — auto()", [
  makeDemoRow("WCAG contrast swatches",
    ["#000000","#1a1a2e","#2d6a4f","#f4a261","#e9c46a",
     "#ffffff","#ffecd2","#f8f9fa","#495057","#dee2e6"]
      .map((bg) => `{{ on "${bg}" (auto "${bg}" "  auto  ") }}`).join("\n"),
    makeEngine(TOKYO_NIGHT)),
]);

// ─── § 9  Theme Gallery ────────────────────────────────────────────────────

const GALLERY_TMPL =
  `{{ bold (primary "Rich") }} {{ accent "template" }} {{ success "✓" }} {{ warning "!" }} {{ error "✗" }}`;

const galleryRow = makeDemoRow("template", GALLERY_TMPL, GALLERY_THEMES[3]![1]);  // preview with TOKYO_NIGHT

const galleryOutputItem = new StaticItem({
  id: uid("gallery-out"),
  render: (opts) => {
    const tmpl = galleryRow.input.value;  // MobX subscription
    const swatchTmpl = `{{ primary "██" }}{{ accent "██" }}{{ success "██" }}{{ warning "██" }}{{ error "██" }}`;
    const segs: Segment[] = [];
    for (let i = 0; i < GALLERY_THEMES.length; i++) {
      const [name, engine] = GALLERY_THEMES[i]!;
      segs.push(new Segment(`  ${name.padEnd(22)}`, dimStyle));
      segs.push(...Segment.adjustLineLength(renderTmpl(engine, swatchTmpl), 14));
      segs.push(new Segment("  "));
      segs.push(...Segment.adjustLineLength(renderTmpl(engine, tmpl), opts.maxWidth - 42));
      if (i < GALLERY_THEMES.length - 1) segs.push(new Segment("\n"));
    }
    return segs;
  },
});

const sec9 = makeSection(
  "Theme Gallery — same template, 13 themes",
  [galleryRow],
  [galleryOutputItem],
);

// ─── § 10  Showcase — Build Report ─────────────────────────────────────────

const SHOWCASE_LINES: [string, string][] = [
  ["header",    `{{ bold (primary "BUILD REPORT") }}  {{ palette "surface" "·" }}  {{ dim "2026-05-10" }}`],
  ["tests",     `{{ success "✓" }} {{ bold "Tests" }}    {{ dim "8,627 passed" }}  {{ palette "success-muted" "(+32)" }}`],
  ["lint",      `{{ error "✗" }} {{ bold "Lint" }}     {{ dim "2 errors" }}       {{ error "fix required" }}`],
  ["coverage",  `{{ warning "!" }} {{ bold "Coverage" }} {{ dim "87.4%" }}           {{ warning "below 90% threshold" }}`],
  ["artifacts", `{{ dim "Artifacts:" }}  {{ link "https://example.com/dist" (underline (accent "dist/")) }}  {{ link "https://example.com/docs" (underline (accent "docs/")) }}`],
  ["footer",    `{{ italic (dim "Powered by ") }}{{ link "https://github.com" (cyan "rich-js") }}{{ italic (dim " template bindings") }}`],
];

const showcaseRows = SHOWCASE_LINES.map(([label, tmpl]) =>
  makeDemoRow(label, tmpl, tokyoEngine),
);

const showcasePanelItem = new StaticItem({
  id: uid("showcase-panel"),
  render: (opts) => {
    const lineRenderable = {
      render: (inner: { maxWidth: number; isTerminal: boolean; encoding: string }) => {
        const segs: Segment[] = [];
        for (let i = 0; i < showcaseRows.length; i++) {
          if (i > 0) segs.push(new Segment("\n"));
          if (i === 1 || i === 4) segs.push(new Segment("\n  "));
          else if (i > 0) segs.push(new Segment("  "));
          segs.push(...renderTmpl(tokyoEngine, showcaseRows[i]!.input.value));
          // Clip each line to inner.maxWidth
          void inner;
        }
        return segs;
      },
    };
    const title = new RichText(" CI / CD ", { style: cyanBoldStyle, end: "" });
    return new Panel(lineRenderable, { borderStyle: cyanBoldStyle, title, padding: [1, 2] }).render(opts);
  },
});

const panelLabelItem = new StaticItem({
  id: uid("panel-lbl"),
  render: () => [new Segment("  combined output", dimStyle)],
});

const sec10 = makeSection(
  "Showcase — Build Report",
  showcaseRows,
  [panelLabelItem, showcasePanelItem],
);

// ─── Section list ──────────────────────────────────────────────────────────

const SECTIONS: Section[] = [sec0, sec1, sec2, sec3, sec4, sec5, sec6, sec7, sec8, sec9, sec10];

const SECTION_NAMES = [
  "Text Attributes", "Named Colors", "Generic Colors", "Backgrounds",
  "Composition", "Links", "Palette (DRACULA)", "Modifiers (GRUVBOX)",
  "Auto-Contrast", "Theme Gallery", "Build Report",
];

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
  render: () => [new Segment("  Ctrl+N/Ctrl+P: sections  ·  Tab: cycle inputs  ·  Ctrl+C: exit", dimStyle)],
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

const unsubKey = router.onKey((event) => {
  if (event.ctrl && event.key === "c") { shutdown(); return; }
  const n = SECTIONS.length;
  if (event.ctrl && event.key === "p") { state.prev(n); focusFirst(state.sectionIdx); }
  else if (event.ctrl && event.key === "n") { state.next(n); focusFirst(state.sectionIdx); }
});

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
