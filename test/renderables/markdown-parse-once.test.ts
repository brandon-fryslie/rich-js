import { describe, expect, it, vi } from "vitest";
import { parseMarkdown } from "../../src/renderables/markdown-parse.js";
import { Markdown } from "../../src/renderables/markdown.js";
import type { Renderable, RenderOptions } from "../../src/core/protocol.js";

// What a render costs no byte shows, so the parse is counted at the one call
// that makes it. Its own file, because the mock below holds for every test in it.
vi.mock("../../src/renderables/markdown-parse.js", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../../src/renderables/markdown-parse.js")>();
  return { ...actual, parseMarkdown: vi.fn(actual.parseMarkdown) };
});

function drawn(r: Renderable, options: RenderOptions): string {
  return [...r.render(options)].map((s) => s.text).join("");
}

describe("Markdown's parse", () => {
  it("is made once, when the Markdown is, and no render makes it again at any width", () => {
    const parses = vi.mocked(parseMarkdown);
    parses.mockClear();
    const md = new Markdown("# Title\n\n> a *quote* with [a link](https://example.com)\n\n- one\n- two\n\n| a | b |\n|---|---|\n| `x` | <b>y</b> |");
    expect(parses).toHaveBeenCalledTimes(1);

    const first = drawn(md, { maxWidth: 40 });
    drawn(md, { maxWidth: 12 });
    expect(drawn(md, { maxWidth: 40 })).toBe(first);
    expect(parses).toHaveBeenCalledTimes(1);
  });
});
