/**
 * Template Bindings Demo — comprehensive showcase of @promptctl/go-template-js
 * integration with rich-js styling.
 *
 * Covers: text attributes, named/generic colors, backgrounds, composition,
 * hyperlinks, palette functions, modifiers, auto-contrast, theme gallery,
 * and a realistic CI build report rendered from a Go template.
 */

import { Console, RichText, Style, Rule, Panel, Table, Group } from "../../src/index.js";
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

// engine.compile(tmpl)(scope) returns T[] — join all fragments into one RichText.
// applyStyleToFragment stores styling in _style (base style), which RichText.append
// does not transfer. We encode _style as a span FIRST, then add specific spans after,
// so span-level styles win over the base on conflict (_buildSegments applies spans in
// order and the last .add wins).
function exec(engine: Engine<RichText>, tmpl: string): RichText {
  const frags = engine.compile(tmpl)({});
  const out = new RichText("", { end: "" });
  for (const f of frags) {
    const start = out.length;
    out.append(f.plain);
    if (!f.style.isNull) {
      out.stylize(f.style, start, out.length);
    }
    for (const span of f.spans) {
      out.stylize(span.style, start + span.start, start + span.end);
    }
  }
  return out;
}

// ─── Console + layout helpers ──────────────────────────────────────────────

const con = new Console({ forceTerminal: true });

function section(title: string): void {
  con.print(new RichText(""));
  con.print(new Rule(title, { style: Style.parse("bold cyan") }));
  con.print(new RichText(""));
}

function row(label: string, content: RichText): void {
  // Use append(text, style) so dim is a span, not a base style — prevents dim from
  // bleeding into content via _buildSegments base-style accumulation.
  const lbl = new RichText("", { end: "" });
  lbl.append(`  ${label.padEnd(28)} `, Style.parse("dim"));
  con.print(lbl.append(content));
}

// ─── Section 0: Header ─────────────────────────────────────────────────────

{
  const title = new RichText("  @promptctl/rich-js  ·  Template Bindings  ", {
    style: Style.parse("bold"),
    end: "",
  });
  const subtitle = new RichText("  Go template syntax → rich terminal styling  ", {
    style: Style.parse("dim"),
    end: "",
  });
  con.print(
    new Panel(new Group(title, new RichText(""), subtitle), {
      borderStyle: Style.parse("bold cyan"),
      expand: false,
      padding: [1, 2],
    }),
  );
}

// ─── Section 1: Text Attributes ────────────────────────────────────────────

section("Text Attributes");

row(
  "canonical names",
  exec(
    styleEngine,
    `{{ bold "bold" }}  {{ dim "dim" }}  {{ italic "italic" }}  ` +
    `{{ underline "underline" }}  {{ strike "strike" }}  {{ overline "overline" }}  ` +
    `{{ reverse "reverse" }}  {{ blink "blink" }}`,
  ),
);

row(
  "short aliases",
  exec(styleEngine, `{{ b "b" }}  {{ i "i" }}  {{ u "u" }}  {{ s "s" }}`),
);

row(
  "negation",
  exec(styleEngine, `{{ not_bold (bold "un-bolded") }}  ← outer not_bold overrides inner bold`),
);

// ─── Section 2: Named Foreground Colors ────────────────────────────────────

section("Foreground Colors — Named");

row(
  "standard 8",
  exec(
    styleEngine,
    `{{ black "black" }}  {{ red "red" }}  {{ green "green" }}  {{ yellow "yellow" }}  ` +
    `{{ blue "blue" }}  {{ magenta "magenta" }}  {{ cyan "cyan" }}  {{ white "white" }}`,
  ),
);

row(
  "bright 8",
  exec(
    styleEngine,
    `{{ bright_black "br_black" }}  {{ bright_red "br_red" }}  ` +
    `{{ bright_green "br_green" }}  {{ bright_yellow "br_yellow" }}  ` +
    `{{ bright_blue "br_blue" }}  {{ bright_magenta "br_mag" }}  ` +
    `{{ bright_cyan "br_cyan" }}  {{ bright_white "br_white" }}`,
  ),
);

con.print(new RichText("  256-color ramp:", { style: Style.parse("dim") }));
for (let base = 0; base < 256; base += 86) {
  const end = Math.min(base + 86, 256);
  const tmpl = Array.from({ length: end - base }, (_, i) => `{{ color ${base + i} "█" }}`).join("");
  con.print(exec(styleEngine, "  " + tmpl));
}

// ─── Section 3: Generic Color Forms ────────────────────────────────────────

section("Foreground Colors — Generic Forms");

row("hex #ff6b6b",          exec(styleEngine, `{{ hex "#ff6b6b" "coral red" }}`));
row("rgb 255 107 107",      exec(styleEngine, `{{ rgb 255 107 107 "coral red" }}`));
row("color 203 (256-index)", exec(styleEngine, `{{ color 203 "coral red" }}`));
row("light_coral (named)",  exec(styleEngine, `{{ light_coral "coral red" }}`));

// ─── Section 4: Background Colors ──────────────────────────────────────────

section("Background Colors — on()");

row(
  "named colors",
  exec(
    styleEngine,
    `{{ bright_white (on "red" " red ") }}  ` +
    `{{ bright_white (on "green" " green ") }}  ` +
    `{{ bright_white (on "blue" " blue ") }}  ` +
    `{{ bright_white (on "magenta" " magenta ") }}  ` +
    `{{ bright_white (on "cyan" " cyan ") }}  ` +
    `{{ black (on "yellow" " yellow ") }}  ` +
    `{{ black (on "white" " white ") }}`,
  ),
);

row(
  "hex + named 256",
  exec(
    styleEngine,
    `{{ bright_white (on "#ff6b6b" " #ff6b6b ") }}  ` +
    `{{ bright_white (on "#2d4f67" " #2d4f67 ") }}  ` +
    `{{ bright_white (on "navy_blue" " navy_blue ") }}  ` +
    `{{ black (on "light_coral" " light_coral ") }}`,
  ),
);

// ─── Section 5: Composition ─────────────────────────────────────────────────

section("Composition");

{
  const table = new Table({ borderStyle: Style.parse("dim") });
  table.addColumn("Template", { style: Style.parse("dim"), noWrap: true });
  table.addColumn("Rendered");

  const pairs: Array<[string, string]> = [
    [
      '{{ bold (red "alert!") }}',
      `{{ bold (red "alert!") }}`,
    ],
    [
      '{{ italic (on "navy_blue" (bright_white "deep sea")) }}',
      `{{ italic (on "navy_blue" (bright_white "deep sea")) }}`,
    ],
    [
      '{{ underline (hex "#ff6b6b" (bold "alarm!")) }}',
      `{{ underline (hex "#ff6b6b" (bold "alarm!")) }}`,
    ],
    [
      '{{ dim (strike "deprecated") }}',
      `{{ dim (strike "deprecated") }}`,
    ],
    [
      '{{ reverse (cyan "flipped") }}',
      `{{ reverse (cyan "flipped") }}`,
    ],
    [
      '{{ b (i (u "all three")) }}',
      `{{ b (i (u "all three")) }}`,
    ],
  ];

  for (const [label, tmpl] of pairs) {
    table.addRow(new RichText(label, { style: Style.parse("dim"), end: "" }), exec(styleEngine, tmpl));
  }
  con.print(table);
}

// ─── Section 6: Hyperlinks ──────────────────────────────────────────────────

section("Links — OSC 8 Hyperlinks");

con.print(
  exec(styleEngine, `  {{ link "https://github.com/anthropics/anthropic-sdk-python" (underline (cyan "Anthropic SDK")) }}`),
);
con.print(
  exec(styleEngine, `  {{ bold (link "https://rich.readthedocs.io" (green "Python Rich")) }}`),
);
con.print(
  exec(styleEngine, `  {{ link "https://github.com" (b (hex "#58a6ff" "GitHub")) }}`),
);
con.print(
  new RichText(
    "  Links are OSC 8 escape sequences — click them in a supporting terminal (iTerm2, Kitty, WezTerm).",
    { style: Style.parse("dim") },
  ),
);

// ─── Section 7: Palette Functions — DRACULA ────────────────────────────────

section("Palette Functions — DRACULA");

{
  const draculaEngine = makeEngine(DRACULA);

  row(
    "semantic colors",
    exec(
      draculaEngine,
      `{{ primary " primary " }}  {{ secondary " secondary " }}  ` +
      `{{ accent " accent " }}  {{ success " success " }}  ` +
      `{{ warning " warning " }}  {{ error " error " }}  ` +
      `{{ surface " surface " }}`,
    ),
  );

  row(
    "derived (palette func)",
    exec(
      draculaEngine,
      `{{ primary "primary" }}  ` +
      `{{ palette "primary-muted" "primary-muted" }}  ` +
      `{{ palette "text-primary" "text-primary" }}`,
    ),
  );

  row(
    "foreground / background",
    exec(
      draculaEngine,
      `{{ foreground "foreground" }}  {{ background "background" }}`,
    ),
  );
}

// ─── Section 8: Palette Modifiers — GRUVBOX ────────────────────────────────

section("Palette Modifiers — darken · lighten · alpha");

{
  const gruvboxEngine = makeEngine(GRUVBOX);
  const GRUVBOX_BG = "#282828";

  row(
    "darken gradient",
    exec(
      gruvboxEngine,
      `{{ primary "base" }}  ` +
      `{{ palette "primary-darken-1" "↓1" }}  ` +
      `{{ palette "primary-darken-2" "↓2" }}  ` +
      `{{ palette "primary-darken-3" "↓3" }}`,
    ),
  );

  row(
    "lighten gradient",
    exec(
      gruvboxEngine,
      `{{ primary "base" }}  ` +
      `{{ palette "primary-lighten-1" "↑1" }}  ` +
      `{{ palette "primary-lighten-2" "↑2" }}  ` +
      `{{ palette "primary-lighten-3" "↑3" }}`,
    ),
  );

  row(
    "alpha fade (accent over bg)",
    exec(
      gruvboxEngine,
      `{{ paletteOver "accent 25%" "${GRUVBOX_BG}" "█ 25%" }}  ` +
      `{{ paletteOver "accent 50%" "${GRUVBOX_BG}" "█ 50%" }}  ` +
      `{{ paletteOver "accent 75%" "${GRUVBOX_BG}" "█ 75%" }}  ` +
      `{{ paletteOver "accent 100%" "${GRUVBOX_BG}" "█ 100%" }}`,
    ),
  );
}

// ─── Section 9: Auto-Contrast ───────────────────────────────────────────────

section("Auto-Contrast — auto()");

{
  const autoEngine = makeEngine(TOKYO_NIGHT);
  const bgHexes = [
    "#000000", "#1a1a2e", "#2d6a4f", "#f4a261", "#e9c46a",
    "#ffffff", "#ffecd2", "#f8f9fa", "#495057", "#dee2e6",
  ];

  con.print(
    new RichText(
      "  Text color chosen automatically for WCAG contrast against each background.",
      { style: Style.parse("dim") },
    ),
  );

  const strip = exec(
    autoEngine,
    bgHexes.map((bg) => `{{ on "${bg}" (auto "${bg}" "  auto  ") }}`).join(" "),
  );
  con.print(new RichText("  ", { end: "" }).append(strip));
}

// ─── Section 10: Theme Gallery ──────────────────────────────────────────────

section("Theme Gallery — same template, 13 themes");

{
  const THEMES: Array<[string, TerminalTheme]> = [
    ["GRUVBOX",          GRUVBOX],
    ["DRACULA",          DRACULA],
    ["NORD",             NORD],
    ["TOKYO_NIGHT",      TOKYO_NIGHT],
    ["CATPPUCCIN_MOCHA", CATPPUCCIN_MOCHA],
    ["CATPPUCCIN_LATTE", CATPPUCCIN_LATTE],
    ["ROSE_PINE",        ROSE_PINE],
    ["ROSE_PINE_DAWN",   ROSE_PINE_DAWN],
    ["SOLARIZED_DARK",   SOLARIZED_DARK],
    ["SOLARIZED_LIGHT",  SOLARIZED_LIGHT],
    ["MONOKAI",          MONOKAI],
    ["FLEXOKI",          FLEXOKI],
    ["ATOM_ONE_DARK",    ATOM_ONE_DARK],
  ];

  const GALLERY_TMPL =
    `{{ bold (primary "Rich") }} {{ accent "template" }} ` +
    `{{ success "✓" }} {{ warning "!" }} {{ error "✗" }}`;

  for (const [name, theme] of THEMES) {
    const engine = makeEngine(theme);
    const label = new RichText("", { end: "" });
    label.append(`  ${name.padEnd(22)}`, Style.parse("dim"));
    const swatches = exec(
      engine,
      `{{ primary "██" }}{{ accent "██" }}{{ success "██" }}{{ warning "██" }}{{ error "██" }}`,
    );
    const sentence = exec(engine, "  " + GALLERY_TMPL);
    con.print(label.append(swatches).append(sentence));
  }
}

// ─── Section 11: Showcase — Build Report ───────────────────────────────────

section("Showcase — Build Report");

{
  const tokyoEngine = makeEngine(TOKYO_NIGHT);

  const REPORT_TMPL =
    `{{ bold (primary "BUILD REPORT") }}  {{ palette "surface" "·" }}  {{ dim "2026-05-10" }}

  {{ success "✓" }} {{ bold "Tests"    }}  {{ dim "8,627 passed" }}  {{ palette "success-muted" "(+32)" }}
  {{ error   "✗" }} {{ bold "Lint"     }}  {{ dim "2 errors" }}      {{ error "fix required" }}
  {{ warning "!" }} {{ bold "Coverage" }}  {{ dim "87.4%" }}          {{ warning "below 90% threshold" }}

  {{ dim "Artifacts:" }}  {{ link "https://example.com/dist" (underline (accent "dist/")) }}
                          {{ link "https://example.com/docs" (underline (accent "docs/")) }}

  {{ italic (dim "Powered by ") }}{{ link "https://github.com" (cyan "rich-js") }}{{ italic (dim " template bindings") }}`;

  const report = exec(tokyoEngine, REPORT_TMPL);
  con.print(
    new Panel(report, {
      borderStyle: Style.parse("bold cyan"),
      title: new RichText(" CI / CD ", { style: Style.parse("bold cyan"), end: "" }),
      padding: [1, 2],
    }),
  );
}

con.print(new RichText(""));
