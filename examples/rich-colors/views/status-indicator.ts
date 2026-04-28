import { RichText } from "../../../src/index.js";
import { AppState } from "../state.js";

/**
 * Build a status indicator for the current palette mode.
 * Renders a static emoji glyph plus the mode/system label — the demo's
 * top-level redraw cadence isn't driven by Live, so an animated Spinner
 * wouldn't actually animate here.
 */
export function buildStatusIndicator(state: AppState): RichText {
  const indicator = new RichText();

  if (state.mode === "inputting") {
    const spinnerText = new RichText("⏳ ");
    spinnerText.stylize("yellow");
    indicator.append(spinnerText);
    indicator.append("Awaiting color input");
  } else if (state.baseColor) {
    // Show the current palette mode with indicator
    const modeIndicator = new RichText(`🎨 ${state.selectedPaletteMode}`);
    modeIndicator.stylize("cyan bold");
    indicator.append(modeIndicator);

    // Add color system info
    const systemInfo = new RichText(` • ${state.colorSystemMode}`);
    systemInfo.stylize("dim");
    indicator.append(systemInfo);
  } else {
    const prompt = new RichText("Press / to enter a color");
    prompt.stylize("dim yellow");
    indicator.append(prompt);
  }

  return indicator;
}

/**
 * Format mode name for display with visual indicators.
 */
export function formatModeLabel(mode: string): string {
  const modeLabels: Record<string, string> = {
    complementary: "🔄 Complementary",
    analogous: "≈ Analogous",
    triadic: "△ Triadic",
    tetradic: "◻ Tetradic",
    square: "□ Square",
    monochromatic: "▯ Monochromatic",
    shades: "▼ Shades",
    tints: "▲ Tints",
  };

  return modeLabels[mode] || mode;
}
