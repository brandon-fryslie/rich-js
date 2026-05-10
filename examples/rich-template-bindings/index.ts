/**
 * Template Bindings — Interactive TUI Demo
 *
 * Side-by-side layout: editable template box on the left, live rendered
 * output on the right. Every section's TextInputs are invisible widgets
 * (focusable, handles keys) while a paired StaticItem renders both columns
 * by reading input.value / input.cursorPosition / input.focused (all MobX
 * observables), so Screen's autorun re-renders on every keystroke.
 *
 * Ctrl+N / Ctrl+P — navigate sections (next / prev)
 * Tab / Shift+Tab  — cycle inputs within the current section
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

// ─── Engine helpers ────────────────────────────────────────────────────────

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

function exec(engine: Engine<RichText>, tmpl: string): RichText {
  const frags = engine.compile(tmpl)({});
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

// Pre-create engines once — not per frame.
const draculaEngine = makeEngine(DRACULA);
const gruvboxEngine = makeEngine(GRUVBOX);
const tokyoEngine = makeEngine(TOKYO_NIGHT);

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

const dimStyle = Style.parse("dim");
const cyanBoldStyle = Style.parse("bold cyan");
const redStyle = Style.parse("red dim");
const cursorStyle = Style.parse("reverse");
const boxStyle = Style.parse("dim");

// ─── App state ─────────────────────────────────────────────────────────────

class AppState {
  sectionIdx = 0;

  constructor() {
    makeAutoObservable(this);
  }

  prev(n: number): void {
    this.sectionIdx = (this.sectionIdx + n - 1) % n;
  }

  next(n: number): void {
    this.sectionIdx = (this.sectionIdx + 1) % n;
  }
}
const state = new AppState();

// ─── Widget utilities ──────────────────────────────────────────────────────

let _uid = 0;
const uid = (p: string): string => `${p}-${_uid++}`;

function makeSpacerItem(): StaticItem {
  return new StaticItem({ id: uid("sp"), render: () => [new Segment("")] });
}

// Render a template to Segment[]. Returns a dim error message on failure.
function renderTmpl(
  engine: Engine<RichText>,
  tmpl: string,
  maxWidth: number,
): Segment[] {
  try {
    const result = exec(engine, tmpl);
    return Array.from(result.render({ maxWidth, isTerminal: true, encoding: "utf-8" }));
  } catch (e) {
    return [new Segment(`[error: ${String(e).slice(0, 60)}]`, redStyle)];
  }
}

// ─── Two-column row ────────────────────────────────────────────────────────
//
// Layout (all flow):
//   labelItem   "  label"          — dim section label
//   combinedItem  [template...│]  rendered output   — both columns in one item
//   input        (invisible: focusable, handles keys, stores value)
//   spacer
//
// The TextInput is always invisible. The combinedItem renders a faux TextInput
// on the left by reading input.value / input.cursorPosition / input.focused
// (all MobX observables) — Screen's autorun re-renders on every keystroke.

interface DemoRow {
  labelItem: StaticItem;
  combinedItem: StaticItem;
  input: TextInput;
  spacer: StaticItem;
}

function makeDemoRow(
  label: string,
  template: string,
  engine: Engine<RichText>,
): DemoRow {
  const input = new TextInput({ value: template, id: uid("ti") });
  // Invisible: takes 0 space but stays in Tab order and handles keys.
  runInAction(() => { input.visible = false; });

  const labelItem = new StaticItem({
    id: uid("lbl"),
    render: () => [new Segment(`  ${label}`, dimStyle)],
  });

  const combinedItem = new StaticItem({
    id: uid("combined"),
    render: (opts) => {
      const totalW = opts.maxWidth;
      // Left column: faux TextInput box occupies roughly half the width.
      // "  [" prefix (3) + content + "]  " suffix (3) = boxWidth.
      const boxWidth = Math.floor(totalW / 2);
      const contentW = Math.max(4, boxWidth - 6);  // inside the [ ] brackets
      const rightW = Math.max(4, totalW - boxWidth - 2);  // remaining for output

      const tmpl = input.value;          // observable read → subscription
      const pos = input.cursorPosition;  // observable read → subscription
      const focused = input.focused;     // observable read → subscription

      // Slide a window over the template so the cursor stays visible.
      const winStart = Math.max(0, Math.min(tmpl.length - contentW, pos - Math.floor(contentW / 2)));
      const slice = tmpl.slice(winStart, winStart + contentW);
      const display = slice.padEnd(contentW, " ");
      const localCursor = pos - winStart;

      const segs: Segment[] = [new Segment("  [", boxStyle)];

      if (focused && localCursor >= 0 && localCursor < contentW) {
        if (localCursor > 0) segs.push(new Segment(display.slice(0, localCursor), dimStyle));
        segs.push(new Segment(display[localCursor] ?? " ", cursorStyle));
        if (localCursor + 1 < contentW) {
          segs.push(new Segment(display.slice(localCursor + 1), dimStyle));
        }
      } else {
        segs.push(new Segment(display, dimStyle));
      }

      segs.push(new Segment("]  ", boxStyle));

      // Right column: rendered template output.
      const rightSegs = renderTmpl(engine, tmpl, rightW);
      segs.push(...rightSegs);

      return segs;
    },
  });

  return { labelItem, combinedItem, input, spacer: makeSpacerItem() };
}

// ─── Section ───────────────────────────────────────────────────────────────

interface Section {
  headerItem: StaticItem;
  rows: DemoRow[];
  extraVisibleItems: StaticItem[];  // additional visible items (e.g. gallery output)
  allInteractiveWidgets: (StaticItem | TextInput)[];
  mountEntries: MountEntry[];
}

function makeSection(title: string, rows: DemoRow[], extraVisibleItems: StaticItem[] = []): Section {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) => new Rule(title, { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer = makeSpacerItem();
  const trailingSpacer = makeSpacerItem();

  // All StaticItems that participate in show/hide per section.
  const visibleItems: StaticItem[] = [
    headerItem, headerSpacer,
    ...rows.flatMap((r) => [r.labelItem, r.combinedItem, r.spacer]),
    ...extraVisibleItems,
    trailingSpacer,
  ];

  // Inputs are always invisible (visible=false) but need disabled toggling.
  const inputs = rows.map((r) => r.input);

  const allInteractiveWidgets: (StaticItem | TextInput)[] = [
    ...visibleItems,
    ...inputs,
  ];

  // Mount order: label, combined, spacer per row; inputs at end (0-height).
  const mountEntries: MountEntry[] = [
    headerItem, headerSpacer,
    ...rows.flatMap((r): MountEntry[] => [r.labelItem, r.combinedItem, r.spacer, r.input]),
    ...extraVisibleItems,
    trailingSpacer,
  ];

  return { headerItem, rows, extraVisibleItems, allInteractiveWidgets, mountEntries };
}

// ─── Section definitions ───────────────────────────────────────────────────

const sec0 = makeSection("Text Attributes", [
  makeDemoRow(
    "canonical names",
    `{{ bold "bold" }}  {{ dim "dim" }}  {{ italic "italic" }}  ` +
    `{{ underline "underline" }}  {{ strike "strike" }}  ` +
    `{{ overline "overline" }}  {{ reverse "reverse" }}  {{ blink "blink" }}`,
    styleEngine,
  ),
  makeDemoRow(
    "short aliases",
    `{{ b "b" }}  {{ i "i" }}  {{ u "u" }}  {{ s "s" }}`,
    styleEngine,
  ),
  makeDemoRow(
    "negation",
    `{{ not_bold (bold "un-bolded") }}  ← outer not_bold overrides inner bold`,
    styleEngine,
  ),
]);

const sec1 = makeSection("Foreground Colors — Named", [
  makeDemoRow(
    "standard 8",
    `{{ black "black" }}  {{ red "red" }}  {{ green "green" }}  ` +
    `{{ yellow "yellow" }}  {{ blue "blue" }}  {{ magenta "magenta" }}  ` +
    `{{ cyan "cyan" }}  {{ white "white" }}`,
    styleEngine,
  ),
  makeDemoRow(
    "bright 8",
    `{{ bright_black "br_black" }}  {{ bright_red "br_red" }}  ` +
    `{{ bright_green "br_green" }}  {{ bright_yellow "br_yellow" }}  ` +
    `{{ bright_blue "br_blue" }}  {{ bright_magenta "br_mag" }}  ` +
    `{{ bright_cyan "br_cyan" }}  {{ bright_white "br_white" }}`,
    styleEngine,
  ),
]);

const sec2 = makeSection("Foreground Colors — Generic Forms", [
  makeDemoRow("hex #ff6b6b",          `{{ hex "#ff6b6b" "coral red" }}`,    styleEngine),
  makeDemoRow("rgb 255 107 107",      `{{ rgb 255 107 107 "coral red" }}`,  styleEngine),
  makeDemoRow("color 203 (256-index)",`{{ color 203 "coral red" }}`,        styleEngine),
  makeDemoRow("light_coral (named)",  `{{ light_coral "coral red" }}`,      styleEngine),
]);

const sec3 = makeSection("Background Colors — on()", [
  makeDemoRow(
    "named colors",
    `{{ bright_white (on "red" " red ") }}  ` +
    `{{ bright_white (on "green" " green ") }}  ` +
    `{{ bright_white (on "blue" " blue ") }}  ` +
    `{{ bright_white (on "magenta" " magenta ") }}  ` +
    `{{ bright_white (on "cyan" " cyan ") }}  ` +
    `{{ black (on "yellow" " yellow ") }}  ` +
    `{{ black (on "white" " white ") }}`,
    styleEngine,
  ),
  makeDemoRow(
    "hex + named 256",
    `{{ bright_white (on "#ff6b6b" " #ff6b6b ") }}  ` +
    `{{ bright_white (on "#2d4f67" " #2d4f67 ") }}  ` +
    `{{ bright_white (on "navy_blue" " navy_blue ") }}  ` +
    `{{ black (on "light_coral" " light_coral ") }}`,
    styleEngine,
  ),
]);

const sec4 = makeSection("Composition", [
  makeDemoRow("bold red",            `{{ bold (red "alert!") }}`,                                     styleEngine),
  makeDemoRow("italic on navy",      `{{ italic (on "navy_blue" (bright_white "deep sea")) }}`,        styleEngine),
  makeDemoRow("underline hex bold",  `{{ underline (hex "#ff6b6b" (bold "alarm!")) }}`,               styleEngine),
  makeDemoRow("dim strike",          `{{ dim (strike "deprecated") }}`,                                styleEngine),
  makeDemoRow("reverse cyan",        `{{ reverse (cyan "flipped") }}`,                                 styleEngine),
  makeDemoRow("all three (aliases)", `{{ b (i (u "all three")) }}`,                                    styleEngine),
]);

const sec5 = makeSection("Links — OSC 8 Hyperlinks", [
  makeDemoRow(
    "underline cyan",
    `{{ link "https://github.com/anthropics/anthropic-sdk-python" (underline (cyan "Anthropic SDK")) }}`,
    styleEngine,
  ),
  makeDemoRow(
    "bold link",
    `{{ bold (link "https://rich.readthedocs.io" (green "Python Rich")) }}`,
    styleEngine,
  ),
  makeDemoRow(
    "hex link",
    `{{ link "https://github.com" (b (hex "#58a6ff" "GitHub")) }}`,
    styleEngine,
  ),
]);

const sec6 = makeSection("Palette Functions — DRACULA", [
  makeDemoRow(
    "semantic colors",
    `{{ primary " primary " }}  {{ secondary " secondary " }}  ` +
    `{{ accent " accent " }}  {{ success " success " }}  ` +
    `{{ warning " warning " }}  {{ error " error " }}  ` +
    `{{ surface " surface " }}`,
    draculaEngine,
  ),
  makeDemoRow(
    "derived (palette func)",
    `{{ primary "primary" }}  ` +
    `{{ palette "primary-muted" "primary-muted" }}  ` +
    `{{ palette "text-primary" "text-primary" }}`,
    draculaEngine,
  ),
  makeDemoRow(
    "foreground / background",
    `{{ foreground "foreground" }}  {{ background "background" }}`,
    draculaEngine,
  ),
]);

const GRUVBOX_BG = "#282828";
const sec7 = makeSection("Palette Modifiers — darken · lighten · alpha", [
  makeDemoRow(
    "darken gradient",
    `{{ primary "base" }}  {{ palette "primary-darken-1" "↓1" }}  ` +
    `{{ palette "primary-darken-2" "↓2" }}  {{ palette "primary-darken-3" "↓3" }}`,
    gruvboxEngine,
  ),
  makeDemoRow(
    "lighten gradient",
    `{{ primary "base" }}  {{ palette "primary-lighten-1" "↑1" }}  ` +
    `{{ palette "primary-lighten-2" "↑2" }}  {{ palette "primary-lighten-3" "↑3" }}`,
    gruvboxEngine,
  ),
  makeDemoRow(
    "alpha fade (accent over bg)",
    `{{ paletteOver "accent 25%" "${GRUVBOX_BG}" "█ 25%" }}  ` +
    `{{ paletteOver "accent 50%" "${GRUVBOX_BG}" "█ 50%" }}  ` +
    `{{ paletteOver "accent 75%" "${GRUVBOX_BG}" "█ 75%" }}  ` +
    `{{ paletteOver "accent 100%" "${GRUVBOX_BG}" "█ 100%" }}`,
    gruvboxEngine,
  ),
]);

const sec8 = makeSection("Auto-Contrast — auto()", [
  makeDemoRow(
    "WCAG contrast swatches",
    [
      "#000000", "#1a1a2e", "#2d6a4f", "#f4a261", "#e9c46a",
      "#ffffff", "#ffecd2", "#f8f9fa", "#495057", "#dee2e6",
    ].map((bg) => `{{ on "${bg}" (auto "${bg}" "  auto  ") }}`).join("  "),
    makeEngine(TOKYO_NIGHT),
  ),
]);

// ─── § 9  Theme Gallery ────────────────────────────────────────────────────
// One shared TextInput (invisible) + combinedItem showing the editable box
// on the left + a per-theme output list below.

const GALLERY_TMPL =
  `{{ bold (primary "Rich") }} {{ accent "template" }} ` +
  `{{ success "✓" }} {{ warning "!" }} {{ error "✗" }}`;

const galleryInput = new TextInput({ value: GALLERY_TMPL, id: uid("gallery-ti") });
runInAction(() => { galleryInput.visible = false; });

const galleryCombinedItem = new StaticItem({
  id: uid("gallery-combined"),
  render: (opts) => {
    const totalW = opts.maxWidth;
    const boxWidth = Math.floor(totalW / 2);
    const contentW = Math.max(4, boxWidth - 6);
    const pos = galleryInput.cursorPosition;
    const focused = galleryInput.focused;
    const tmpl = galleryInput.value;
    const winStart = Math.max(0, Math.min(tmpl.length - contentW, pos - Math.floor(contentW / 2)));
    const slice = tmpl.slice(winStart, winStart + contentW);
    const display = slice.padEnd(contentW, " ");
    const localCursor = pos - winStart;

    const segs: Segment[] = [new Segment("  template  [", boxStyle)];
    if (focused && localCursor >= 0 && localCursor < contentW) {
      if (localCursor > 0) segs.push(new Segment(display.slice(0, localCursor), dimStyle));
      segs.push(new Segment(display[localCursor] ?? " ", cursorStyle));
      if (localCursor + 1 < contentW) segs.push(new Segment(display.slice(localCursor + 1), dimStyle));
    } else {
      segs.push(new Segment(display, dimStyle));
    }
    segs.push(new Segment("]", boxStyle));
    return segs;
  },
});

const galleryOutputItem = new StaticItem({
  id: uid("gallery-out"),
  render: (opts) => {
    const tmpl = galleryInput.value;
    const swatchTmpl = `{{ primary "██" }}{{ accent "██" }}{{ success "██" }}{{ warning "██" }}{{ error "██" }}`;
    const segments: Segment[] = [];
    for (let i = 0; i < GALLERY_THEMES.length; i++) {
      const [name, engine] = GALLERY_THEMES[i]!;
      segments.push(new Segment(`    ${name.padEnd(22)}`, dimStyle));
      segments.push(...renderTmpl(engine, swatchTmpl, 20));
      segments.push(new Segment("  "));
      segments.push(...renderTmpl(engine, tmpl, opts.maxWidth - 50));
      if (i < GALLERY_THEMES.length - 1) segments.push(new Segment("\n"));
    }
    return segments;
  },
});

const galleryLabelItem = new StaticItem({
  id: uid("gallery-lbl"),
  render: () => [new Segment("  edit template to update all 13 themes simultaneously", dimStyle)],
});

const sec9: Section = (() => {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) =>
      new Rule("Theme Gallery — same template, 13 themes", { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer = makeSpacerItem();
  const trailingSpacer = makeSpacerItem();

  const visibleItems = [headerItem, headerSpacer, galleryLabelItem, galleryCombinedItem, galleryOutputItem, trailingSpacer];

  return {
    headerItem,
    rows: [],
    extraVisibleItems: [galleryLabelItem, galleryCombinedItem, galleryOutputItem],
    allInteractiveWidgets: [...visibleItems, galleryInput],
    mountEntries: [
      headerItem, headerSpacer,
      galleryLabelItem, galleryCombinedItem, galleryInput, galleryOutputItem,
      trailingSpacer,
    ] as MountEntry[],
  };
})();

// ─── § 10  Showcase — Build Report ────────────────────────────────────────

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

// Combined Panel that joins all 6 showcase lines. Blank lines before
// tests (idx 1) and artifacts (idx 4) match the original build report format.
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
          segs.push(...renderTmpl(tokyoEngine, showcaseRows[i]!.input.value, inner.maxWidth));
        }
        return segs;
      },
    };
    const title = new RichText(" CI / CD ", { style: cyanBoldStyle, end: "" });
    return new Panel(lineRenderable, { borderStyle: cyanBoldStyle, title, padding: [1, 2] }).render(opts);
  },
});

const sec10: Section = (() => {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) => new Rule("Showcase — Build Report", { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer = makeSpacerItem();
  const panelLabelItem = new StaticItem({
    id: uid("panel-lbl"),
    render: () => [new Segment("  combined output", dimStyle)],
  });
  const trailingSpacer = makeSpacerItem();

  const visibleItems: StaticItem[] = [
    headerItem, headerSpacer,
    ...showcaseRows.flatMap((r) => [r.labelItem, r.combinedItem, r.spacer]),
    panelLabelItem, showcasePanelItem,
    trailingSpacer,
  ];

  return {
    headerItem,
    rows: showcaseRows,
    extraVisibleItems: [panelLabelItem, showcasePanelItem],
    allInteractiveWidgets: [
      ...visibleItems,
      ...showcaseRows.map((r) => r.input),
    ],
    mountEntries: [
      headerItem, headerSpacer,
      ...showcaseRows.flatMap((r): MountEntry[] => [r.labelItem, r.combinedItem, r.spacer, r.input]),
      panelLabelItem, showcasePanelItem,
      trailingSpacer,
    ],
  };
})();

// ─── All sections ──────────────────────────────────────────────────────────
// Theme Gallery (§9) before Showcase (§10).

const SECTIONS: Section[] = [
  sec0, sec1, sec2, sec3, sec4, sec5, sec6, sec7, sec8, sec9, sec10,
];

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
  render: () => [
    new Segment(
      "  Ctrl+N/Ctrl+P: navigate sections  ·  Tab: cycle inputs  ·  Ctrl+C: exit",
      dimStyle,
    ),
  ],
});

const headerSpacer = makeSpacerItem();

// ─── Screen + focus manager ────────────────────────────────────────────────

const fm = new DefaultFocusManager();
const screen = new DefaultScreen({ focusManager: fm, out: process.stdout });

// ─── Mount list ────────────────────────────────────────────────────────────

const mountList: MountEntry[] = [
  appTitleItem,
  navHintItem,
  headerSpacer,
  ...SECTIONS.flatMap((s) => s.mountEntries),
];

// ─── Visibility + focus management ─────────────────────────────────────────

// Sets visible on StaticItems and disabled on TextInputs per active section.
// TextInputs are always invisible (visible=false); only disabled changes.
const disposeVisibility = autorun(() => {
  const idx = state.sectionIdx;
  runInAction(() => {
    SECTIONS.forEach((sec, si) => {
      const active = si === idx;
      for (const w of sec.allInteractiveWidgets) {
        if (w instanceof TextInput) {
          (w as TextInput).disabled = !active;
        } else {
          w.visible = active;
        }
      }
    });
    // Auto-focus first input of the newly active section.
    const firstInput = SECTIONS[idx]?.rows[0]?.input
      ?? (SECTIONS[idx]?.mountEntries.find(
          (e) => e instanceof TextInput,
        ) as TextInput | undefined);
    if (firstInput) fm.focus(firstInput);
  });
});

// ─── Navigation ────────────────────────────────────────────────────────────

const router = new EventRouter({ screen, input: process.stdin, output: process.stdout });

function focusFirstInSection(idx: number): void {
  const sec = SECTIONS[idx]!;
  const firstInput = sec.rows[0]?.input
    ?? (sec.mountEntries.find((e) => e instanceof TextInput) as TextInput | undefined);
  if (firstInput && !firstInput.disabled) fm.focus(firstInput);
}

const unsubKey = router.onKey((event) => {
  if (event.ctrl && event.key === "c") { shutdown(); return; }
  const n = SECTIONS.length;
  if (event.ctrl && event.key === "p") {
    state.prev(n);
    focusFirstInSection(state.sectionIdx);
  } else if (event.ctrl && event.key === "n") {
    state.next(n);
    focusFirstInSection(state.sectionIdx);
  }
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

screen.mount(...mountList);
process.stdout.write("\x1b[?1049h");
process.stdout.write("\x1b[H");
screen.start();
router.start();
