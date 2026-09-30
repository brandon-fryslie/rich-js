import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import { ColorDepth } from "../../src/core/color.js";
import type { Env } from "../../src/core/env.js";
import { PassThrough } from "node:stream";
import { hostEnvironment } from "../../src/host/host-environment.js";
import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import {
  BrowserTerminalHost,
  type TerminalHost,
  type TerminalSize,
  type XtermTerminal,
} from "../../src/host/terminal-host.js";

/**
 * A `Console` built over `hostEnvironment(host)` asks the host — and only the
 * host — where bytes go, whether it is a terminal, how big it is and what
 * colours it draws. The browser case is the regression: with the colour
 * question left to the ambient `process`, every console on xterm.js drew at
 * 16-colour depth, so `#fd8019` came out ANSI yellow.
 */

interface RecordingHost extends TerminalHost {
  readonly writes: (string | Uint8Array)[];
  resize(size: TerminalSize): void;
}

function makeRecordingHost(opts: {
  env: Env;
  isTTY: boolean;
}): RecordingHost {
  let size: TerminalSize = { cols: 80, rows: 24 };
  const writes: (string | Uint8Array)[] = [];
  return {
    writes,
    resize(next) {
      size = next;
    },
    write(data) {
      writes.push(data);
    },
    onData: () => () => {},
    onResize: () => () => {},
    size: () => size,
    setRawMode: () => {},
    onExit: () => () => {},
    suspend: () => Promise.resolve(),
    isTTY: opts.isTTY,
    writesToTerminal: opts.isTTY,
    env: opts.env,
    start: () => {},
    stop: () => {},
  };
}

function fakeXterm(): XtermTerminal & { written: (string | Uint8Array)[] } {
  const written: (string | Uint8Array)[] = [];
  return {
    cols: 100,
    rows: 30,
    written,
    write(data) {
      written.push(data);
    },
    onData: () => ({ dispose: () => {} }),
    onResize: () => ({ dispose: () => {} }),
  };
}

describe("hostEnvironment", () => {
  it("a console on a browser host draws a hex colour as 24-bit SGR", () => {
    const xterm = fakeXterm();
    const out = new Console({
      environment: hostEnvironment(new BrowserTerminalHost({ terminal: xterm })),
    });

    out.print("[#fd8019]warning[/]");

    expect(out.colorSystem).toBe(ColorDepth.TRUECOLOR);
    expect(xterm.written.join("")).toContain("\x1b[38;2;253;128;25mwarning");
  });

  it("detects colour from the host's env, not the ambient process's", () => {
    const noColor = makeRecordingHost({ env: { NO_COLOR: "1" }, isTTY: true });
    const truecolor = makeRecordingHost({
      env: { COLORTERM: "truecolor" },
      isTTY: true,
    });

    expect(new Console({ environment: hostEnvironment(noColor) }).colorSystem).toBeNull();
    expect(new Console({ environment: hostEnvironment(truecolor) }).colorSystem).toBe(
      ColorDepth.TRUECOLOR,
    );
  });

  it("a host that is not a terminal gets no escapes", () => {
    const host = makeRecordingHost({ env: { COLORTERM: "truecolor" }, isTTY: false });
    const out = new Console({ environment: hostEnvironment(host) });

    out.print("[red]plain[/]");

    expect(host.writes.join("")).toBe("plain\n");
  });

  it("piped stdin with a terminal stdout still draws colour", () => {
    // The console asks whether its output is a terminal. A one-shot demo run
    // as `echo | npm run strip` is not interactive, but it draws on one.
    const written: string[] = [];
    const host = new NodeTerminalHost({
      stdin: new PassThrough(),
      stdout: {
        isTTY: true,
        write: (chunk) => written.push(String(chunk)),
        on: () => {},
        off: () => {},
      },
      env: { COLORTERM: "truecolor" },
    });
    const out = new Console({ environment: hostEnvironment(host) });

    out.print("[#fd8019]warning[/]");

    expect(host.isTTY).toBe(false);
    expect(written.join("")).toContain("\x1b[38;2;253;128;25mwarning");
  });

  it("the console's size follows the host through a resize", () => {
    // An exported COLUMNS/LINES is a claim about the launching shell, and a
    // console reads it ahead of the stream; the host's size() has to win.
    const host = makeRecordingHost({ env: { COLUMNS: "80", LINES: "24" }, isTTY: true });
    const out = new Console({ environment: hostEnvironment(host) });

    expect(out.size).toEqual({ width: 80, height: 24 });
    host.resize({ cols: 132, rows: 50 });
    expect(out.size).toEqual({ width: 132, height: 50 });
  });

  it("a console bound to stderr writes to the same host", () => {
    const host = makeRecordingHost({ env: { COLORTERM: "truecolor" }, isTTY: true });
    const out = new Console({ environment: hostEnvironment(host), stderr: true });

    out.print("[#fd8019]warning[/]");

    expect(out.colorSystem).toBe(ColorDepth.TRUECOLOR);
    expect(host.writes.join("")).toContain("\x1b[38;2;253;128;25mwarning");
  });

  it("writes reach the host in order, strings and bytes alike", () => {
    const host = makeRecordingHost({ env: {}, isTTY: false });
    const { stdout } = hostEnvironment(host);
    const bytes = new Uint8Array([0x1b, 0x5b, 0x32, 0x4a]);

    stdout.write("a");
    stdout.write(bytes);
    stdout.write("c");

    expect(host.writes).toEqual(["a", bytes, "c"]);
  });
});
