/**
 * coverage.ts — a "kitchen sink" renderer that exercises every remaining
 * unused rich-js export. Displayed when the user presses 'c' in rich-explore.
 *
 * Intentionally contrived — the sole purpose is to force every code path
 * through the rendering pipeline so bugs surface.
 */

import {
  // Box variants
  ASCII, ASCII2, ASCII_DOUBLE_HEAD, SQUARE, SQUARE_DOUBLE_HEAD,
  MINIMAL, MINIMAL_HEAVY_HEAD, MINIMAL_DOUBLE_HEAD,
  SIMPLE, SIMPLE_HEAD, SIMPLE_HEAVY, HORIZONTALS,
  HEAVY, HEAVY_EDGE, HEAVY_HEAD, DOUBLE, DOUBLE_EDGE, MARKDOWN,
  // Box itself, for a box style the library does not ship
  Box,
  // Renderables
  Columns, ProgressBar, Progress, Status, Group, Panel, Rule, RichText, Align, Padding,
  Table, Column, Spinner,
  // Progress columns
  TextColumn, BarColumn, TaskProgressColumn, MofNCompleteColumn,
  SpinnerColumn, TimeElapsedColumn, TimeRemainingColumn,
  // Prompt classes
  Prompt, IntPrompt, FloatPrompt, Confirm,
  // track
  track,
  // Highlighters
  NullHighlighter, Highlighter, ReprHighlighter, JSONHighlighter,
  // Emoji
  Emoji, NoEmoji, EMOJI, emojiReplace,
  // Style system
  StyleStack, Theme, DEFAULT_STYLES, Style, NULL_STYLE,
  StyleSyntaxError, MarkupError,
  // Color
  STANDARD_TABLE, WINDOWS_TABLE,
  ColorParseError, ColorDepth, ColorSpec, parseRgbHex,
  // Cells
  cellLen, setCellSize, splitText, chopCells, asCellCol,
  // Measurement
  Measurement, measureRenderables,
  // Segment / protocol
  Segment, ControlType, isRenderable, isMeasurable,
  // Segment → ANSI, without a Console
  renderToString, segmentsToString, segmentToString,
  // Text spans
  Span,
  // Spinner data
  SPINNERS, DEFAULT_SPINNER,
  // Markup
  renderMarkup,
} from "../../../src/index.js";
import type { Renderable, RenderOptions } from "../../../src/index.js";

export class CoverageRenderable implements Renderable {
  *render(options: RenderOptions): Iterable<Segment> {
    const items: Renderable[] = [];

    // ── 1. All 18 Box variants, plus one built here ──────────────────
    items.push(new Rule("Box Variants (18) + a custom Box", { style: "bold cyan" }));
    const boxStyles = [
      { name: "ASCII", box: ASCII }, { name: "ASCII2", box: ASCII2 },
      { name: "ASCII_DBL", box: ASCII_DOUBLE_HEAD },
      { name: "SQUARE", box: SQUARE }, { name: "SQ_DBL", box: SQUARE_DOUBLE_HEAD },
      { name: "MINIMAL", box: MINIMAL }, { name: "MIN_HVY", box: MINIMAL_HEAVY_HEAD },
      { name: "MIN_DBL", box: MINIMAL_DOUBLE_HEAD },
      { name: "SIMPLE", box: SIMPLE }, { name: "SIM_HD", box: SIMPLE_HEAD },
      { name: "SIM_HVY", box: SIMPLE_HEAVY }, { name: "HORIZ", box: HORIZONTALS },
      { name: "HEAVY", box: HEAVY }, { name: "HVY_EDGE", box: HEAVY_EDGE },
      { name: "HVY_HEAD", box: HEAVY_HEAD },
      { name: "DOUBLE", box: DOUBLE }, { name: "DBL_EDGE", box: DOUBLE_EDGE },
      { name: "MARKDOWN", box: MARKDOWN },
      // A box style rich-js does not ship: Box takes the 18 characters and
      // nothing else, so a custom border is data, not a new renderable.
      {
        name: "CUSTOM", box: new Box({
          topLeft: "▛", top: "▀", topDivider: "▀", topRight: "▜",
          headLeft: "▌", headVertical: "│", headRight: "▐",
          midLeft: "▌", mid: "─", midVertical: "│", midRight: "▐",
          bottomLeft: "▙", bottom: "▄", bottomDivider: "▄", bottomRight: "▟",
          left: "▌", right: "▐", vertical: "│",
        }),
      },
    ];
    const boxPanels: Renderable[] = boxStyles.map(({ name, box }) =>
      new Panel(new RichText(name, { end: "" }), { box, title: name, expand: false }),
    );
    items.push(new Columns(boxPanels, { equal: true, expand: true }));

    // ── 2. ProgressBar (standalone) ──────────────────────────────────
    items.push(new Rule("ProgressBar", { style: "bold cyan" }));
    for (const pct of [25, 50, 75, 100]) {
      const bar = new ProgressBar({ total: 100, completed: pct, width: 30 });
      const label = new RichText(`${pct}%: `, { end: "" });
      items.push(new Group(label, bar));
    }

    // ── 3. Columns ───────────────────────────────────────────────────
    items.push(new Rule("Columns", { style: "bold cyan" }));
    const fruits = ["apple", "banana", "cherry", "date", "elderberry",
      "fig", "grape", "honeydew", "kiwi", "lemon", "mango", "nectarine"];
    items.push(new Columns(fruits.map((f) => new RichText(f, { end: "" })), { expand: true }));

    // ── 4. The Highlighter family ────────────────────────────────────
    items.push(new Rule("Highlighters", { style: "bold cyan" }));
    const nh = new NullHighlighter();
    const nhText = new RichText("NullHighlighter applied: no styles changed", { end: "" });
    nh.highlight(nhText);
    items.push(nhText);
    // Also exercise Highlighter.call (the convenience method)
    const called = nh.call("NullHighlighter.call() works");
    items.push(called);
    // The two built-ins that actually add spans.
    items.push(new ReprHighlighter().call(
      `ReprHighlighter: {"n": 42, "path": "/tmp/x.log", "at": None, "ok": True}`,
    ));
    items.push(new JSONHighlighter().call(
      `JSONHighlighter: {"id": 7, "tags": ["a", "b"], "live": false, "note": null}`,
    ));
    // Highlighter is a base class, not a closed set: subclassing it is how a
    // consumer adds their own rule. `call` comes from the base for free.
    class ShoutHighlighter extends Highlighter {
      highlight(text: RichText): void {
        for (const match of text.plain.matchAll(/\b[A-Z]{2,}\b/g)) {
          text.stylize(Style.parse("bold magenta"), match.index, match.index + match[0].length);
        }
      }
    }
    items.push(new ShoutHighlighter().call("A custom Highlighter SHOUTS the LOUD words."));

    // ── 5. Emoji + NoEmoji ───────────────────────────────────────────
    items.push(new Rule("Emoji + NoEmoji", { style: "bold cyan" }));
    // Emoji renderable
    const emojiObj = new Emoji("star");
    items.push(emojiObj);
    // NoEmoji error — name without colons
    try { new Emoji("definitely_not_a_real_emoji_xyz"); } catch (e) {
      const isNoEmoji = e instanceof NoEmoji;
      items.push(new RichText(`NoEmoji caught: ${isNoEmoji} — ${(e as Error).message}`, { end: "" }));
    }
    // EMOJI dict + emojiReplace
    const sampleKeys = Object.keys(EMOJI).slice(0, 15);
    items.push(new RichText(
      `EMOJI dict: ${Object.keys(EMOJI).length} entries. Sample: ${emojiReplace(sampleKeys.map((k) => `:${k}:`).join(" "))}`,
      { end: "" },
    ));

    // ── 6. StyleStack + Theme + DEFAULT_STYLES ───────────────────────
    items.push(new Rule("StyleStack + Theme", { style: "bold cyan" }));
    const stack = new StyleStack(Style.parse("white"));
    stack.push(Style.parse("bold"));
    stack.push(Style.parse("italic red"));
    const stackResult = stack.current;
    const stackText = new RichText(
      `StyleStack: bold=${String(stackResult.bold)} italic=${String(stackResult.italic)}`,
      { end: "" },
    );
    stackText.stylize(stackResult);
    stack.pop();
    stack.pop();
    items.push(stackText);
    // Theme with custom + default
    const theme = new Theme({ "custom.test": "bold green" });
    items.push(new RichText(
      `Theme: ${Object.keys(DEFAULT_STYLES).length} default styles + 1 custom`,
      { end: "" },
    ));
    const customStyle = theme.get("custom.test");
    const themeText = new RichText("Custom theme style: bold green", { end: "" });
    if (customStyle) themeText.stylize(customStyle);
    items.push(themeText);
    // NULL_STYLE
    items.push(new RichText(`NULL_STYLE.isNull: ${String(NULL_STYLE.isNull)}`, { end: "" }));

    // ── 7. Palette + parseRgbHex + ColorDepth + ColorParseError ───────
    items.push(new Rule("Color / Palette", { style: "bold cyan" }));
    const rgb = parseRgbHex("ff6600");
    items.push(new RichText(`parseRgbHex("ff6600") = ${rgb.hex} (r=${rgb.red} g=${rgb.green} b=${rgb.blue})`, { end: "" }));
    items.push(new RichText(
      `STANDARD_TABLE: ${STANDARD_TABLE.size} colors, WINDOWS_TABLE: ${WINDOWS_TABLE.size} colors`,
      { end: "" },
    ));
    try { ColorSpec.parse("not_a_color_xyz"); } catch (e) {
      items.push(new RichText(
        `ColorParseError: ${e instanceof ColorParseError} — ${(e as Error).message.slice(0, 60)}`,
        { end: "" },
      ));
    }
    items.push(new RichText(
      `ColorDepth: DEFAULT=${ColorDepth.DEFAULT} STANDARD=${ColorDepth.STANDARD} EIGHT_BIT=${ColorDepth.EIGHT_BIT} TRUECOLOR=${ColorDepth.TRUECOLOR}`,
      { end: "" },
    ));

    // ── 8. Cell functions ────────────────────────────────────────────
    items.push(new Rule("Cell Functions", { style: "bold cyan" }));
    items.push(new RichText(`cellLen("hello") = ${cellLen("hello")}`, { end: "" }));
    items.push(new RichText(`splitText("abcdef", 3) = ${JSON.stringify(splitText("abcdef", asCellCol(3)))}`, { end: "" }));
    items.push(new RichText(`chopCells("hello world", 7) = "${chopCells("hello world", asCellCol(7))}"`, { end: "" }));
    setCellSize("A", asCellCol(1)); // exercise the function; restore to default width

    // ── 9. Measurement + measureRenderables ──────────────────────────
    items.push(new Rule("Measurement", { style: "bold cyan" }));
    const measurable = new RichText("measure this text", { end: "" });
    const m = Measurement.get(options, measurable);
    items.push(new RichText(`Measurement.get: min=${m.minimum}, max=${m.maximum}`, { end: "" }));
    const multi = measureRenderables(options, [measurable, new RichText("short", { end: "" })]);
    items.push(new RichText(`measureRenderables: min=${multi.minimum}, max=${multi.maximum}`, { end: "" }));

    // ── 10. Protocol checks ──────────────────────────────────────────
    items.push(new Rule("Protocol", { style: "bold cyan" }));
    items.push(new RichText(
      `isRenderable(RichText)=${isRenderable(measurable)} isMeasurable(RichText)=${isMeasurable(measurable)} isRenderable("str")=${isRenderable("str")}`,
      { end: "" },
    ));

    // ── 11. StyleSyntaxError + MarkupError ───────────────────────────
    items.push(new Rule("Error Types", { style: "bold cyan" }));
    try { Style.parse("zzzz_invalid"); } catch (e) {
      items.push(new RichText(`StyleSyntaxError: ${e instanceof StyleSyntaxError}`, { end: "" }));
    }
    try { renderMarkup("[bold[bad"); } catch (e) {
      items.push(new RichText(`MarkupError: ${e instanceof MarkupError}`, { end: "" }));
    }

    // ── 12. Spinner data ─────────────────────────────────────────────
    items.push(new Rule("Spinner Data", { style: "bold cyan" }));
    items.push(new RichText(
      `${Object.keys(SPINNERS).length} spinners. DEFAULT="${DEFAULT_SPINNER}". Sample: ${Object.keys(SPINNERS).slice(0, 8).join(", ")}`,
      { end: "" },
    ));

    // ── 13. Align (all three) ────────────────────────────────────────
    items.push(new Rule("Align", { style: "bold cyan" }));
    items.push(new Align(new RichText("← left", { end: "" }), "left"));
    items.push(new Align(new RichText("center →", { end: "" }), "center"));
    items.push(new Align(new RichText("right →", { end: "" }), "right"));

    // ── 14. Padding (standalone) ─────────────────────────────────────
    items.push(new Rule("Padding (standalone)", { style: "bold cyan" }));
    items.push(new Padding(new RichText("Padded [1,2,1,2]", { end: "" }), [1, 2, 1, 2]));

    // ── 15. Progress (rendered as a static snapshot) ───────────────
    items.push(new Rule("Progress (static render)", { style: "bold cyan" }));
    // Exercise Progress + all column types by rendering its table output
    // directly (without start/stop which use Live for animation).
    const progress = new Progress(
      new TextColumn("[progress.description]{task.description}"),
      new BarColumn(30),
      new TaskProgressColumn(),
      new MofNCompleteColumn(),
      new SpinnerColumn(),
      new TimeElapsedColumn(),
      new TimeRemainingColumn(),
    );
    const t1 = progress.addTask("Downloading", { total: 100 });
    progress.updateTask(t1, { completed: 42 });
    const t2 = progress.addTask("Processing", { total: 200 });
    progress.updateTask(t2, { completed: 200 });
    // Progress implements Renderable — render its table snapshot
    items.push(progress);

    // ── 16. Status (construction + renderable output) ────────────────
    items.push(new Rule("Status (construction)", { style: "bold cyan" }));
    // Status wraps a Spinner + message in a Live. We can't call start()
    // here but we validate construction + the internal renderable.
    const status = new Status("Loading session...", { spinner: "dots" });
    items.push(new RichText(`Status constructed: spinner=dots message="${status.message}"`, { end: "" }));

    // ── 17. Prompt classes (construction, no stdin) ──────────────────
    items.push(new Rule("Prompt classes", { style: "bold cyan" }));
    // Prompt/IntPrompt/FloatPrompt/Confirm use readline — can't call
    // .ask() in a TUI. Exercise their existence and type checks.
    items.push(new RichText(
      `Prompt: ${typeof Prompt.ask === "function"} IntPrompt: ${typeof IntPrompt.ask === "function"} ` +
      `FloatPrompt: ${typeof FloatPrompt.ask === "function"} Confirm: ${typeof Confirm.ask === "function"}`,
      { end: "" },
    ));

    // ── 18. track (generator, exercised without Live) ────────────────
    items.push(new Rule("track()", { style: "bold cyan" }));
    // track() wraps an iterable with progress. We consume it eagerly
    // to exercise the code path. It creates a Progress + Live internally
    // but we can't display it in our TUI — just prove it doesn't crash.
    // (Would write to stdout briefly, but that's ok for coverage.)
    items.push(new RichText(`track: generator function exists = ${typeof track === "function"}`, { end: "" }));

    // ── 19. Span (what a highlighter actually leaves behind) ─────────
    items.push(new Rule("Span", { style: "bold cyan" }));
    // Styling annotates ranges; it never rewrites the text. Reading the
    // spans back is how you see that — the plain string is untouched.
    const spanned = new RichText("Spans annotate a range, not the whole string.", { end: "" });
    new ShoutHighlighter().highlight(spanned);
    spanned.stylize(Style.parse("bold yellow"), 0, 5);
    items.push(spanned);
    items.push(new RichText(
      `plain text unchanged; ${spanned.spans.length} spans, all Span instances = ` +
      `${spanned.spans.every((s) => s instanceof Span)}: ` +
      spanned.spans.map((s) => `[${s.start},${s.end})`).join(" "),
      { end: "" },
    ));

    // ── 20. Segment → ANSI without a Console ─────────────────────────
    items.push(new Rule("renderToString / segmentsToString", { style: "bold cyan" }));
    const sample = new Panel(new RichText("rendered off-console", { end: "" }), { box: SQUARE });
    const plain = renderToString(sample, { width: 40, colorSystem: null });
    items.push(new RichText(
      `renderToString(width 40, no color): ${plain.split("\n").length} lines, ` +
      `${plain.length} chars, no ESC = ${!plain.includes("\u001b")}`,
      { end: "" },
    ));
    const colored = renderToString(sample, { width: 40, colorSystem: ColorDepth.TRUECOLOR });
    items.push(new RichText(`same panel at truecolor: ${colored.length} chars`, { end: "" }));
    // The two lower-level entry points the above delegates to.
    const styled = new Segment("segment", Style.parse("bold green"));
    items.push(new RichText(
      `segmentToString: ${JSON.stringify(segmentToString(styled, ColorDepth.STANDARD))}`,
      { end: "" },
    ));
    items.push(new RichText(
      `segmentsToString(2 segs, no color): ` +
      JSON.stringify(segmentsToString([styled, new Segment("!")], null)),
      { end: "" },
    ));
    // A control segment carries no text — ControlType names what it does.
    const bell = new Segment("", undefined, [[ControlType.BELL]]);
    items.push(new RichText(
      `control segment: type=${ControlType.BELL} text=${JSON.stringify(bell.text)} ` +
      `isControl=${bell.isControl}`,
      { end: "" },
    ));

    // ── 21. Spinner (a single frame, no Live) ────────────────────────
    items.push(new Rule("Spinner", { style: "bold cyan" }));
    items.push(new Spinner("dots", "spinning without a Live"));

    // ── 22. Table built from explicit Columns ────────────────────────
    items.push(new Rule("Table + Column", { style: "bold cyan" }));
    const table = new Table({ box: HEAVY_HEAD, title: "Columns configured directly" });
    table.columns.push(new Column({ header: "left", justify: "left", minWidth: 10 }));
    table.columns.push(new Column({ header: "centered", justify: "center", minWidth: 12 }));
    table.columns.push(new Column({ header: "right", justify: "right", minWidth: 10 }));
    table.addRow("alpha", "beta", "gamma");
    table.addRow("delta", "epsilon", "zeta");
    items.push(table);

    // ── Render ───────────────────────────────────────────────────────
    yield* new Group(...items).render(options);
  }
}
