/**
 * Contract of the escape delay on a real event loop: a sequence a read split is
 * held until the program has had the delay to read its rest in, not merely
 * until the delay has passed on the clock.
 *
 * [LAW:behavior-not-structure] The rest of the sequence travels a real socket
 * into `NodeTerminalHost`, so node reads it as it reads a tty; a frame that
 * outlasts the escape delay is a synchronous wait, as a long paint is.
 */

import { once } from "node:events";
import { connect, createServer, type AddressInfo, type Socket } from "node:net";
import { PassThrough } from "node:stream";
import { afterEach, describe, it, expect } from "vitest";

import { ESCAPE_DELAY_MS, InputParser, keyName } from "../../src/host/input.js";
import { NodeTerminalHost } from "../../src/node/terminal-host.js";

const open: { close(): void }[] = [];
afterEach(() => open.splice(0).forEach((it) => it.close()));

async function terminalWire(): Promise<{ terminal: Socket; stdin: Socket }> {
  const server = createServer();
  open.push(server);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");
  const accepted = once(server, "connection");
  const stdin = connect((server.address() as AddressInfo).port, "127.0.0.1");
  open.push({ close: () => stdin.destroy() });
  const [terminal] = (await accepted) as [Socket];
  open.push({ close: () => terminal.destroy() });
  return { terminal, stdin };
}

function frame(ms: number): void {
  const end = performance.now() + ms;
  while (performance.now() < end);
}

describe("the escape delay on a split host", () => {
  it("reads a split arrow whose rest waited behind a frame longer than the delay", async () => {
    const { terminal, stdin } = await terminalWire();
    const host = new NodeTerminalHost({ stdin, stdout: Object.assign(new PassThrough(), { columns: 80, rows: 24 }), env: {} });
    const keys: string[] = [];
    const parser = new InputParser({ key: (press) => keys.push(keyName(press)), mouse: () => {} }, host.inputChunks);
    let chunk: () => void = () => {};
    host.onData((bytes) => {
      parser.feed(bytes);
      chunk();
    });

    const introducer = new Promise<void>((resolve) => (chunk = resolve));
    terminal.write("\x1b[");
    await introducer;
    terminal.write("A");
    frame(ESCAPE_DELAY_MS * 1.5);
    await new Promise((resolve) => setTimeout(resolve, ESCAPE_DELAY_MS * 2));

    expect(keys).toEqual(["up"]);
  });
});
