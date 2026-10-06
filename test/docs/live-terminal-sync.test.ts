/**
 * A live terminal shows a frame a program brackets with synchronized output
 * (DEC mode 2026) whole, however the frame's bytes were split on their way
 * from the worker: xterm 5.3 ignores the mode, so the page holds the frame.
 */
import { describe, expect, it } from "vitest";
import { synchronized } from "../../docs/.vitepress/theme/live-terminal.js";

const BEGIN = "\x1b[?2026h";
const END = "\x1b[?2026l";

function written(chunks: readonly (string | Uint8Array)[], ended = false): string[] {
  const out: string[] = [];
  const shown = synchronized((text) => out.push(text));
  for (const chunk of chunks) shown.write(chunk);
  if (ended) shown.flush();
  return out;
}

describe("synchronized output", () => {
  it("writes a frame split over several chunks as one", () => {
    const frame = `${BEGIN}\x1b[Hrow one\r\n\x1b[2Krow two${END}`;
    expect(written([frame.slice(0, 5), frame.slice(5, 20), frame.slice(20)])).toEqual([frame]);
  });

  it("passes text outside a frame on as it comes, holding only what may begin one", () => {
    expect(written(["hello ", "world\x1b[?20", "26h", "x", END, "after"])).toEqual(["hello ", "world", `${BEGIN}x${END}`, "after"]);
  });

  it("holds an escape that turns out not to begin a frame only until it is known", () => {
    expect(written(["red \x1b[", "31m"])).toEqual(["red ", "\x1b[31m"]);
  });

  it("reads bytes as text, a character split between chunks included", () => {
    const bytes = new TextEncoder().encode(`${BEGIN}é${END}`);
    expect(written([bytes.slice(0, 10), bytes.slice(10)])).toEqual([`${BEGIN}é${END}`]);
  });

  it("keeps bytes and text in the order they were written", () => {
    const bytes = new TextEncoder().encode("aé");
    expect(written([bytes.slice(0, 2), "b"]).join("")).toBe("a\uFFFDb");
  });

  it("shows what it holds when the program ends: a frame never closed, as far as it got", () => {
    expect(written(["before", `${BEGIN}half a fr`], true)).toEqual(["before", `${BEGIN}half a fr`]);
    expect(written(["tail \x1b[?"], true)).toEqual(["tail ", "\x1b[?"]);
    expect(written([new TextEncoder().encode("é").slice(0, 1)], true)).toEqual(["\uFFFD"]);
  });

  it("writes each of two frames in one chunk on its own", () => {
    expect(written([`${BEGIN}a${END}${BEGIN}b${END}`])).toEqual([`${BEGIN}a${END}`, `${BEGIN}b${END}`]);
  });
});
