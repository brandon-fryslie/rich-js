/**
 * Layout — divides the screen into rectangular regions.
 */

import { Segment } from "../core/segment.js";
import { RichText } from "../core/text.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";

export interface LayoutOptions {
  name?: string;
  ratio?: number;
  size?: number;
  minimumSize?: number;
  visible?: boolean;
}

export class Layout implements Renderable, Measurable {
  name: string | undefined;
  ratio: number;
  size: number | undefined;
  minimumSize: number;
  visible: boolean;
  private _renderable: Renderable | undefined;
  private _children: Layout[];
  private _splitDirection: "column" | "row" | undefined;

  constructor(renderable?: Renderable | string, options?: LayoutOptions) {
    if (renderable !== undefined) {
      this._renderable = typeof renderable === "string"
        ? new RichText(renderable, { end: "" })
        : renderable;
    }
    this.name = options?.name;
    this.ratio = options?.ratio ?? 1;
    this.size = options?.size;
    this.minimumSize = options?.minimumSize ?? 1;
    this.visible = options?.visible !== false;
    this._children = [];
    this._splitDirection = undefined;
  }

  get children(): Layout[] {
    return this._children;
  }

  splitColumn(...layouts: Layout[]): void {
    this._children = layouts;
    this._splitDirection = "column";
  }

  splitRow(...layouts: Layout[]): void {
    this._children = layouts;
    this._splitDirection = "row";
  }

  update(renderable: Renderable | string): void {
    this._renderable = typeof renderable === "string"
      ? new RichText(renderable, { end: "" })
      : renderable;
  }

  getByName(name: string): Layout | undefined {
    if (this.name === name) return this;
    for (const child of this._children) {
      const found = child.getByName(name);
      if (found) return found;
    }
    return undefined;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    if (!this.visible) return;

    if (this._children.length === 0) {
      // Leaf node — render content
      if (this._renderable) {
        yield* this._renderable.render(options);
      }
      return;
    }

    const visibleChildren = this._children.filter((c) => c.visible);
    if (visibleChildren.length === 0) return;

    if (this._splitDirection === "row") {
      yield* this._renderRow(visibleChildren, options);
    } else {
      yield* this._renderColumn(visibleChildren, options);
    }
  }

  private *_renderColumn(
    children: Layout[],
    options: RenderOptions,
  ): Iterable<Segment> {
    // Vertical stacking: each child gets full width, proportional height
    const totalHeight = options.maxHeight ?? options.height ?? 24;
    const heights = this._distributeSpace(children, totalHeight);

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const childOptions: RenderOptions = {
        ...options,
        maxHeight: heights[i],
        height: heights[i],
      };
      yield* child.render(childOptions);
    }
  }

  private *_renderRow(
    children: Layout[],
    options: RenderOptions,
  ): Iterable<Segment> {
    // Horizontal side-by-side: distribute width
    const widths = this._distributeSpace(children, options.maxWidth);

    // Render each child and collect their lines
    const childLines: Segment[][][] = [];
    let maxLines = 0;

    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      const childWidth = widths[i]!;
      const childOptions: RenderOptions = { ...options, maxWidth: childWidth };
      const segs = [...child.render(childOptions)];
      const lines = Segment.splitLines(segs);
      childLines.push(lines);
      maxLines = Math.max(maxLines, lines.length);
    }

    // Merge lines side by side
    for (let lineIdx = 0; lineIdx < maxLines; lineIdx++) {
      for (let childIdx = 0; childIdx < children.length; childIdx++) {
        const lines = childLines[childIdx]!;
        const width = widths[childIdx]!;
        const line = lines[lineIdx];
        if (line) {
          const adjusted = Segment.adjustLineLength(line, width);
          yield* adjusted;
        } else {
          yield new Segment(" ".repeat(width));
        }
      }
      yield Segment.line();
    }
  }

  private _distributeSpace(children: Layout[], totalSpace: number): number[] {
    const sizes: number[] = new Array(children.length).fill(0);
    let remaining = totalSpace;

    // Fixed-size children first
    const flexChildren: number[] = [];
    for (let i = 0; i < children.length; i++) {
      const child = children[i]!;
      if (child.size !== undefined) {
        sizes[i] = Math.min(child.size, remaining);
        remaining -= sizes[i]!;
      } else {
        flexChildren.push(i);
      }
    }

    // Distribute remaining by ratio
    if (flexChildren.length > 0 && remaining > 0) {
      const totalRatio = flexChildren.reduce(
        (s, idx) => s + children[idx]!.ratio,
        0,
      );

      for (const idx of flexChildren) {
        const child = children[idx]!;
        const allocated = Math.max(
          child.minimumSize,
          Math.floor(remaining * child.ratio / totalRatio),
        );
        sizes[idx] = allocated;
      }
    }

    return sizes;
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: this.minimumSize, maximum: options.maxWidth };
  }
}
