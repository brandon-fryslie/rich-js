/**
 * rich-viewport demo body — a cursor walking a list taller than its window,
 * kept in view by `Viewport.ensureVisible`.
 *
 * The list is rebuilt every frame, as a view derived from state is, and handed
 * to the one `Viewport` that persists across frames: the scroll position lives
 * in the viewport, not in the content. The window scrolls only when the cursor
 * reaches its edge, the least distance that keeps the cursor in view.
 *
 * [LAW:dataflow-not-control-flow] `runDemo` takes a `TerminalHost` as a value;
 * node and browser bootstraps differ only in which host they construct.
 */

import { Console, Live, Panel, RichText, Viewport } from "../../src/index.js";
import { hostStream, type TerminalHost } from "../../src/host/index.js";

export interface DemoHandle {
  stop(): void;
}

const ENTRIES = Array.from({ length: 40 }, (_, i) => {
  const method = ["GET", "POST", "PUT", "DELETE"][i % 4]!;
  const status = i % 7 === 3 ? 500 : 200;
  return { text: `${String(i + 1).padStart(2)}  ${method.padEnd(6)} /api/items/${i * 13}`, status };
});

function list(selected: number): RichText {
  const text = new RichText("", { end: "" });
  ENTRIES.forEach((entry, i) => {
    const style = i === selected ? "reverse bold" : entry.status === 500 ? "red" : "";
    text.append(`${entry.text}  ${entry.status}${i < ENTRIES.length - 1 ? "\n" : ""}`, style);
  });
  return text;
}

/** The cursor's line on frame `frame`: down the list and back up again. */
function cursorAt(frame: number): number {
  const period = 2 * (ENTRIES.length - 1);
  const phase = frame % period;
  return phase < ENTRIES.length ? phase : period - phase;
}

export function runDemo(host: TerminalHost): DemoHandle {
  const { cols } = host.size();
  const consoleOut = new Console({ forceTerminal: true, file: hostStream(host), width: cols });
  const viewport = new Viewport(list(0), { rows: 8 });
  const frameFor = (selected: number): Panel => {
    viewport.content = list(selected);
    viewport.ensureVisible(selected, selected + 1);
    return new Panel(viewport, {
      title: `Viewport — line ${selected + 1} of ${ENTRIES.length}`,
      expand: false,
    });
  };

  const live = new Live(frameFor(0), { console: consoleOut, autoRefresh: false });
  live.start();
  let frame = 0;
  const timer = setInterval(() => {
    frame += 1;
    live.update(frameFor(cursorAt(frame)), { refresh: true });
  }, 120);

  return {
    stop(): void {
      clearInterval(timer);
      live.stop();
    },
  };
}
