/**
 * A script of the `TerminalHost` contract: it records what is written and
 * whether the terminal is in raw mode, and the test fires its resize, exit,
 * resume and input by hand.
 */

import type {
  DataHandler,
  ResizeHandler,
  TerminalHost,
  TerminalSize,
} from "../../src/host/terminal-host.js";

export interface ScriptedHost extends TerminalHost {
  /** Everything written, joined. */
  readonly output: () => string;
  readonly raw: () => boolean;
  readonly started: () => boolean;
  resize(size: TerminalSize): void;
  exit(): void;
  /** The pending `suspend()`, resolved by the test as a shell's `fg` would. */
  resume(): void;
  readonly suspends: () => number;
  /** Bytes arriving from the terminal, as a keypress or the pointer sends them. */
  type(data: string): void;
}

export function scriptedHost(initial: TerminalSize = { cols: 20, rows: 4 }): ScriptedHost {
  let size = initial;
  let raw = false;
  let started = false;
  let suspends = 0;
  let resume: () => void = () => {
    throw new Error("resume() with no suspend pending");
  };
  const writes: string[] = [];
  const resizeHandlers = new Set<ResizeHandler>();
  const exitHandlers = new Set<() => void>();
  const dataHandlers = new Set<DataHandler>();
  return {
    output: () => writes.join(""),
    raw: () => raw,
    started: () => started,
    suspends: () => suspends,
    resize(next) {
      size = next;
      for (const h of resizeHandlers) h(next);
    },
    exit() {
      for (const h of [...exitHandlers]) h();
    },
    resume: () => resume(),
    type(data) {
      for (const h of [...dataHandlers]) h(data);
    },
    write(data) {
      writes.push(typeof data === "string" ? data : new TextDecoder().decode(data));
    },
    onData(handler) {
      dataHandlers.add(handler);
      return () => dataHandlers.delete(handler);
    },
    onResize(handler) {
      resizeHandlers.add(handler);
      return () => resizeHandlers.delete(handler);
    },
    onExit(handler) {
      exitHandlers.add(handler);
      return () => exitHandlers.delete(handler);
    },
    suspend() {
      suspends += 1;
      return new Promise<void>((resolve) => {
        resume = resolve;
      });
    },
    size: () => size,
    setRawMode(next) {
      raw = next;
    },
    isTTY: true,
    writesToTerminal: true,
    env: { TERM: "xterm-256color" },
    start() {
      started = true;
    },
    stop() {
      started = false;
      resizeHandlers.clear();
      exitHandlers.clear();
      dataHandlers.clear();
    },
  };
}
