/**
 * `nodeAsk` on real `node:readline`, its keyboard a stream standing in for
 * `process.stdin`. The docs build's stand-in is test/docs/node-readline.test.ts.
 */
import { Readable } from "node:stream";
import { afterEach, describe, expect, it } from "vitest";
import { Console } from "../../src/core/console.js";
import { Prompt } from "../../src/renderables/prompt.js";
import { nodeAsk } from "../../src/node/prompt.js";

const stdin = Object.getOwnPropertyDescriptor(process, "stdin")!;
afterEach(() => Object.defineProperty(process, "stdin", stdin));

/** Typed `lines` on the keyboard `nodeAsk` reads. */
function keyboard(...lines: string[]): void {
  Object.defineProperty(process, "stdin", { value: Readable.from(lines.map((line) => `${line}\n`)), configurable: true });
}

/**
 * A console on a terminal that is not a node stream: a `write`, a TTY flag
 * and a size, as `hostEnvironment` hands one over.
 */
function terminalConsole() {
  const written: string[] = [];
  const stream = { write: (chunk: string | Uint8Array) => void written.push(String(chunk)), isTTY: true, columns: 80, rows: 24 };
  const console = new Console({ environment: { env: {}, stdout: stream, stderr: stream }, colorSystem: null });
  return { console, written };
}

describe("nodeAsk", () => {
  it("asks on a console whose terminal is no node stream, and prints the prompt there", async () => {
    const { console, written } = terminalConsole();
    keyboard("dev");
    expect(await Prompt.ask("Env", nodeAsk, { choices: ["dev", "prod"], console })).toBe("dev");
    expect(written.join("")).toBe("Env [dev/prod]: ");
  });

  it("leaves a capture the app has open holding what it held, the prompt added", async () => {
    const { console } = terminalConsole();
    console.beginCapture();
    console.print("before");
    keyboard("x");
    await Prompt.ask("Name", nodeAsk, { console });
    expect(console.endCapture()).toBe("before\nName: ");
  });
});
