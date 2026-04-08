import {
  Layout,
  Panel,
  RichText,
  Rule,
  Style,
  Spinner,
  Status,
} from "../../../src/index.js";
import { AppState, colorToHex, colorToRgb, visiblePaletteColors } from "../state.js";
import { buildStatusIndicator } from "./status-indicator.js";

/**
 * Build the main application layout.
 */
export function buildShell(state: AppState, termHeight: number): Layout {
  const root = new Layout();

  // Header (2 rows)
  const headerLayout = new Layout(buildHeader(), { size: 2, name: "header" });

  // Status indicator (1 row) - shows current mode with spinner
  const statusIndicator = buildStatusIndicator(state);
  const statusLayout = new Layout(statusIndicator, { size: 1, name: "status" });

  // Content area (dynamic height)
  const contentLayout = new Layout(undefined, { name: "content", ratio: 1 });

  // Footer (1 row)
  const footerLayout = new Layout(buildStatusBar(state), { size: 1, name: "footer" });

  // Vertical split: header / status / content / footer
  root.splitColumn(headerLayout, statusLayout, contentLayout, footerLayout);

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
 * Build the header section.
 */
function buildHeader(): Panel {
  const title = new RichText("💫 rich-colors");
  title.stylize("bold cyan");

  const subtitle = new RichText("Interactive Palette Generator");
  subtitle.stylize("dim");

  const header = new Layout();
  header.splitColumn(
    new Layout(title, { size: 1 }),
    new Layout(subtitle, { size: 1 })
  );

  return new Panel(header, {
    title: "",
    padding: [0, 1],
  });
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
 * Build the input color panel.
 */
function buildInputPanel(state: AppState): Panel {
  const lines: RichText[] = [];

  const inputLabel = new RichText("Input Color:");
  inputLabel.stylize("bold");
  lines.push(inputLabel);

  const inputValue = new RichText(state.mode === "inputting" ? `${state.inputColor}_` : state.inputColor);
  if (state.parseError) {
    inputValue.stylize("bold red");
  } else if (state.baseColor) {
    inputValue.stylize("bold green");
  }
  lines.push(inputValue);

  if (state.baseColor && !state.parseError) {
    const hexLine = new RichText(`Hex: ${colorToHex(state.baseColor)}`);
    hexLine.stylize("dim");
    lines.push(hexLine);

    const rgbLine = new RichText(`RGB: ${colorToRgb(state.baseColor)}`);
    rgbLine.stylize("dim");
    lines.push(rgbLine);
  } else if (state.parseError) {
    const errorLine = new RichText(state.parseError);
    errorLine.stylize("red");
    lines.push(errorLine);
  }

  const hint = new RichText("(Press / to edit)");
  hint.stylize("dim yellow");
  lines.push(hint);

  const content = new Layout();
  const layouts = lines.map((line) => new Layout(line, { size: 1 }));
  content.splitColumn(...layouts);

  return new Panel(content, {
    title: "Input",
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
 * Includes mode indicator with spinner and keybinding hints.
 */
function buildStatusBar(state: AppState): RichText {
  const hints = new RichText();

  if (state.mode === "inputting") {
    // Show a spinner while waiting for input
    const spinner = new Spinner();
    const status = new Status(`${spinner} Enter color (hex/rgb/name) • Esc to cancel • Enter to submit`);
    return new RichText(status.toString ? status.toString() : "Enter color (hex/rgb/name) • Esc to cancel • Enter to submit");
  } else {
    // Show keybindings and current mode info
    const hints_text = `Tab: mode • C: system • T: theme • Shift+C: compare • Shift+D: details • /: input • q: quit`;
    hints.append(hints_text);
    hints.stylize("dim");

    if (state.statusMessage) {
      hints.append(` | `);
      const msgText = new RichText(state.statusMessage);
      msgText.stylize("yellow");
      hints.append(msgText);
    } else {
      // Show current mode info as a status indicator
      const modeInfo = new RichText(` [${state.paletteMode}] • ${state.colorSystemMode}`);
      modeInfo.stylize("cyan dim");
      hints.append(modeInfo);
    }
  }

  return hints;
}
