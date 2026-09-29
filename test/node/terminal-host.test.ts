/**
 * Contract of `NodeTerminalHost.onExit` and `suspend` — hearing the program
 * end, and handing the terminal to the shell.
 *
 * [LAW:behavior-not-structure] The process is an `EventEmitter` that records
 * `kill` instead of performing it, because a real SIGTSTP would stop the test
 * runner. Events reach the host by `emit`, as node delivers them. What the
 * real process does with the same listeners — a signal's outcome, a crash
 * report's order, job control — is test/node/crash-order.test.ts.
 */

import { EventEmitter } from "node:events";
import { PassThrough } from "node:stream";
import { describe, it, expect } from "vitest";

import { NodeTerminalHost } from "../../src/node/terminal-host.js";

class RecordedProcess extends EventEmitter {
  readonly pid = 4242;
  readonly killed: { pid: number; signal: NodeJS.Signals }[] = [];
  kill(pid: number, signal: NodeJS.Signals): true {
    this.killed.push({ pid, signal });
    return true;
  }
}

function host(proc: RecordedProcess): NodeTerminalHost {
  return new NodeTerminalHost({
    stdin: new PassThrough(),
    stdout: Object.assign(new PassThrough(), { columns: 80, rows: 24 }),
    env: {},
    process: proc,
  });
}

const HEARD = ["exit", "uncaughtExceptionMonitor", "SIGINT", "SIGTERM", "SIGHUP"];

describe("NodeTerminalHost.onExit", () => {
  it.each(["exit", "uncaughtExceptionMonitor", "SIGINT", "SIGTERM", "SIGHUP"])(
    "runs the handler when the program ends by %s",
    (event) => {
      const proc = new RecordedProcess();
      let ran = 0;
      host(proc).onExit(() => (ran += 1));

      proc.emit(event);

      expect(ran).toBe(1);
    },
  );

  it("runs the handler once when a crash is followed by the exit it causes", () => {
    const proc = new RecordedProcess();
    let ran = 0;
    host(proc).onExit(() => (ran += 1));

    proc.emit("uncaughtExceptionMonitor", new Error("boom"), "uncaughtException");
    proc.emit("exit", 1);

    expect(ran).toBe(1);
    for (const event of HEARD) expect(proc.listenerCount(event)).toBe(0);
  });

  it("raises a signal again once handled, so it still terminates", () => {
    const proc = new RecordedProcess();
    const order: string[] = [];
    proc.kill = (pid, signal) => {
      order.push(`kill ${pid} ${signal}`);
      return true;
    };
    host(proc).onExit(() => order.push("handler"));

    proc.emit("SIGTERM");

    expect(order).toEqual(["handler", "kill 4242 SIGTERM"]);
  });

  it("leaves a signal to the program's own listener when it has one", () => {
    const proc = new RecordedProcess();
    let heard = 0;
    proc.on("SIGINT", () => (heard += 1));
    host(proc).onExit(() => {});

    proc.emit("SIGINT");

    expect(heard).toBe(1);
    expect(proc.killed).toEqual([]);
  });

  // `signal-exit` (under ink, ora, execa) keeps the same rule — raise the
  // signal only when no other listener is left — and is usually listening
  // before the app starts. Two listeners that each saw the other would both
  // stand down, and the signal would end nothing.
  it("still terminates beside an earlier listener that raises the signal only when alone", () => {
    const proc = new RecordedProcess();
    const alone = (): void => {
      if (proc.listenerCount("SIGTERM") === 1) proc.kill(proc.pid, "SIGTERM");
    };
    proc.on("SIGTERM", alone);
    let ran = 0;
    host(proc).onExit(() => (ran += 1));

    proc.emit("SIGTERM");

    expect(ran).toBe(1);
    expect(proc.killed).toEqual([{ pid: 4242, signal: "SIGTERM" }]);
  });

  it("raises the signal after the last of two handlers, not the first", () => {
    const proc = new RecordedProcess();
    const terminal = host(proc);
    let ran = 0;
    terminal.onExit(() => (ran += 1));
    terminal.onExit(() => (ran += 1));

    proc.emit("SIGHUP");

    expect(ran).toBe(2);
    expect(proc.killed).toEqual([{ pid: 4242, signal: "SIGHUP" }]);
  });

  it("hears nothing once unsubscribed, and leaves no listener behind", () => {
    const proc = new RecordedProcess();
    let ran = 0;
    const unsubscribe = host(proc).onExit(() => (ran += 1));

    unsubscribe();
    proc.emit("exit", 0);

    expect(ran).toBe(0);
    for (const event of HEARD) expect(proc.listenerCount(event)).toBe(0);
  });
});

describe("NodeTerminalHost.suspend", () => {
  // Sent to the process group, as the terminal sends Ctrl+Z, so a launcher
  // waiting on this process stops with it. The process is stopped inside
  // `kill`, so by the time it returns the program has the terminal again.
  it("stops the whole job as Ctrl+Z would, and resolves once the call returns", async () => {
    const proc = new RecordedProcess();

    await host(proc).suspend();

    expect(proc.killed).toEqual([{ pid: 0, signal: "SIGTSTP" }]);
  });
});
