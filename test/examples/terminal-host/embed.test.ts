/**
 * The terminal-host demo's embedding entry, run on a stand-in xterm.js
 * terminal: what it prints for a key and a resize, and that Ctrl-D ends it
 * with the terminal's listeners released. Nothing else runs embed.ts.
 */
import { describe, it, expect } from "vitest";
import { mountInPage } from "../../../examples/terminal-host/embed.js";
import { describeChunk } from "../../../examples/terminal-host/app.js";
import { FakeXtermTerminal } from "../../host/fake-xterm.js";

describe("terminal-host demo", () => {
  it("prints each key as its bytes and each resize, and Ctrl-D releases the terminal", async () => {
    const term = new FakeXtermTerminal(75, 24);
    const done = mountInPage(term);
    term.emitData("\x1b[A");
    term.setSize(90, 30);
    term.emitData("\x04");
    await done;

    const out = term.written.join("");
    expect(out).toContain("75x24");
    expect(out).toContain("\\e[A");
    expect(out).toContain("90x30");
    expect(term.dataHandlerCount).toBe(0);
    expect(term.resizeHandlerCount).toBe(0);
  });

  it("escapes control bytes and leaves printable text alone", () => {
    expect(describeChunk("\t")).toBe("\\t");
    expect(describeChunk("\r")).toBe("\\r");
    expect(describeChunk("é")).toBe("é");
  });
});
