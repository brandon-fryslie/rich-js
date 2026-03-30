/**
 * Rendering protocol interfaces — Renderable, Measurable, RenderOptions.
 * [LAW:one-source-of-truth] These interfaces are the single authority for the rendering contract.
 */

import type { Segment } from "./segment.js";

export interface RenderOptions {
  maxWidth: number;
  minWidth?: number;
  height?: number;
  maxHeight?: number;
  isTerminal?: boolean;
  encoding?: string;
  legacyWindows?: boolean;
  asciiOnly?: boolean;
  justify?: "left" | "center" | "right" | "full";
  overflow?: "fold" | "crop" | "ellipsis";
  noWrap?: boolean;
  highlight?: unknown;
  markup?: unknown;
}

export interface Renderable {
  render(options: RenderOptions): Iterable<Segment>;
}

export interface Measurable {
  measure(options: RenderOptions): { minimum: number; maximum: number };
}

export function isRenderable(obj: unknown): obj is Renderable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "render" in obj &&
    typeof (obj as Renderable).render === "function"
  );
}

export function isMeasurable(obj: unknown): obj is Measurable {
  return (
    typeof obj === "object" &&
    obj !== null &&
    "measure" in obj &&
    typeof (obj as Measurable).measure === "function"
  );
}
