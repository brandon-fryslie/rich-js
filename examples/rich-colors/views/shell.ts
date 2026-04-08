import {
  Layout,
  Panel,
  RichText,
  Rule,
  Style,
} from "../../../src/index.js";
import { AppState, colorToHex, visiblePaletteColors } from "../state.js";

/**
 * Build the main application layout.
 */
export function buildShell(state: AppState, termHeight: number): Layout {
  const root = new Layout();

  // Header (1 row) - compact title + mode indicator
  const headerLayout = new Layout(buildHeader(state), { size: 1, name: "header" });

  // Content area (dynamic height)
  const contentLayout = new Layout(undefined, { name: "content", ratio: 1 });

  // Footer (1 row) - keybindings + status
  const footerLayout = new Layout(buildStatusBar(state), { size: 1, name: "footer" });

  // Vertical split: header / content / footer
  root.splitColumn(headerLayout, contentLayout, footerLayout);

  // Within content area: horizontal split between controls and palette display
  const controlsHeight = state.showDetails ? Math.floor((termHeight - 3) * 0.4) : Math.floor((termHeight - 3) * 0.5);

  const controlsLayout = new Layout(buildControlsSection(state), { size: controlsHeight, name: "controls" });
  const paletteLayout = new Layout(buildPaletteSection(state), { ratio: 1, name: "palette" });

  if (state.showDetails) {
    const detailsLayout = new Layout(buildDetailsSection(state), { ratio: 1, name: "details" });
    contentLayout.splitColumn(controlsLayout, paletteLayout, detailsLayout);
  } else {
    contentLayout.splitColumn(controlsLayout, paletteLayout);
  }

  return root;
}

/**
 * Build the header section - compact single-row header.
 */
function buildHeader(state: AppState): RichText {
  const header = new RichText("💫 rich-colors");
  header.stylize("bold cyan");

  // Add mode indicator to the right of title
  const modeInfo = new RichText(` [${state.paletteMode}]`);
  modeInfo.stylize("dim");
  header.append(modeInfo);

  return header;
}

/**
 * Build the controls section (left side).
 */
function buildControlsSection(state: AppState): Panel {
  const content = new Layout();

  // Input section
  const inputSection = buildInputPanel(state);

  // Options section
  const optionsSection = buildOptionsPanel(state);

  content.splitColumn(
    new Layout(inputSection, { ratio: 1 }),
    new Layout(new Rule(), { size: 1 }),
    new Layout(optionsSection, { ratio: 2 })
  );

  return new Panel(content, {
    title: "Controls",
    padding: [1, 1],
  });
}

/**
 * Build the input color panel - compact display.
 */
function buildInputPanel(state: AppState): Panel {
  const content = new RichText();

  const inputValue = new RichText(state.mode === "inputting" ? `${state.inputColor}_` : state.inputColor);
  if (state.parseError) {
    inputValue.stylize("bold red");
  } else if (state.baseColor) {
    inputValue.stylize("bold green");
  }
  content.append(inputValue);

  if (state.baseColor && !state.parseError) {
    content.append(`\n${colorToHex(state.baseColor)}`);
    content.stylize("dim");
  } else if (state.parseError) {
    content.append("\n");
    const error = new RichText(state.parseError);
    error.stylize("red");
    content.append(error);
  }

  return new Panel(content, {
    title: "Color",
    padding: [0, 1],
  });
}

/**
 * Build the options panel.
 */
function buildOptionsPanel(state: AppState): Panel {
  const content = new Layout();
  const sections: Layout[] = [];

  // Palette mode selector
  const modeSection = buildModeSelector(state);
  sections.push(new Layout(modeSection, { ratio: 1 }));
  sections.push(new Layout(new Rule(), { size: 1 }));

  // Color system selector
  const systemSection = buildSystemSelector(state);
  sections.push(new Layout(systemSection, { ratio: 1 }));
  sections.push(new Layout(new Rule(), { size: 1 }));

  // Theme selector
  const themeSection = buildThemeSelector(state);
  sections.push(new Layout(themeSection, { ratio: 1 }));

  content.splitColumn(...sections);

  return new Panel(content, {
    title: "Options",
    padding: [0, 1],
  });
}

/**
 * Build the palette mode selector.
 */
function buildModeSelector(state: AppState): RichText {
  const modes = ["complementary", "analogous", "triadic", "tetradic", "square", "monochromatic", "shades", "tints"];
  const lines: string[] = [];

  for (const mode of modes) {
    const isActive = mode === state.paletteMode;
    lines.push(isActive ? `▶ ${mode}` : `  ${mode}`);
  }

  const result = new RichText(lines.join("\n"));

  // For simplicity, stylize the entire result
  result.stylize("dim");
  return result;
}

/**
 * Build the color system selector.
 */
function buildSystemSelector(state: AppState): RichText {
  const systems = ["truecolor", "256", "16", "windows"];
  const lines: string[] = [];

  for (const sys of systems) {
    const isActive = sys === state.colorSystemMode;
    lines.push(isActive ? `▶ ${sys}` : `  ${sys}`);
  }

  const result = new RichText(lines.join("\n"));
  result.stylize("dim");
  return result;
}

/**
 * Build the theme selector.
 */
function buildThemeSelector(state: AppState): RichText {
  const themeNames = ["default", "monokai", "svg_export"];
  const lines: string[] = [];

  for (const name of themeNames) {
    const isActive =
      (name === "default" && state.selectedTheme === state.selectedTheme) ||
      (name === "monokai") ||
      (name === "svg_export");
    lines.push(isActive ? `▶ ${name}` : `  ${name}`);
  }

  const result = new RichText(lines.join("\n"));
  result.stylize("dim");
  return result;
}

/**
 * Build the palette display section (right side).
 */
function buildPaletteSection(state: AppState): Panel {
  let content: RichText;

  if (!state.baseColor) {
    const msg = new RichText("Enter a color to generate palette");
    msg.stylize("dim yellow");
    content = msg;
  } else if (state.parseError) {
    const msg = new RichText(`Invalid color: ${state.parseError}`);
    msg.stylize("red");
    content = msg;
  } else {
    content = buildPaletteGrid(state);
  }

  return new Panel(content, {
    title: `Palette: ${state.paletteMode}`,
    padding: [1, 1],
  });
}

/**
 * Build the palette color grid.
 */
function buildPaletteGrid(state: AppState): RichText {
  const colors = visiblePaletteColors(state);
  if (colors.length === 0) {
    const msg = new RichText("No palette generated");
    msg.stylize("dim");
    return msg;
  }

  const result = new RichText();

  for (let i = 0; i < colors.length; i++) {
    const color = colors[i]!;
    const isSelected = i === state.selectedPaletteIndex;

    // Create a colored cell (5 characters wide)
    const cell = new RichText("     ");
    const style = new Style({
      bgcolor: color,
    });
    cell.stylize(style);

    // Add selection indicator
    const indicator = isSelected ? "▶" : " ";
    const line = new RichText(`${indicator} `);
    line.append(cell);
    line.append(` ${colorToHex(color)} `);

    if (i > 0) {
      result.append("\n");
    }

    result.append(line);
  }

  return result;
}

/**
 * Build the details section (shown if state.showDetails is true).
 */
function buildDetailsSection(state: AppState): Panel {
  const content = new RichText();

  if (!state.baseColor) {
    content.append("Enter a color to see details");
    content.stylize("dim");
  } else {
    const triplet = state.baseColor.getTruecolor();

    content.append(`RGB: ${triplet.red}, ${triplet.green}, ${triplet.blue}\n`);
    content.append(`Hex: ${triplet.hex}\n`);
    content.append(`Name: ${state.baseColor.name}\n`);
    content.append(`Type: ${state.baseColor.type}\n`);

    if (state.compareMode) {
      content.append(`\nColor System: ${state.colorSystemMode}`);
    }
  }

  return new Panel(content, {
    title: "Details",
    padding: [1, 1],
  });
}

/**
 * Build the status bar (footer).
 * Compact keybindings with status message on the right.
 */
function buildStatusBar(state: AppState): RichText {
  const footer = new RichText();

  if (state.mode === "inputting") {
    footer.append("⏳ Enter color (hex/rgb/name) • Esc to cancel • Enter to submit");
    footer.stylize("yellow dim");
  } else {
    // Compact keybindings
    const hints_text = `Tab: mode • C: sys • T: theme • /: input • q: quit`;
    footer.append(hints_text);
    footer.stylize("dim");

    // Status on the right
    if (state.statusMessage) {
      footer.append(` | `);
      const msgText = new RichText(state.statusMessage);
      msgText.stylize("yellow");
      footer.append(msgText);
    } else if (state.baseColor) {
      footer.append(` | 🎨 ${state.colorSystemMode}`);
      footer.stylize("dim");
    }
  }

  return footer;
}
