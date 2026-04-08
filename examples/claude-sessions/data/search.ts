/**
 * Local search: scans the loaded Block[] for matches against a query string.
 *
 * The match surface includes every field a user might want to find:
 * human/assistant text, tool name, tool input (stringified), tool result text,
 * subagent prompts, error text. Case-insensitive substring match.
 *
 * Global search across files is an extension point — see plan.
 */

import type { Block } from "./types.js";

function matchableText(block: Block): string {
  switch (block.kind) {
    case "human":
      return block.text;
    case "assistant":
      return `${block.text}\n${block.model}`;
    case "tool-call":
      return `${block.toolName}\n${JSON.stringify(block.input)}\n${block.result}`;
    case "subagent":
      return `${block.subagentType}\n${block.description}\n${block.prompt}\n${block.resultText}`;
    case "system":
      return block.subtype;
    case "error":
      return `${block.errorType}\n${block.text}`;
  }
}

export function localSearch(blocks: ReadonlyArray<Block>, query: string): number[] {
  if (query.length === 0) return [];
  const needle = query.toLowerCase();
  const out: number[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const hay = matchableText(blocks[i]!).toLowerCase();
    if (hay.includes(needle)) out.push(i);
  }
  return out;
}
