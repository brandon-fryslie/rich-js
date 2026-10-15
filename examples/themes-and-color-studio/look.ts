/** The look every section shares: how a swatch is painted, and the text around it. */
import { ColorRgba, ensureContrast, graphemes, RichText, Style } from "@promptctl/rich-js";

/**
 * Build a `Style` that paints `fg` text on `bg`, flattening alpha against
 * `substrate` first and routing the foreground through `ensureContrast` so
 * an inverted/darkened palette can't render dark-on-dark.
 *
 * [LAW:single-enforcer] The only place the demo flattens alpha + enforces
 * the readability floor; every styled cell goes through here. `ensureContrast`
 * keeps the foreground's hue and just slides its OKLCH lightness until the
 * 4.5:1 ratio is met, so themed text still looks themed.
 *
 * [LAW:dataflow-not-control-flow] `ColorRgba.compositeOver` is a no-op when
 * alpha=1 (the typical case for opaque palette colors), so the same call
 * site is correct for both translucent and opaque inputs.
 */
export function bgFgStyle(bg: ColorRgba, fg: ColorRgba, substrate: ColorRgba): Style {
  const flatBg = bg.compositeOver(substrate);
  const flatFg = ensureContrast(fg.compositeOver(flatBg), flatBg, 4.5);
  return Style.parse(`${flatFg.hex} on ${flatBg.hex}`);
}

export function sectionHeader(num: number, title: string): RichText {
  return new RichText(`${num}. ${title}`, { style: "bold underline" });
}

export function blurb(text: string): RichText {
  return new RichText(`    ${text}`, { style: "dim" });
}

export function blank(): RichText {
  return new RichText("");
}

export function bold(text: string): RichText {
  return new RichText(text, { style: "bold" });
}

export function dim(text: string): RichText {
  return new RichText(text, { style: "dim" });
}

// Error messages carry a near-miss suggestion list and can run long. Cap
// them so one diagnostic can't take over the section, while leaving room
// for the suggestions themselves — those are the useful half of the message.
// Counted in grapheme clusters, so the cut never splits an emoji or an
// accented letter in two.
export function truncate(text: string, max: number): string {
  const clusters = graphemes(text);
  return clusters.length <= max ? text : `${clusters.slice(0, max - 1).join("")}…`;
}

// The semantic vars we sample across the demo. Ordered roughly by role:
// brand → highlight → state. Six of them, beside a theme's name, is one
// line of the card's terminal (card.json).
export const SEMANTIC_VARS = [
  "primary",
  "secondary",
  "accent",
  "success",
  "warning",
  "error",
] as const;

