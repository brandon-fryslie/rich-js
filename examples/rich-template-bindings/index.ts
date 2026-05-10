/**
 * Template Bindings — Interactive TUI Demo
 *
 * Every displayed item has an editable TextInput containing the Go template
 * that live-generates it. Edit the template to see the output update instantly.
 *
 * PageUp / PageDown  — navigate sections
 * Tab / Shift+Tab    — cycle inputs within the current section
 * Ctrl+C             — exit
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

// engine.compile(tmpl)(scope) returns T[]. We encode each fragment's _style
// as a span (via stylize) before adding specific spans so later spans win
// on conflict — matching _buildSegments accumulation order.
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

function makeStaticSpacer(): StaticItem {
  return new StaticItem({ id: uid("sp"), render: () => [new Segment("")] });
}

// Render a template to Segment[]. On error, returns a dim error message.
function renderTmpl(
  engine: Engine<RichText>,
  tmpl: string,
  maxWidth: number,
): Segment[] {
  try {
    const result = exec(engine, tmpl);
    return Array.from(result.render({ maxWidth, isTerminal: true, encoding: "utf-8" }));
  } catch (e) {
    return [new Segment(`  [error: ${String(e).slice(0, 70)}]`, redStyle)];
  }
}

// ─── Demo row ──────────────────────────────────────────────────────────────
//
// Layout (all flow placement):
//   labelItem  "  label text"        — dim label
//   input      [template ...]        — full-width TextInput
//   outputItem "    rendered result" — indented live output
//   spacer                           — blank separator

interface DemoRow {
  labelItem: StaticItem;
  input: TextInput;
  outputItem: StaticItem;
  spacer: StaticItem;
}

function makeDemoRow(
  label: string,
  template: string,
  engine: Engine<RichText>,
): DemoRow {
  const input = new TextInput({ value: template, id: uid("ti") });

  const labelItem = new StaticItem({
    id: uid("lbl"),
    render: () => [new Segment(`  ${label}`, dimStyle)],
  });

  // Reads input.value — MobX subscribes Screen's autorun to this observable.
  const outputItem = new StaticItem({
    id: uid("out"),
    render: (opts) => {
      const segs = renderTmpl(engine, input.value, opts.maxWidth - 4);
      return [new Segment("    "), ...segs];
    },
  });

  return { labelItem, input, outputItem, spacer: makeStaticSpacer() };
}

// ─── Section ───────────────────────────────────────────────────────────────

interface Section {
  headerItem: StaticItem;
  rows: DemoRow[];
  extraItems: (StaticItem | TextInput)[];
  allInteractiveWidgets: (StaticItem | TextInput)[];
  mountEntries: MountEntry[];
}

function makeSection(
  title: string,
  rows: DemoRow[],
  extraItems: (StaticItem | TextInput)[] = [],
): Section {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) => new Rule(title, { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer = makeStaticSpacer();
  const trailingSpacer = makeStaticSpacer();

  const rowWidgets = rows.flatMap((r): (StaticItem | TextInput)[] => [
    r.labelItem, r.input, r.outputItem, r.spacer,
  ]);

  const allInteractiveWidgets: (StaticItem | TextInput)[] = [
    headerItem, headerSpacer,
    ...rowWidgets,
    ...extraItems,
    trailingSpacer,
  ];

  const mountEntries: MountEntry[] = allInteractiveWidgets as MountEntry[];

  return { headerItem, rows, extraItems, allInteractiveWidgets, mountEntries };
}

// ─── Section definitions ───────────────────────────────────────────────────

// § 0  Text Attributes
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
    "negation (not_bold wins)",
    `{{ not_bold (bold "un-bolded") }}  ← outer not_bold overrides inner bold`,
    styleEngine,
  ),
]);

// § 1  Named Colors
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

// § 2  Generic Color Forms
const sec2 = makeSection("Foreground Colors — Generic Forms", [
  makeDemoRow("hex #ff6b6b",          `{{ hex "#ff6b6b" "coral red" }}`,   styleEngine),
  makeDemoRow("rgb 255 107 107",      `{{ rgb 255 107 107 "coral red" }}`, styleEngine),
  makeDemoRow("color 203 (256-index)",`{{ color 203 "coral red" }}`,       styleEngine),
  makeDemoRow("light_coral (named)",  `{{ light_coral "coral red" }}`,     styleEngine),
]);

// § 3  Background Colors
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

// § 4  Composition
const sec4 = makeSection("Composition", [
  makeDemoRow("bold red",             `{{ bold (red "alert!") }}`,                                     styleEngine),
  makeDemoRow("italic on navy",       `{{ italic (on "navy_blue" (bright_white "deep sea")) }}`,        styleEngine),
  makeDemoRow("underline hex bold",   `{{ underline (hex "#ff6b6b" (bold "alarm!")) }}`,               styleEngine),
  makeDemoRow("dim strike",           `{{ dim (strike "deprecated") }}`,                                styleEngine),
  makeDemoRow("reverse cyan",         `{{ reverse (cyan "flipped") }}`,                                 styleEngine),
  makeDemoRow("all three (aliases)",  `{{ b (i (u "all three")) }}`,                                    styleEngine),
]);

// § 5  Links
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

// § 6  Palette — DRACULA
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

// § 7  Palette Modifiers — GRUVBOX
const GRUVBOX_BG = "#282828";
const sec7 = makeSection("Palette Modifiers — darken · lighten · alpha", [
  makeDemoRow(
    "darken gradient",
    `{{ primary "base" }}  ` +
    `{{ palette "primary-darken-1" "↓1" }}  ` +
    `{{ palette "primary-darken-2" "↓2" }}  ` +
    `{{ palette "primary-darken-3" "↓3" }}`,
    gruvboxEngine,
  ),
  makeDemoRow(
    "lighten gradient",
    `{{ primary "base" }}  ` +
    `{{ palette "primary-lighten-1" "↑1" }}  ` +
    `{{ palette "primary-lighten-2" "↑2" }}  ` +
    `{{ palette "primary-lighten-3" "↑3" }}`,
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

// § 8  Auto-Contrast
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

// § 9  Theme Gallery (special: 1 shared input → 13 theme outputs in one StaticItem)
const GALLERY_TMPL =
  `{{ bold (primary "Rich") }} {{ accent "template" }} ` +
  `{{ success "✓" }} {{ warning "!" }} {{ error "✗" }}`;

const galleryInput = new TextInput({
  value: GALLERY_TMPL,
  id: uid("gallery-ti"),
});

const galleryLabelItem = new StaticItem({
  id: uid("gallery-lbl"),
  render: () => [new Segment("  template", dimStyle)],
});

const galleryOutputItem = new StaticItem({
  id: uid("gallery-out"),
  render: (opts) => {
    const tmpl = galleryInput.value;
    const swatchTmpl =
      `{{ primary "██" }}{{ accent "██" }}{{ success "██" }}{{ warning "██" }}{{ error "██" }}`;
    const segments: Segment[] = [];
    for (let i = 0; i < GALLERY_THEMES.length; i++) {
      const [name, engine] = GALLERY_THEMES[i]!;
      segments.push(new Segment(`    ${name.padEnd(22)}`, dimStyle));
      // colour swatches
      const swatches = renderTmpl(engine, swatchTmpl, 20);
      segments.push(...swatches);
      segments.push(new Segment("  "));
      // user template
      const result = renderTmpl(engine, tmpl, opts.maxWidth - 50);
      segments.push(...result);
      if (i < GALLERY_THEMES.length - 1) segments.push(new Segment("\n"));
    }
    return segments;
  },
});

const sec9: Section = (() => {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) =>
      new Rule("Theme Gallery — same template, 13 themes", { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer = makeStaticSpacer();
  const trailingSpacer = makeStaticSpacer();

  const allInteractiveWidgets: (StaticItem | TextInput)[] = [
    headerItem, headerSpacer,
    galleryLabelItem, galleryInput, galleryOutputItem, makeStaticSpacer(),
    trailingSpacer,
  ];

  return {
    headerItem,
    rows: [],
    extraItems: [galleryLabelItem, galleryInput, galleryOutputItem],
    allInteractiveWidgets,
    mountEntries: allInteractiveWidgets as MountEntry[],
  };
})();

// § 10  Showcase — Build Report (6 inputs → combined Panel output)
const SHOWCASE_LINES: [string, string][] = [
  [
    "header",
    `{{ bold (primary "BUILD REPORT") }}  {{ palette "surface" "·" }}  {{ dim "2026-05-10" }}`,
  ],
  [
    "tests",
    `{{ success "✓" }} {{ bold "Tests" }}    {{ dim "8,627 passed" }}  {{ palette "success-muted" "(+32)" }}`,
  ],
  [
    "lint",
    `{{ error "✗" }} {{ bold "Lint" }}     {{ dim "2 errors" }}       {{ error "fix required" }}`,
  ],
  [
    "coverage",
    `{{ warning "!" }} {{ bold "Coverage" }} {{ dim "87.4%" }}           {{ warning "below 90% threshold" }}`,
  ],
  [
    "artifacts",
    `{{ dim "Artifacts:" }}  {{ link "https://example.com/dist" (underline (accent "dist/")) }}` +
    `  {{ link "https://example.com/docs" (underline (accent "docs/")) }}`,
  ],
  [
    "footer",
    `{{ italic (dim "Powered by ") }}{{ link "https://github.com" (cyan "rich-js") }}{{ italic (dim " template bindings") }}`,
  ],
];

const showcaseRows = SHOWCASE_LINES.map(([label, tmpl]) =>
  makeDemoRow(label, tmpl, tokyoEngine),
);

// Combined Panel output — reads ALL showcase inputs.
// Blank lines: after header (idx 0), and before artifacts (idx 4).
const showcasePanelItem = new StaticItem({
  id: uid("showcase-panel"),
  render: (opts) => {
    // Build a renderable that joins all showcase lines with newlines.
    const lineRenderable = {
      render: (innerOpts: { maxWidth: number; isTerminal: boolean; encoding: string }) => {
        const segments: Segment[] = [];
        for (let i = 0; i < showcaseRows.length; i++) {
          if (i > 0) segments.push(new Segment("\n"));
          if (i === 1 || i === 4) segments.push(new Segment("\n  "));  // blank lines
          else if (i > 0) segments.push(new Segment("  "));
          const segs = renderTmpl(tokyoEngine, showcaseRows[i]!.input.value, innerOpts.maxWidth);
          segments.push(...segs);
        }
        return segments;
      },
    };
    const titleText = new RichText(" CI / CD ", { style: cyanBoldStyle, end: "" });
    const panel = new Panel(lineRenderable, {
      borderStyle: cyanBoldStyle,
      title: titleText,
      padding: [1, 2],
    });
    return panel.render(opts);
  },
});

const sec10: Section = (() => {
  const headerItem = new StaticItem({
    id: uid("hdr"),
    render: (opts) =>
      new Rule("Showcase — Build Report", { style: cyanBoldStyle }).render(opts),
  });
  const headerSpacer = makeStaticSpacer();
  const panelLabelItem = new StaticItem({
    id: uid("panel-lbl"),
    render: () => [new Segment("  combined output", dimStyle)],
  });
  const trailingSpacer = makeStaticSpacer();

  const rowWidgets = showcaseRows.flatMap((r): (StaticItem | TextInput)[] => [
    r.labelItem, r.input, r.outputItem, r.spacer,
  ]);

  const allInteractiveWidgets: (StaticItem | TextInput)[] = [
    headerItem, headerSpacer,
    ...rowWidgets,
    panelLabelItem,
    showcasePanelItem,
    trailingSpacer,
  ];

  return {
    headerItem,
    rows: showcaseRows,
    extraItems: [panelLabelItem, showcasePanelItem],
    allInteractiveWidgets,
    mountEntries: allInteractiveWidgets as MountEntry[],
  };
})();

// ─── All sections in display order ─────────────────────────────────────────
// Theme Gallery (§9) appears before Showcase (§10) per user request.

const SECTIONS: Section[] = [
  sec0, sec1, sec2, sec3, sec4, sec5, sec6, sec7, sec8, sec9, sec10,
];

// ─── Always-visible header widgets ─────────────────────────────────────────

const appTitleItem = new StaticItem({
  id: "app-title",
  render: () => {
    const idx = state.sectionIdx;
    const total = SECTIONS.length;
    const title = [
      "Text Attributes", "Named Colors", "Generic Colors", "Background Colors",
      "Composition", "Links", "Palette (DRACULA)", "Modifiers (GRUVBOX)",
      "Auto-Contrast", "Theme Gallery", "Build Report",
    ][idx] ?? "";
    return [
      new Segment("  @promptctl/rich-js · Template Bindings", Style.parse("bold")),
      new Segment(`   §${idx + 1}/${total}: ${title}`, cyanBoldStyle),
    ];
  },
});

const navHintItem = new StaticItem({
  id: "nav-hint",
  render: () => [
    new Segment(
      "  PageUp/PageDown: navigate sections  ·  Tab: cycle inputs  ·  Ctrl+C: exit",
      dimStyle,
    ),
  ],
});

const headerSpacer = makeStaticSpacer();

// ─── Focus manager + screen ────────────────────────────────────────────────

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

// Reads state.sectionIdx; fires synchronously on each section change.
// Sets visible/disabled on all section widgets, then focuses the first input.
const disposeVisibility = autorun(() => {
  const idx = state.sectionIdx;
  runInAction(() => {
    SECTIONS.forEach((sec, si) => {
      const active = si === idx;
      for (const w of sec.allInteractiveWidgets) {
        w.visible = active;
        if (w instanceof TextInput) {
          (w as TextInput).disabled = !active;
        }
      }
    });
    // Focus the first TextInput of the now-active section.
    const firstInput = SECTIONS[idx]?.rows[0]?.input
      ?? (SECTIONS[idx]?.extraItems.find((w) => w instanceof TextInput) as TextInput | undefined);
    if (firstInput) fm.focus(firstInput);
  });
});

// ─── Navigation ────────────────────────────────────────────────────────────

const router = new EventRouter({ screen, input: process.stdin, output: process.stdout });

const unsubKey = router.onKey((event) => {
  if (event.ctrl && event.key === "c") {
    shutdown();
    return;
  }
  const n = SECTIONS.length;
  if (event.key === "pageup") {
    state.prev(n);
    // Focus first input of new section (visibility autorun already ran).
    const sec = SECTIONS[state.sectionIdx]!;
    const first = sec.rows[0]?.input
      ?? (sec.extraItems.find((w) => w instanceof TextInput) as TextInput | undefined);
    if (first) fm.focus(first);
  } else if (event.key === "pagedown") {
    state.next(n);
    const sec = SECTIONS[state.sectionIdx]!;
    const first = sec.rows[0]?.input
      ?? (sec.extraItems.find((w) => w instanceof TextInput) as TextInput | undefined);
    if (first) fm.focus(first);
  }
});

// ─── Lifecycle ─────────────────────────────────────────────────────────────

function shutdown(): void {
  unsubKey();
  disposeVisibility();
  router.stop();
  screen.stop();
  process.stdout.write("\x1b[?1049l"); // leave alt screen
  process.stdout.write("\x1b[1;36mGoodbye!\x1b[0m\n");
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

// Mount all, enter alt screen, start.
screen.mount(...mountList);
process.stdout.write("\x1b[?1049h"); // enter alt screen
process.stdout.write("\x1b[H");       // move cursor to top-left
screen.start();
router.start();
