/**
 * dropdown-demo — focused, standalone showcase of the Dropdown widget.
 *
 * Three Dropdowns exercise the three axes of variability the widget owns:
 *   - Short fixed list  → baseline collapsed/expanded paint
 *   - Long fixed list   → built-in type-to-filter narrowing (10+ options)
 *   - Mutating list     → options change at runtime so the overlay
 *                         re-anchors and the width invariant
 *                         (maxLabelLen + 4) is re-measured by Screen
 *
 * A status row beneath the widgets reads {selectedIndex, expanded,
 * highlightedIndex} live for each Dropdown — useful for spotting bugs
 * in keyboard navigation, mouse hit-testing, or commit.
 *
 * [LAW:one-source-of-truth] The three Dropdown instances are the canonical
 * state. The status row reads observables directly via MobX rather than
 * mirroring values into a side bag that could drift.
 *
 * [LAW:dataflow-not-control-flow] The mutation Dropdown swaps its
 * `options` array via runInAction; Dropdown's filteredOptions getter and
 * Screen's measure pass re-derive everything from the new data. Same
 * code path every frame.
 *
 * Run with: npm run demo:dropdown
 * Keyboard: Tab navigates · Enter/Space opens · printable filters ·
 *           Backspace undoes a filter char · Esc cancels · Ctrl-C exits.
 */

import { runInAction } from "mobx";
import {
  Dropdown,
  DefaultScreen,
  DefaultFocusManager,
  EventRouter,
  StaticItem,
  Segment,
  Style,
  ColorSpec,
} from "../../src/index.js";
import type {
  InteractiveWidget,
  MountEntry,
} from "../../src/widgets/types.js";
import type {
  Renderable,
  RenderOptions,
} from "../../src/core/protocol.js";

// --- Option lists ---

const SHORT_OPTIONS = ["Red", "Green", "Blue"];

// 18 entries — long enough that filtering is visibly useful. Mix of
// short/long labels so maxLabelLen is exercised.
const LONG_OPTIONS = [
  "Albacore",
  "Bluefin",
  "Cobia",
  "Dorado",
  "Escolar",
  "Flounder",
  "Grouper",
  "Halibut",
  "Ipswich Clam",
  "Jack Crevalle",
  "Kingfish",
  "Lingcod",
  "Mackerel",
  "Northern Pike",
  "Opah",
  "Pollock",
  "Queenfish",
  "Rainbow Trout",
];

// The mutating list cycles through three flavours so the overlay must
// re-anchor (different widths and option counts on each cycle).
const MUTATION_CYCLE: string[][] = [
  ["Draft", "Published"],
  ["Draft", "Review", "Approved", "Published", "Archived"],
  ["Pending", "In-Progress", "Done"],
];

// --- Widgets ---

const ddShort = new Dropdown({
  options: SHORT_OPTIONS,
  selectedIndex: 0,
  id: "dd-short",
});
const ddLong = new Dropdown({
  options: LONG_OPTIONS,
  selectedIndex: 0,
  id: "dd-long",
});
const ddMutating = new Dropdown({
  options: MUTATION_CYCLE[0]!,
  selectedIndex: 0,
  id: "dd-mutating",
});

const allWidgets: InteractiveWidget[] = [ddShort, ddLong, ddMutating];

// --- Screen / FocusManager / EventRouter ---

const fm = new DefaultFocusManager();
const screen = new DefaultScreen({ focusManager: fm, out: process.stdout });
const router = new EventRouter({
  screen,
  input: process.stdin,
  output: process.stdout,
});

// --- Static-content helpers (same shape as rich-config) ---

function styledLine(text: string, style: Style): Renderable {
  return {
    render(_options: RenderOptions): Iterable<Segment> {
      return [new Segment(text, style)];
    },
  };
}

const headerStyle = new Style({
  color: ColorSpec.fromRgb(0, 200, 200),
  bold: true,
});
const dimStyle = new Style({ dim: true });
const sectionStyle = new Style({
  color: ColorSpec.fromRgb(220, 200, 80),
  bold: true,
});
const labelStyle = new Style({
  color: ColorSpec.fromRgb(180, 180, 180),
});

const headerItem = new StaticItem({
  id: "static-header",
  render: styledLine("Dropdown demo", headerStyle),
});
const subtitleItem = new StaticItem({
  id: "static-subtitle",
  render: styledLine(
    "Tab cycles · Enter/Space opens · type to filter · Backspace · Esc · Ctrl-C to exit",
    dimStyle,
  ),
});

function spacer(id: string): StaticItem {
  return new StaticItem({ id, render: () => [new Segment(" ")] });
}

// Section labels printed before each Dropdown row. The Dropdown itself
// sits on the next flow row.
const shortLabel = new StaticItem({
  id: "static-short-label",
  render: styledLine("Short list — baseline collapse/expand", sectionStyle),
});
const longLabel = new StaticItem({
  id: "static-long-label",
  render: styledLine("Long list — type to filter (18 items)", sectionStyle),
});
const mutatingLabel = new StaticItem({
  id: "static-mutating-label",
  render: styledLine("Mutating list — options cycle every 3s", sectionStyle),
});

// One status row that summarises every Dropdown. Lives at a fixed y so
// expanded overlays from any Dropdown can paint over neighbouring flow
// rows without disturbing it — and because it reads observables on every
// frame, Screen re-renders whenever any Dropdown state changes.
function statusFragment(dd: Dropdown): Segment[] {
  return [
    new Segment(`${dd.id}: `, labelStyle),
    new Segment(`sel=${dd.selectedIndex} `),
    new Segment(`exp=${dd.expanded} `),
    new Segment(`hl=${dd.highlightedIndex}`),
  ];
}

const statusItem = new StaticItem({
  id: "static-status",
  render: (_options) => {
    const out: Segment[] = [
      new Segment("▸ ", sectionStyle),
    ];
    for (let i = 0; i < allWidgets.length; i++) {
      const w = allWidgets[i] as Dropdown;
      if (i > 0) out.push(new Segment("  |  ", dimStyle));
      out.push(...statusFragment(w));
    }
    return out;
  },
});

const cheatSheetItem = new StaticItem({
  id: "static-cheatsheet",
  render: styledLine(
    "filter keys → printable=narrow · backspace=undo · enter=commit · esc=cancel",
    dimStyle,
  ),
});

// --- Bottom-anchored coordinates (status row below the flow content) ---

const TERMINAL_ROWS = process.stdout.rows ?? 30;
const STATUS_Y = Math.max(15, TERMINAL_ROWS - 2);
const CHEAT_Y = STATUS_Y + 1;

// --- Mount layout ---

const mountList: MountEntry[] = [
  headerItem,
  subtitleItem,
  spacer("sp-1"),

  shortLabel,
  ddShort,
  spacer("sp-2"),

  longLabel,
  ddLong,
  spacer("sp-3"),

  mutatingLabel,
  ddMutating,

  { widget: statusItem, placement: { kind: "fixed", x: 0, y: STATUS_Y } },
  { widget: cheatSheetItem, placement: { kind: "fixed", x: 0, y: CHEAT_Y } },
];

// --- Input handling ---

// [LAW:single-enforcer] EventRouter owns the chain; only the global
// Ctrl-C and the click→focus policy live here.
router.onKey(
  (event) => {
    if (event.ctrl && event.key === "c") {
      shutdown();
      event.stop();
    }
  },
  { priority: "high" },
);

router.onMouse((event) => {
  if (event.type !== "mouse_up") return;
  const hit = focusableAt(event.x, event.y);
  if (hit) fm.focus(hit);
});

function focusableAt(x: number, y: number): InteractiveWidget | null {
  // Reverse iteration so an expanded Dropdown's overlay rows hit-test
  // before earlier widgets — same idiom as the kitchen-sink demo.
  for (let i = allWidgets.length - 1; i >= 0; i--) {
    const widget = allWidgets[i]!;
    if (widget.containsPoint(x, y)) return widget;
  }
  return null;
}

// --- Lifecycle ---

let mutationTimer: NodeJS.Timeout | null = null;

function startup(): void {
  if (!process.stdin.isTTY) {
    process.stderr.write(
      "Error: demo:dropdown requires an interactive terminal.\n",
    );
    process.exit(1);
  }

  // Alternate screen buffer — standard full-screen TUI idiom; main buffer
  // (shell prompt, scrollback) is restored on shutdown.
  process.stdout.write("\x1b[?1049h");
  process.stdout.write("\x1b[H");

  screen.mount(...mountList);

  // [LAW:dataflow-not-control-flow] The timer mutates data (options
  // array); Dropdown's measure/render and Screen's autorun re-derive
  // the new overlay placement on their own. No "tell the dropdown to
  // re-anchor" call — the data flow does it.
  let cycleIdx = 0;
  mutationTimer = setInterval(() => {
    cycleIdx = (cycleIdx + 1) % MUTATION_CYCLE.length;
    runInAction(() => {
      ddMutating.options = MUTATION_CYCLE[cycleIdx]!;
      // Clamp selection into the new range. Dropdown's clampIndex is
      // private, but selectedIndex setter accepts any number and the
      // headerText fallback handles out-of-range gracefully — still,
      // resetting to 0 keeps the demo output predictable.
      ddMutating.selectedIndex = 0;
    });
  }, 3000);

  screen.start();
  router.start();
}

function shutdown(): void {
  if (mutationTimer) {
    clearInterval(mutationTimer);
    mutationTimer = null;
  }
  router.stop();
  screen.stop();
  process.stdout.write("\x1b[?1049l");
  process.stdout.write("\x1b[1;36mGoodbye!\x1b[0m\n");
  process.exit(0);
}

process.once("SIGINT", () => shutdown());
process.once("SIGTERM", () => shutdown());

startup();
