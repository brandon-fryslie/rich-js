/**
 * rich-themes-transposed/explore — interactive OKLCH theme explorer.
 *
 * A persistent full-height theme column on the left; a live transposition
 * preview on the right. ↑/↓ flips the selected theme and everything repaints
 * instantly; Tab picks a control; ←/→ turns it. The transposition controls
 * keep their values across theme changes, so you can hold a "root note" and
 * page through every theme in that key.
 *
 * [LAW:single-enforcer] EventRouter owns stdin → KeyEvent parsing, raw mode,
 * and the dispatch chain. DefaultScreen owns reactive repaint. This file only
 * holds the observable state and wires keys to the pure `reduce`.
 *
 * [LAW:dataflow-not-control-flow] The StaticItem render reads `store.state`
 * (observable) and returns `renderFrame(state)`. Screen re-renders whenever
 * the state changes — there is no "on key, repaint" call; the data flow does
 * it. Every frame runs the same pure render of the current state.
 *
 * Non-interactive guard: requires a TTY. Run via `just oklsh`.
 */

import { makeAutoObservable, runInAction } from "mobx";
import {
  DefaultScreen,
  DefaultFocusManager,
  EventRouter,
  StaticItem,
} from "../../src/index.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import {
  initialState,
  reduce,
  renderFrame,
  framesToSegments,
  type ExplorerState,
  type KeyInput,
} from "./model.js";

// Keys this app claims; everything else falls through unchanged.
const CLAIMED = new Set(["up", "down", "left", "right", "tab"]);

class Store {
  state: ExplorerState = initialState();
  constructor() {
    makeAutoObservable(this);
  }
  apply(input: KeyInput): void {
    this.state = reduce(this.state, input);
  }
}

const store = new Store();

const frameItem = new StaticItem({
  id: "explorer-frame",
  render: (opts: RenderOptions) => {
    const height = process.stdout.rows ?? 30;
    return framesToSegments(renderFrame(store.state, opts.maxWidth, height));
  },
});

const fm = new DefaultFocusManager();
const screen = new DefaultScreen({ focusManager: fm, out: process.stdout });
const router = new EventRouter({
  screen,
  input: process.stdin,
  output: process.stdout,
});

// [LAW:single-enforcer] One high-priority handler. It feeds every key to the
// reducer and claims the navigation keys so the router's default Tab→focus
// traversal doesn't also fire (there are no focusable widgets anyway).
router.onKey(
  (event) => {
    if ((event.ctrl && event.key === "c") || event.character === "q") {
      shutdown();
      event.stop();
      return;
    }
    runInAction(() => {
      store.apply({ key: event.key, character: event.character, shift: event.shift });
    });
    if (CLAIMED.has(event.key) || event.character === "r") event.stop();
  },
  { priority: "high" },
);

function startup(): void {
  if (!process.stdin.isTTY) {
    process.stderr.write(
      "Error: the theme explorer requires an interactive terminal (TTY).\n",
    );
    process.exit(1);
  }
  process.stdout.write("\x1b[?1049h");
  process.stdout.write("\x1b[H");
  screen.mount(frameItem);
  screen.start();
  router.start();
}

function shutdown(): void {
  router.stop();
  screen.stop();
  process.stdout.write("\x1b[?1049l");
  process.stdout.write("\x1b[1;36mGoodbye!\x1b[0m\n");
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

startup();
