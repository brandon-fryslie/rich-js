import type {
  XtermTerminal,
  XtermDisposable,
  XtermResizeEvent,
} from "../../src/host/terminal-host.js";

// ---------------------------------------------------------------------------
// FakeXtermTerminal — a hand-built `XtermTerminal` for contract testing.
//
// Mirrors xterm.js's `onData(string)` and `onResize({cols, rows})` shape.
// Exposes `emitData` / `setSize` so tests can drive the host from outside
// the way a real xterm.js terminal would when a user types or the
// browser resizes.
// ---------------------------------------------------------------------------
export class FakeXtermTerminal implements XtermTerminal {
  cols: number;
  rows: number;
  written: Array<Uint8Array | string> = [];
  private dataHandlers = new Set<(data: string) => void>();
  private resizeHandlers = new Set<(size: XtermResizeEvent) => void>();

  constructor(cols = 80, rows = 24) {
    this.cols = cols;
    this.rows = rows;
  }

  write(data: Uint8Array | string): void {
    this.written.push(data);
  }

  onData(handler: (data: string) => void): XtermDisposable {
    this.dataHandlers.add(handler);
    return { dispose: () => this.dataHandlers.delete(handler) };
  }

  onResize(handler: (size: XtermResizeEvent) => void): XtermDisposable {
    this.resizeHandlers.add(handler);
    return { dispose: () => this.resizeHandlers.delete(handler) };
  }

  emitData(data: string): void {
    for (const h of this.dataHandlers) h(data);
  }

  setSize(cols: number, rows: number): void {
    this.cols = cols;
    this.rows = rows;
    for (const h of this.resizeHandlers) h({ cols, rows });
  }

  get dataHandlerCount(): number {
    return this.dataHandlers.size;
  }

  get resizeHandlerCount(): number {
    return this.resizeHandlers.size;
  }
}
