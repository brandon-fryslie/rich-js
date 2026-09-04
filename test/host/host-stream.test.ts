import { describe, it, expect } from "vitest";
import { hostStream } from "../../src/host/host-stream.js";
import type { TerminalHost, TerminalSize } from "../../src/host/terminal-host.js";

/**
 * `hostStream` is the seam between Console's existing `file:` option and any
 * `TerminalHost` implementation. The contract Console + Live exercise on the
 * returned object is exactly `.write(chunk)` — these tests pin that surface
 * so future changes to Console can't quietly slip past the adapter.
 */

interface RecordingHost extends TerminalHost {
  readonly writes: readonly (string | Uint8Array)[];
}

function makeRecordingHost(): RecordingHost {
  const writes: (string | Uint8Array)[] = [];
  const size: TerminalSize = { cols: 80, rows: 24 };
  const host: RecordingHost = {
    writes,
    write(data: string | Uint8Array): void {
      writes.push(data);
    },
    onData: () => () => {},
    onResize: () => () => {},
    size: () => size,
    setRawMode: () => {},
    isTTY: false,
    start: () => {},
    stop: () => {},
  };
  return host;
}

describe("hostStream", () => {
  it("forwards string writes to host.write", () => {
    const host = makeRecordingHost();
    const stream = hostStream(host);

    const result = stream.write("hello");

    expect(result).toBe(true);
    expect(host.writes).toEqual(["hello"]);
  });

  it("forwards Uint8Array writes to host.write", () => {
    const host = makeRecordingHost();
    const stream = hostStream(host);

    const bytes = new Uint8Array([0x1b, 0x5b, 0x32, 0x4a]); // ESC[2J
    stream.write(bytes);

    expect(host.writes).toHaveLength(1);
    expect(host.writes[0]).toBe(bytes);
  });

  it("preserves write order across calls", () => {
    const host = makeRecordingHost();
    const stream = hostStream(host);

    stream.write("a");
    stream.write("b");
    stream.write("c");

    expect(host.writes).toEqual(["a", "b", "c"]);
  });
});
