/**
 * The acceptance test of rich-runtime-fna: a widget demo, unmodified, run
 * full-screen with its widgets in a `Panel` in one pane of a `Layout` split —
 * and driven as a user drives it, by the bytes a terminal sends for keys and
 * clicks, read back off the frame the user would see.
 *
 * [LAW:behavior-not-structure] Nothing here reaches into the demo. Every
 * position is found by reading the painted characters, every effect is read
 * off the screen — the demo's own status and log rows — so the test holds for
 * any layout that puts the same widgets on screen.
 *
 * The node host runs it here, over streams; `e2e/rich-config.spec.ts` runs the
 * same demo under the browser host in a real xterm.js.
 */

import { describe, it, expect, afterEach } from "vitest";
import { PassThrough, Writable } from "stream";
import { NodeTerminalHost } from "../../../src/node/terminal-host.js";
import { cellLen } from "../../../src/core/cells.js";
import { runDemo, type DemoHandle } from "../../../examples/rich-config/app.js";

const ALT_ON = "\x1b[?1049h";
const ALT_OFF = "\x1b[?1049l";

class TerminalOut extends Writable {
  readonly isTTY = true;
  readonly columns = 100;
  readonly rows = 30;
  private readonly chunks: string[] = [];

  override _write(chunk: Buffer | string, _encoding: BufferEncoding, done: () => void): void {
    this.chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    done();
  }

  written(): string {
    return this.chunks.join("");
  }
}

interface Session {
  readonly demo: DemoHandle;
  readonly out: TerminalOut;
  /** Bytes arriving from the terminal. */
  send(data: string): void;
}

let running: Session | undefined;

function start(): Session {
  const stdin = new PassThrough();
  const out = new TerminalOut();
  const demo = runDemo(new NodeTerminalHost({ stdin, stdout: out }));
  running = { demo, out, send: (data) => stdin.write(data) };
  return running;
}

afterEach(async () => {
  running?.demo.stop();
  await running?.demo.done;
  running = undefined;
});

/** The frame's rows as the user reads them. */
function screen({ demo }: Session): string[] {
  return demo.frame.map((line) => line.map((segment) => segment.text).join(""));
}

/** The cell where `target` first appears on screen. */
function find(session: Session, target: string | RegExp): { x: number; y: number } {
  const rows = screen(session);
  const at = rows.map((row) => (typeof target === "string" ? row.indexOf(target) : row.search(target)));
  const y = at.findIndex((i) => i >= 0);
  expect(y, `${String(target)} is on screen:\n${rows.join("\n")}`).toBeGreaterThanOrEqual(0);
  // A string index counts code units; the terminal counts cells.
  return { x: cellLen(rows[y]!.slice(0, at[y])), y };
}

/** Wait for the frame to show `text` — frames paint a task after a change. */
async function shows(session: Session, text: string): Promise<void> {
  await expect.poll(() => screen(session).join("\n")).toContain(text);
}

// A press and release on one cell, as an SGR-reporting terminal sends them
// (1-based).
const click = ({ x, y }: { x: number; y: number }): string =>
  `\x1b[<0;${x + 1};${y + 1}M\x1b[<0;${x + 1};${y + 1}m`;

const TAB = "\t";

describe("rich-config, full-screen, its widgets in a Panel in a Layout pane", () => {
  it("draws the widgets inside the panel, beside the preview", async () => {
    const session = start();
    await shows(session, "Muted");
    const rows = screen(session);
    const widgets = find(session, "─ Widgets ─");
    const preview = find(session, "─ Preview ─");
    // One row holds both panel titles: the layout split the screen into columns.
    expect(preview.y).toBe(widgets.y);
    expect(preview.x).toBeGreaterThan(widgets.x);
    // The checkbox sits inside the Widgets panel's border, not at the screen edge.
    const muted = find(session, "Muted");
    expect(rows[muted.y]!.startsWith("│")).toBe(true);
    expect(muted.x).toBeGreaterThan(1);
    expect(muted.y).toBeGreaterThan(widgets.y);
  });

  it("takes the alternate screen and hands it back on Ctrl-C", async () => {
    const session = start();
    await shows(session, "Muted");
    expect(session.out.written().startsWith(ALT_ON)).toBe(true);
    session.send("\x03");
    await session.demo.done;
    expect(session.out.written().endsWith(ALT_OFF)).toBe(true);
  });

  it("moves focus through the panel's widgets in the order they are drawn", async () => {
    const session = start();
    // A disabled button takes no focus, so the Locked button is passed over.
    const order = [
      "dd-theme", "in-search", "cb-muted", "cb-ansi", "cb-progress", "tg-dark-only",
      "sl-contrast", "sl-fill", "btn-export", "btn-reset", "dd-theme",
    ];
    await shows(session, `▸ ${order[0]} `);
    for (const id of order.slice(1)) {
      session.send(TAB);
      await shows(session, `▸ ${id} `);
    }
  });

  it("gives a key to the widget focused in the panel", async () => {
    const session = start();
    await shows(session, "▸ dd-theme ");
    session.send(TAB + TAB);
    await shows(session, "▸ cb-muted ");
    session.send(" ");
    await shows(session, "Muted swatches → hidden");
  });

  it("gives a click to the widget drawn under it, and focuses it", async () => {
    const session = start();
    await shows(session, "[✓] Progress");
    expect(screen(session).join("\n")).toContain("━━━");

    session.send(click(find(session, "[✓] Progress")));

    await shows(session, "Progress bars → hidden");
    await shows(session, "▸ cb-progress ");
    await shows(session, "[ ] Progress");
    // The widget in one pane drives what the other pane draws.
    expect(screen(session).join("\n")).not.toContain("━━━");
  });

  it("types into the text input a click focused", async () => {
    const session = start();
    await shows(session, "palette 29/29");
    // Unfocused and empty, the search box draws its brackets and nothing else.
    session.send(click(find(session, /\[ +\]/)));
    await shows(session, "▸ in-search ");

    session.send("err\r");

    await shows(session, 'Palette search: "err"');
    expect(screen(session).join("\n")).not.toContain("palette 29/29");
  });

  it("opens the dropdown's list over the panel, and a click on an option picks it", async () => {
    const session = start();
    await shows(session, "▾]");
    session.send(click(find(session, "▾]")));
    await shows(session, "Nord");

    session.send(click(find(session, "Nord")));

    await shows(session, "Switched to Nord theme");
    // The preview pane's title panel names the theme the list picked.
    await shows(session, "│ Nord ");
  });
});
