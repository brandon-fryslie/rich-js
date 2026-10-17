import { Rule, Align, RichText, Group } from "@promptctl/rich-js";
import type { Renderable } from "@promptctl/rich-js";
import type { SystemBlock } from "../../data/types.js";
import { emoji, highlightSearch, truncate } from "./_common.js";
import type { RenderOpts } from "./index.js";

const TEXT_PREVIEW_LINES = 3;

function formatDuration(ms: number): string {
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

/** A rule naming what happened and how long it took, over the text the record carries. */
export function renderSystem(block: SystemBlock, opts: RenderOpts): Renderable {
  const icon = block.subtype === "turn_duration" ? emoji(":hourglass:") : emoji(":black_circle:");
  const style = opts.isSelected ? "bold white" : "dim white";
  const duration = block.durationMs === null ? "" : ` · ${formatDuration(block.durationMs)}`;
  const title = new RichText(`${icon} ${block.label}${duration}`, { style });
  highlightSearch(title, opts.searchQuery);
  // Wrap in Align to exercise the Align renderable
  const rule = new Align(new Rule(title, { style, characters: "─" }), "center");
  const text = new RichText(opts.isExpanded ? block.text : truncate(block.text, TEXT_PREVIEW_LINES), { style: "dim", end: "" });
  highlightSearch(text, opts.searchQuery);
  return new Group(rule, ...(block.text === "" ? [] : [text]));
}
