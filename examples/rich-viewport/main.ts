/**
 * rich-viewport: a cursor you move through a list taller than its window,
 * kept in view by `Viewport.ensureVisible`.
 *
 * The entry for `npm run viewport` and for the demo's card on the docs site
 * alike. In the card it runs on the page's stand-in process, so the terminal
 * is the card's and the keys are the card's while it has focus.
 *
 * The list is rebuilt every frame, as a view derived from state is, and handed
 * to the one `Viewport` that persists across frames: the scroll position lives
 * in the viewport, not in the content. The window moves only when the cursor
 * reaches its edge, the least distance that keeps the cursor in view, and the
 * scrollbar's thumb follows the offset each render resolves. The mouse wheel
 * scrolls the window with no code here: `WidgetApp` does that for any viewport
 * under the pointer.
 */
import { Group, Panel, RichText, SCROLLBAR, Viewport, moveSelection } from "@promptctl/rich-js";
import { WidgetApp } from "@promptctl/rich-js/widgets";
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";

const ENTRIES = Array.from({ length: 40 }, (_, i) => {
  const method = ["GET", "POST", "PUT", "DELETE"][i % 4]!;
  const status = i % 7 === 3 ? 500 : 200;
  return { text: `${String(i + 1).padStart(2)}  ${method.padEnd(6)} /api/items/${i * 13}`, status };
});
const ROWS = 8;

function list(selected: number): RichText {
  // One line per entry, so an entry's index is its line: `ensureVisible`
  // counts the lines the content renders to, and a wrapped entry would span two.
  const text = new RichText("", { end: "", noWrap: true, overflow: "ellipsis" });
  ENTRIES.forEach((entry, i) => {
    const style = i === selected ? "reverse bold" : entry.status === 500 ? "red" : "";
    text.append(`${entry.text}  ${entry.status}${i < ENTRIES.length - 1 ? "\n" : ""}`, style);
  });
  return text;
}

// How far each key moves the cursor: a line, a window's height, or to either end.
const MOVES = new Map<string, number>([
  ["up", -1], ["k", -1],
  ["down", 1], ["j", 1],
  ["pageup", -ROWS],
  ["pagedown", ROWS],
  ["home", -Infinity],
  ["end", Infinity],
]);

const host = new NodeTerminalHost();
if (!host.isTTY) {
  process.stderr.write("Error: npm run viewport requires an interactive terminal.\n");
  process.exit(1);
}

let selected = 0;
// The list's scroll position; the view shows the list it builds through it.
const viewport = new Viewport({ rows: ROWS, scrollbar: SCROLLBAR });
const app = new WidgetApp({
  host,
  surface: "alternate",
  view: () => {
    return new Group(
      new Panel(viewport.showing(list(selected)), { title: `Viewport — line ${selected + 1} of ${ENTRIES.length}`, expand: false }),
      new RichText("↑↓ or j k move · PgUp PgDn page · Home End jump · wheel scrolls · q quits", { style: "dim" }),
    );
  },
});

app.onKey((event) => {
  if (event.key === "q") return app.stop();
  // A chord is not its letter: Ctrl+K arrives as `k` with `ctrl` set.
  if (event.ctrl || event.meta) return;
  const move = MOVES.get(event.key);
  if (move === undefined) return;
  selected = moveSelection(selected, move, ENTRIES.length);
  // Brought into view when it moves, not every frame, so the wheel can scroll
  // the window away from the cursor and the next key brings it back.
  viewport.ensureVisible(selected, selected + 1);
  app.refresh();
});

await app.run();
