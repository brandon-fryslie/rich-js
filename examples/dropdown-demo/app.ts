/**
 * dropdown-demo body — three Dropdowns exercising baseline, filter, and
 * mutation paths. [LAW:dataflow-not-control-flow]
 *
 * The demo runs against any `TerminalHost`. Node bootstraps with
 * `NodeTerminalHost`; the browser bootstrap with `BrowserTerminalHost`. The
 * code path here is identical in both — the host is the value that differs.
 *
 * Keyboard: Tab navigates · Enter/Space opens · printable filters ·
 *           Backspace undoes a filter char · Esc cancels.
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
  type TerminalHost,
} from "../../src/index.js";
import type {
  InteractiveWidget,
  MountEntry,
} from "../../src/widgets/types.js";
import type {
  Renderable,
  RenderOptions,
} from "../../src/core/protocol.js";

export interface DemoHandle {
  stop(): void;
}

export interface RunDemoOptions {
  /**
   * Called when the user signals shutdown from inside the demo (e.g. Ctrl-C)
   * after demo state has been torn down. The node bootstrap supplies a
   * `process.exit(0)` here; the browser bootstrap can omit it.
   */
  onShutdown?: () => void;
}

const SHORT_OPTIONS = ["Red", "Green", "Blue"];

const LONG_OPTIONS = [
  "Albacore", "Bluefin", "Cobia", "Dorado", "Escolar", "Flounder",
  "Grouper", "Halibut", "Ipswich Clam", "Jack Crevalle", "Kingfish",
  "Lingcod", "Mackerel", "Northern Pike", "Opah", "Pollock", "Queenfish",
  "Rainbow Trout",
];

const MUTATION_CYCLE: string[][] = [
  ["Draft", "Published"],
  ["Draft", "Review", "Approved", "Published", "Archived"],
  ["Pending", "In-Progress", "Done"],
];

export function runDemo(host: TerminalHost, options?: RunDemoOptions): DemoHandle {
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

  const fm = new DefaultFocusManager();
  const screen = new DefaultScreen({ focusManager: fm, host });
  const router = new EventRouter({ screen, host });

  const styledLine = (text: string, style: Style): Renderable => ({
    render(_options: RenderOptions): Iterable<Segment> {
      return [new Segment(text, style)];
    },
  });

  const headerStyle = new Style({ color: ColorSpec.fromRgb(0, 200, 200), bold: true });
  const dimStyle = new Style({ dim: true });
  const sectionStyle = new Style({ color: ColorSpec.fromRgb(220, 200, 80), bold: true });
  const labelStyle = new Style({ color: ColorSpec.fromRgb(180, 180, 180) });

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

  const spacer = (id: string): StaticItem =>
    new StaticItem({ id, render: () => [new Segment(" ")] });

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

  const statusFragment = (dd: Dropdown): Segment[] => [
    new Segment(`${dd.id}: `, labelStyle),
    new Segment(`sel=${dd.selectedIndex} `),
    new Segment(`exp=${dd.expanded} `),
    new Segment(`hl=${dd.highlightedIndex}`),
  ];

  const statusItem = new StaticItem({
    id: "static-status",
    render: (_options) => {
      const out: Segment[] = [new Segment("▸ ", sectionStyle)];
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

  const TERMINAL_ROWS = host.size().rows;
  const STATUS_Y = Math.max(15, TERMINAL_ROWS - 2);
  const CHEAT_Y = STATUS_Y + 1;

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

  // [LAW:single-enforcer] EventRouter owns the chain; the demo only adds a
  // global Ctrl-C handler and the click→focus policy.
  const focusableAt = (x: number, y: number): InteractiveWidget | null => {
    for (let i = allWidgets.length - 1; i >= 0; i--) {
      const widget = allWidgets[i]!;
      if (widget.containsPoint(x, y)) return widget;
    }
    return null;
  };

  let stopped = false;
  const handle: DemoHandle = {
    stop(): void {
      if (stopped) return;
      stopped = true;
      if (mutationTimer !== null) {
        clearInterval(mutationTimer);
        mutationTimer = null;
      }
      router.stop();
      screen.stop();
      host.write("\x1b[?1049l\x1b[1;36mGoodbye!\x1b[0m\n");
    },
  };

  router.onKey(
    (event) => {
      if (event.ctrl && event.key === "c") {
        handle.stop();
        options?.onShutdown?.();
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

  // Alt-screen buffer — main buffer is restored on stop().
  host.write("\x1b[?1049h\x1b[H");

  screen.mount(...mountList);

  let cycleIdx = 0;
  let mutationTimer: ReturnType<typeof setInterval> | null = setInterval(() => {
    cycleIdx = (cycleIdx + 1) % MUTATION_CYCLE.length;
    runInAction(() => {
      ddMutating.options = MUTATION_CYCLE[cycleIdx]!;
      ddMutating.selectedIndex = 0;
    });
  }, 3000);

  screen.start();
  router.start();

  return handle;
}
