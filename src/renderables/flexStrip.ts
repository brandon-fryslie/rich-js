/**
 * FlexStrip — wrap-to-width horizontal layout for `StyledRenderable` items.
 *
 * Pack as many items as fit on a line, then break and continue. Each line is
 * an independent sub-strip: optional `Joiner` end-caps fire at every line
 * boundary (not just the strip's first/last position), so a line break looks
 * the same as an endpoint to the joiner. Composes with the Strip + Joiner
 * primitive in `core/strip` — same `Joiner` protocol, no new join semantics.
 *
 * [LAW:dataflow-not-control-flow] The pack walk is the same shape every
 * render: measure each item, render every joiner form (start-cap, end-cap,
 * mid-join) up-front, then sweep items into lines. Line breaks are decided by
 * width data, not by control-flow special cases.
 *
 * [LAW:one-source-of-truth] The Strip primitive owns the join protocol;
 * FlexStrip reuses it verbatim. There is no second concept of "join."
 */

import { Segment } from "../core/segment.js";
import type {
  Renderable,
  Measurable,
  RenderOptions,
} from "../core/protocol.js";
import type { Joiner, StyledRenderable } from "../core/strip.js";

export type FlexAlign = "left" | "center" | "right" | "justify";

export interface FlexStripOptions<T extends StyledRenderable> {
  /** Joiner used between items within a line, and at line endpoints. */
  joiner?: Joiner<T>;
  /** Cells of horizontal space inserted on each side of an inter-item joiner (default 0). */
  gap?: number;
  /** Line alignment when packed items don't fill the available width (default "left"). */
  align?: FlexAlign;
}

interface RenderedBlock {
  segments: Segment[];
  width: number;
}

function renderToBlock(r: Renderable, options: RenderOptions): RenderedBlock {
  const segments = [...r.render(options)];
  let width = 0;
  for (const s of segments) width += s.cellLength;
  return { segments, width };
}

const EMPTY_BLOCK: RenderedBlock = { segments: [], width: 0 };

export class FlexStrip<T extends StyledRenderable = StyledRenderable>
  implements Renderable, Measurable
{
  readonly items: readonly T[];
  readonly joiner: Joiner<T> | undefined;
  readonly gap: number;
  readonly align: FlexAlign;

  constructor(items: readonly T[], options?: FlexStripOptions<T>) {
    this.items = items;
    this.joiner = options?.joiner;
    this.gap = options?.gap ?? 0;
    this.align = options?.align ?? "left";
  }

  *render(options: RenderOptions): Iterable<Segment> {
    const items = this.items;
    if (items.length === 0) return;

    const maxWidth = Math.max(1, options.maxWidth);
    const gap = this.gap;
    const joiner = this.joiner;

    // Pre-render every item and every joiner form we might need. Doing this
    // up-front turns packing into a pure data computation over widths.
    const itemBlocks = items.map((it) => renderToBlock(it, options));
    const startCap = (i: number): RenderedBlock =>
      joiner ? renderToBlock(joiner.join(null, items[i]!), options) : EMPTY_BLOCK;
    const endCap = (i: number): RenderedBlock =>
      joiner ? renderToBlock(joiner.join(items[i]!, null), options) : EMPTY_BLOCK;
    const midJoin = (i: number, j: number): RenderedBlock =>
      joiner ? renderToBlock(joiner.join(items[i]!, items[j]!), options) : EMPTY_BLOCK;

    // Build lines as arrays of "blocks" (item or join). Each line begins with
    // the start-cap for its first item and ends with the end-cap for its last.
    type Line = { blocks: RenderedBlock[]; width: number; lastIndex: number };
    const lines: Line[] = [];
    let line: Line | null = null;
    const gapBlock: RenderedBlock = gap > 0
      ? { segments: [new Segment(" ".repeat(gap))], width: gap }
      : EMPTY_BLOCK;

    for (let i = 0; i < items.length; i++) {
      const item = itemBlocks[i]!;
      if (line === null) {
        const sc = startCap(i);
        const ec = endCap(i);
        const blocks = sc.width > 0 ? [sc, item] : [item];
        line = { blocks, width: sc.width + item.width, lastIndex: i };
        // Tentatively reserve space for the line's eventual end-cap by
        // tracking it separately below — `line.width` is the open width
        // (without end-cap). We test fit using width + endCap on each step.
        // Always start a new line with at least the first item (overflow ok
        // per ticket: graceful fallback when an item is wider than terminal).
        // Stash end-cap for the close step.
        (line as Line & { endCap: RenderedBlock }).endCap = ec;
        continue;
      }

      const prev = line.lastIndex;
      const mid = midJoin(prev, i);
      const newEndCap = endCap(i);
      const addCost = (gap > 0 ? gap : 0) + mid.width + (gap > 0 ? gap : 0) + item.width;
      const closedWidthIfAdded = line.width + addCost + newEndCap.width;

      if (closedWidthIfAdded <= maxWidth) {
        if (gap > 0) line.blocks.push(gapBlock);
        if (mid.width > 0) line.blocks.push(mid);
        if (gap > 0) line.blocks.push(gapBlock);
        line.blocks.push(item);
        line.width += addCost;
        line.lastIndex = i;
        (line as Line & { endCap: RenderedBlock }).endCap = newEndCap;
      } else {
        // Close current line and start a new one with this item.
        const closing = (line as Line & { endCap: RenderedBlock }).endCap;
        if (closing.width > 0) line.blocks.push(closing);
        line.width += closing.width;
        lines.push(line);
        const sc = startCap(i);
        const ec = endCap(i);
        const blocks = sc.width > 0 ? [sc, item] : [item];
        line = { blocks, width: sc.width + item.width, lastIndex: i };
        (line as Line & { endCap: RenderedBlock }).endCap = ec;
      }
    }
    // Close final line. `line` is non-null here: the loop runs at least once
    // (items.length > 0 was handled above).
    const finalLine = line!;
    {
      const closing = (finalLine as Line & { endCap: RenderedBlock }).endCap;
      if (closing.width > 0) finalLine.blocks.push(closing);
      finalLine.width += closing.width;
      lines.push(finalLine);
    }

    // Emit. Apply alignment by padding the line. Justify on a non-final line
    // distributes spare width across inter-item gaps; final line is left-
    // aligned (standard text-justification behavior).
    const align = this.align;
    for (let li = 0; li < lines.length; li++) {
      const ln = lines[li]!;
      const isLast = li === lines.length - 1;
      const spare = Math.max(0, maxWidth - ln.width);
      const padLeft = align === "center" ? Math.floor(spare / 2)
        : align === "right" ? spare
        : 0;
      if (padLeft > 0) yield new Segment(" ".repeat(padLeft));
      if (align === "justify" && !isLast && ln.blocks.length > 1 && spare > 0) {
        // Distribute spare evenly across the N-1 inter-item slots.
        const slots = ln.blocks.length - 1;
        const base = Math.floor(spare / slots);
        let extra = spare - base * slots;
        for (let bi = 0; bi < ln.blocks.length; bi++) {
          yield* ln.blocks[bi]!.segments;
          if (bi < ln.blocks.length - 1) {
            const fill = base + (extra > 0 ? 1 : 0);
            if (extra > 0) extra--;
            if (fill > 0) yield new Segment(" ".repeat(fill));
          }
        }
      } else {
        for (const b of ln.blocks) yield* b.segments;
      }
      yield Segment.line();
    }
  }

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    const items = this.items;
    if (items.length === 0) return { minimum: 0, maximum: 0 };
    let minimum = 0;
    let maximum = 0;
    for (let i = 0; i < items.length; i++) {
      const itemWidth = renderToBlock(items[i]!, options).width;
      const sc = this.joiner
        ? renderToBlock(this.joiner.join(null, items[i]!), options).width
        : 0;
      const ec = this.joiner
        ? renderToBlock(this.joiner.join(items[i]!, null), options).width
        : 0;
      minimum = Math.max(minimum, itemWidth + sc + ec);
      maximum += itemWidth;
      if (i > 0) {
        maximum += this.gap * 2;
        if (this.joiner) {
          maximum += renderToBlock(this.joiner.join(items[i - 1]!, items[i]!), options).width;
        }
      }
    }
    if (this.joiner) {
      maximum += renderToBlock(this.joiner.join(null, items[0]!), options).width;
      maximum += renderToBlock(this.joiner.join(items[items.length - 1]!, null), options).width;
    }
    return { minimum, maximum };
  }
}
