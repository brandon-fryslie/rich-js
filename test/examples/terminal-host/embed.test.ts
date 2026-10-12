/**
 * The terminal-host demo's embedding entry, run on a stand-in xterm.js
 * terminal: what it prints for a key and a resize, and that Ctrl-D ends it
 * with the terminal's listeners released, and the same program on a node
 * host handing back cooked mode. Nothing else runs embed.ts.
 */
import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, it, expect } from "vitest";
import { NodeTerminalHost } from "../../../src/node/terminal-host.js";
import { mountInPage } from "../../../examples/terminal-host/embed.js";
import { describeChunk, inspectKeys } from "../../../examples/terminal-host/app.js";
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
    expect(describeChunk("\x7f")).toBe("\\x7f");
    expect(describeChunk("\x9b2J")).toBe("\\x9b2J");
    expect(describeChunk('"\\')).toBe('"\\');
  });

  it("quits on a Ctrl-D inside a larger read and hands back cooked mode on a node host", async () => {
    const raw: boolean[] = [];
    const stdin = Object.assign(new PassThrough(), {
      isTTY: true,
      setRawMode: (on: boolean) => raw.push(on),
    });
    const stdout = Object.assign(new PassThrough(), { columns: 80, rows: 24, isTTY: true });
    const written: string[] = [];
    stdout.on("data", (b: Buffer) => written.push(b.toString()));
    const host = new NodeTerminalHost({ stdin, stdout, env: {}, process: new EventEmitter() as never });
    host.start();
    const done = inspectKeys(host);
    // é split across two reads still decodes as é.
    stdin.write(Buffer.from([0xc3]));
    stdin.write(Buffer.from([0xa9, 0x61, 0x04]));
    await done;
    host.stop();

    expect(raw.at(-1)).toBe(false);
    expect(written.join("")).toContain("éa");
    expect(written.join("")).not.toContain("\ufffd");
  });
});
