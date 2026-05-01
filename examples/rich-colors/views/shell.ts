import {
  Layout,
  Panel,
  RichText,
  Rule,
  Style,
  ColorSpec,
  ROUNDED,
  HEAVY,
} from "../../../src/index.js";
import { AppState, colorToHex } from "../state.js";

/**
 * Build the main application layout.
 *
 * [LAW:dataflow-not-control-flow] The same render executes every frame.
 * All logic is data-driven: focus state determines styling, palette mode
 * determines which palette is displayed, input mode determines which
 * instructions appear. No conditionals on "should I render X" — render
 * everything, let the data decide how it appears.
 */
export function buildShell(state: AppState): Layout {
  const root = new Layout();

  // Header (1 row) - title
  const headerLayout = new Layout(buildHeader(), { size: 1, name: "header" });

  // Content area (dynamic height) - main UI
  const contentLayout = new Layout(undefined, { name: "content", ratio: 1 });

  // Footer (1 row) - keybindings + status
  const footerLayout = new Layout(buildStatusBar(state), { size: 1, name: "footer" });

  // Vertical split: header / content / footer
  root.splitColumn(headerLayout, contentLayout, footerLayout);

  // Within content: left side (input/colors) and right side (palettes)
  const inputLayout = new Layout(buildInputPanel(state), { size: 30, name: "input" });
  const palettesLayout = new Layout(
    buildPalettesSection(state),
    { ratio: 1, name: "palettes" }
  );

  contentLayout.splitRow(inputLayout, palettesLayout);

  return root;
}

/**
 * Build the header section.
 */
function buildHeader(): RichText {
  const header = new RichText("💫 rich-colors");
  header.stylize("bold cyan");
  return header;
}

/**
 * Build the input filtering panel (left side).
 */
function buildInputPanel(state: AppState): Panel {
  const layout = new Layout();

  // Input field display
  const inputField = buildInputField(state);

  // Filtered color list
  const colorList = buildFilteredColorList(state);

  // Options (color system, theme)
  const optionsSection = buildOptionsSection(state);

  layout.splitColumn(
    new Layout(inputField, { size: 4, name: "input-field" }),
    new Layout(colorList, { ratio: 1, name: "color-list" }),
    new Layout(new Rule(), { size: 1 }),
    new Layout(optionsSection, { size: 8, name: "options" })
  );

  // Apply styling based on focus for color_system and theme
  const isSysOrThemeFocused =
    state.focus === "color_system" || state.focus === "theme";
  const focusLabel =
    state.focus === "color_system" ? " ◄ ColorSpec System" :
    state.focus === "theme" ? " ◄ Theme" : "";

  const titleText = new RichText("ColorSpec Input" + focusLabel);
  if (isSysOrThemeFocused) titleText.stylize("bold cyan");
  else titleText.stylize("dim");

  return new Panel(layout, {
    title: titleText,
    padding: [0, 1],
    box: isSysOrThemeFocused ? HEAVY : ROUNDED,
  });
}

/**
 * Build the input field display.
 */
function buildInputField(state: AppState): RichText {
  const content = new RichText();

  if (state.mode === "inputting") {
    // Show input with cursor
    const inputText = new RichText(`${state.inputFilter}_`);
    inputText.stylize("bold cyan");
    content.append(inputText);
    content.append("\n");
    content.append(new RichText("↑↓ navigate • Enter confirm • Esc cancel").stylize("dim"));
  } else {
    // Show base color info
    if (state.baseColor) {
      // Show a large swatch of the base color
      const hex = colorToHex(state.baseColor);
      const swatch = new RichText(`  ${hex}  `, { end: "" });
      swatch.stylize(new Style({ bgcolor: state.baseColor, color: Color.parse("white"), bold: true }));
      content.append(swatch);
      content.append("\n");
      content.append(new RichText(`Press / to change`).stylize("dim"));
    } else {
      const prompt = new RichText("Press / to enter a color");
      prompt.stylize("dim yellow");
      content.append(prompt);
    }
  }

  return content;
}

/**
 * Build the filtered color list.
 */
function buildFilteredColorList(state: AppState): RichText {
  const content = new RichText();

  if (state.mode !== "inputting") {
    content.append(new RichText("(no colors shown)").stylize("dim"));
    return content;
  }

  if (state.filteredColorNames.length === 0) {
    content.append(new RichText("No matching colors").stylize("dim yellow"));
    return content;
  }

  for (let i = 0; i < state.filteredColorNames.length; i++) {
    const name = state.filteredColorNames[i]!;
    const isSelected = i === state.filteredColorIndex;
    const indicator = isSelected ? "▶ " : "  ";
    content.append(indicator);
    // Show a colored swatch block next to each color name
    try {
      const c = Color.parse(name);
      const swatch = new RichText("  ", { end: "" });
      swatch.stylize(new Style({ bgcolor: c }));
      content.append(swatch);
      content.append(" ");
    } catch {
      content.append("   ");
    }
    const nameText = new RichText(name, { end: "" });
    if (isSelected) nameText.stylize("bold reverse");
    content.append(nameText);
    content.append("\n");
  }
  return content;
}

/**
 * Build the options section (color system + theme).
 */
function buildOptionsSection(state: AppState): RichText {
  const content = new RichText();

  // ColorSpec system
  content.append(new RichText("[ColorSpec System]").stylize("bold dim"));
  content.append("\n");

  const systems = ["truecolor", "256", "16", "windows"];
  for (const sys of systems) {
    const isActive = sys === state.colorSystemMode;
    const line = isActive ? `▶ ${sys}` : `  ${sys}`;
    content.append(line + "\n");
  }

  content.append("\n");
  content.append(new RichText("[Theme]").stylize("bold dim"));
  content.append("\n");

  // Theme
  const themeName = "default"; // Simplified for now
  content.append(`▶ ${themeName}\n`);

  return content;
}

/**
 * Build the palettes section (right side) showing all 8 modes simultaneously.
 */
function buildPalettesSection(state: AppState): Panel {
  if (!state.baseColor) {
    const msg = new RichText("Enter a color to see palettes");
    msg.stylize("dim yellow");
    const isFocused = state.focus === "palette_grid";
    const titleText = new RichText("Palettes " + (isFocused ? "◄ FOCUSED" : ""));
    if (isFocused) titleText.stylize("bold cyan");
    else titleText.stylize("dim");
    return new Panel(msg, {
      title: titleText,
      padding: [1, 1],
      box: isFocused ? HEAVY : ROUNDED,
    });
  }

  const layout = new Layout();

  // Show all 8 palettes in a 2×4 grid layout
  const modes = [
    "complementary",
    "analogous",
    "triadic",
    "tetradic",
    "square",
    "monochromatic",
    "shades",
    "tints",
  ];

  // Split into 2 columns of 4 rows each for 2×4 grid
  const col1Layouts: Layout[] = [];
  const col2Layouts: Layout[] = [];

  for (let i = 0; i < 4; i++) {
    const mode = modes[i]!;
    const paletteDisplay = buildPaletteGridItem(state, mode);
    col1Layouts.push(new Layout(paletteDisplay, { ratio: 1 }));
  }

  for (let i = 4; i < 8; i++) {
    const mode = modes[i]!;
    const paletteDisplay = buildPaletteGridItem(state, mode);
    col2Layouts.push(new Layout(paletteDisplay, { ratio: 1 }));
  }

  const col1 = new Layout();
  col1.splitColumn(...col1Layouts);

  const col2 = new Layout();
  col2.splitColumn(...col2Layouts);

  layout.splitRow(
    new Layout(col1, { ratio: 1, name: "col1" }),
    new Layout(col2, { ratio: 1, name: "col2" })
  );

  const isFocused = state.focus === "palette_grid";
  const titleText = new RichText("All Palettes " + (isFocused ? "◄ FOCUSED" : ""));
  if (isFocused) titleText.stylize("bold cyan");
  else titleText.stylize("dim");

  return new Panel(layout, {
    title: titleText,
    padding: [0, 0],
    box: isFocused ? HEAVY : ROUNDED,
  });
}

/**
 * Build a single palette grid item showing name and color swatches.
 */
function buildPaletteGridItem(state: AppState, mode: string): RichText {
  const palette = state.allPalettes[mode as keyof typeof state.allPalettes];
  const isSelected = mode === state.selectedPaletteMode;

  const content = new RichText();

  // Title with selection indicator
  const modeLabel = new RichText(isSelected ? `▶ ${mode}` : `  ${mode}`);
  if (isSelected) {
    modeLabel.stylize("bold cyan");
  } else {
    modeLabel.stylize("dim");
  }
  content.append(modeLabel);

  if (!palette || palette.length === 0) {
    content.append("\n");
    content.append(new RichText("—").stylize("dim"));
    return content;
  }

  // Show color swatches with actual background colors
  const colorsToShow = Math.min(palette.length, 6);

  content.append("\n");
  for (let i = 0; i < colorsToShow; i++) {
    const color = palette[i]!;
    const hex = colorToHex(color);
    // Colored block using the palette color as background
    const blockStyle = new Style({ bgcolor: color, color: Color.parse("white"), bold: true });
    const block = new RichText(`  ${hex}  `, { end: "" });
    block.stylize(blockStyle);
    content.append(block);
    content.append(" ", "default");
  }

  // Show count if truncated
  if (palette.length > colorsToShow) {
    content.append("\n");
    const moreText = new RichText(`+${palette.length - colorsToShow} more`);
    moreText.stylize("dim");
    content.append(moreText);
  }

  return content;
}

/**
 * Build the status bar (footer).
 */
function buildStatusBar(state: AppState): RichText {
  const footer = new RichText();

  if (state.mode === "inputting") {
    footer.append("Filtering colors • ↑↓ to navigate • Enter to select • Esc to cancel");
    footer.stylize("yellow dim");
  } else {
    // Show focus target and context-specific actions
    let actionHint = "";
    let focusLabel = "";

    switch (state.focus) {
      case "palette_grid":
        focusLabel = "🎨 Palette Grid";
        actionHint = "↑ ↓ switch palette • ← → pick color • Enter show • Tab move focus";
        break;
      case "color_system":
        focusLabel = "🎚️  ColorSpec System";
        actionHint = "← → cycle system • Tab move focus • / input • q quit";
        break;
      case "theme":
        focusLabel = "🎭 Theme";
        actionHint = "← → cycle theme • Tab move focus • / input • q quit";
        break;
    }

    const focusText = new RichText(focusLabel);
    focusText.stylize("bold cyan");
    footer.append(focusText);

    footer.append(" • ");
    footer.append(actionHint);
    footer.stylize("dim");

    if (state.statusMessage) {
      footer.append(" | ");
      const msgText = new RichText(state.statusMessage);
      msgText.stylize("yellow");
      footer.append(msgText);
    }
  }

  return footer;
}
