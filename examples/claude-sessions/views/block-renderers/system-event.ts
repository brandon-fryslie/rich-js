import { Rule } from "../../../../src/index.js";
import type { Renderable } from "../../../../src/index.js";
import type { SystemBlock } from "../../data/types.js";
import type { RenderOpts } from "./index.js";

function formatDuration(ms: number | null): string {
  if (ms === null) return "—";
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  const m = Math.floor(s / 60);
  const rs = s % 60;
  if (m < 60) return `${m}m ${rs}s`;
  const h = Math.floor(m / 60);
  const rm = m % 60;
  return `${h}h ${rm}m`;
}

export function renderSystem(block: SystemBlock, opts: RenderOpts): Renderable {
  const title = `${block.subtype === "turn_duration" ? "⧗" : "•"} ${formatDuration(block.durationMs)}`;
  return new Rule(title, {
    style: opts.isSelected ? "bold white" : "dim white",
    characters: "─",
  });
}
