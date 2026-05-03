import { ColorSpec, RichText, Style, Renderable, Segment, RenderOptions } from "../../../src/index.js";

/**
 * Renderable for displaying a single color swatch.
 *
 * [LAW:one-type-per-behavior] ColorSwatch is a single type for rendering
 * color swatches; different colors are instances with different data.
 */
export class ColorSwatch implements Renderable {
  constructor(
    private color: ColorSpec | null,
    private width: number = 10,
    private showLabel: boolean = true
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    if (!this.color) {
      return;
    }

    // Create a colored cell
    const cellContent = " ".repeat(Math.max(1, this.width - 2));
    const cell = new RichText(cellContent);

    // Apply background color
    const style = new Style({
      bgcolor: this.color,
    });
    cell.stylize(style);

    yield* cell.render(options);

    // Add label on next line if requested
    if (this.showLabel) {
      yield Segment.line();

      const triplet = this.color.getTruecolor();
      const label = new RichText(triplet.hex);
      label.stylize("dim");
      yield* label.render(options);
    }
  }
}

/**
 * Renderable for displaying a grid of color swatches.
 */
export class PaletteGrid implements Renderable {
  constructor(
    private colors: ColorSpec[],
    private selectedIndex: number = 0,
    private swatchWidth: number = 10
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    for (let i = 0; i < this.colors.length; i++) {
      const color = this.colors[i]!;
      const isSelected = i === this.selectedIndex;

      // Selection indicator
      const indicator = new RichText(isSelected ? "▶ " : "  ");
      if (isSelected) {
        indicator.stylize("bold yellow");
      }
      yield* indicator.render(options);

      // ColorSpec swatch
      const swatch = new ColorSwatch(color, this.swatchWidth, false);
      yield* swatch.render(options);

      // ColorSpec information
      const triplet = color.getTruecolor();
      const info = new RichText(` ${triplet.hex}`);
      yield* info.render(options);

      // End of line
      if (i < this.colors.length - 1) {
        yield Segment.line();
      }
    }
  }
}
