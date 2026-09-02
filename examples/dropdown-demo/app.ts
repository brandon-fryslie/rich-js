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

import { runInAction, observable, action } from "mobx";
import {
  Dropdown,
  DefaultScreen,
  DefaultFocusManager,
  EventRouter,
  StaticItem,
  WidgetBase,
  FLOW,
  hasOverlay,
  KeyEvent,
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

/**
 * A widget the library does not ship, to show what the widget set is built on.
 * `WidgetBase` supplies the whole InteractiveWidget contract except its
 * abstracts — `id`, `focusable`, `handleKey`, `render`, `measure` — so a custom
 * widget is those, and nothing else: no focus bookkeeping, no hover state, no
 * hit-testing, no change/submit plumbing.
 *
 * This one shows the last key it was handed, which makes the KeyEvent contract
 * visible: the router hands the *focused* widget its key, and `event.stop()`
 * is how a widget claims one. Space is claimed here; Tab is not, so Tab still
 * reaches the router's focus traversal.
 */
class KeyEchoWidget extends WidgetBase {
  readonly id = "key-echo";
  readonly focusable = true;
  @observable accessor lastKey = "(none yet)";
  @observable accessor claimed = 0;

  @action
  handleKey(event: KeyEvent): void {
    this.lastKey =
      `key=${event.key} char=${JSON.stringify(event.character)} ` +
      `shift=${event.shift} ctrl=${event.ctrl} meta=${event.meta}`;
    // Claim only the space bar, so Tab still reaches focus traversal.
    if (event.key !== "space") return;
    this.claimed += 1;
    event.stop();
  }

  render(_options: RenderOptions): Iterable<Segment> {
    const label = this.focused ? "custom widget (focused)" : "custom widget";
    return [
      new Segment(`${label}: `, new Style({ dim: !this.focused })),
      new Segment(this.lastKey),
      new Segment(`  spaces claimed: ${this.claimed}`, new Style({ dim: true })),
    ];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 20, maximum: 100 };
  }
}

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

  const keyEcho = new KeyEchoWidget();

  // [LAW:types-are-the-program] `dropdowns` keeps the status line's element
  // type honest: it reads `selectedIndex`/`expanded`, which only a Dropdown
  // has. `allWidgets` is the wider focus/hit-test list and needs no cast.
  const dropdowns: Dropdown[] = [ddShort, ddLong, ddMutating];
  const allWidgets: InteractiveWidget[] = [...dropdowns, keyEcho];

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
      for (const [i, dd] of dropdowns.entries()) {
        if (i > 0) out.push(new Segment("  |  ", dimStyle));
        out.push(...statusFragment(dd));
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

  const customLabel = new StaticItem({
    id: "static-custom-label",
    render: styledLine("Custom widget — WidgetBase subclass, echoes its keys", sectionStyle),
  });

  // `hasOverlay` is the host's own test for the overlay protocol: a widget
  // opts in by having `renderOverlay`, and the Screen runs the overlay pass
  // for exactly those. The Dropdowns paint their expanded list that way; the
  // custom widget below does not, and the line reports the difference.
  const overlayItem = new StaticItem({
    id: "static-overlay",
    render: styledLine(
      "overlay protocol → " +
        allWidgets.map((w) => `${w.id}=${hasOverlay(w)}`).join(" · "),
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
    spacer("sp-4"),

    customLabel,
    // A bare widget in the mount list gets flow placement by default; `FLOW`
    // is that default written out, and the only other placement kind is the
    // explicit `{ kind: "fixed", x, y }` used for the two footer rows below.
    { widget: keyEcho, placement: FLOW },
    overlayItem,

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

  // [LAW:types-are-the-program] mutationTimer is initialised to null BEFORE
  // `handle` so `handle.stop()` is structurally safe to call during partial
  // startup (e.g. when the alt-screen has been entered but setInterval hasn't
  // yet assigned). The discriminator "timer running?" lives in the value.
  let mutationTimer: ReturnType<typeof setInterval> | null = null;
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

  // [LAW:single-enforcer] Alt-screen state has exactly one restore site
  // (`handle.stop()`). The startup block below enters the alt-screen and
  // brings the screen/router online; if anything in here throws, the catch
  // routes through the same `handle.stop()` so the restore sequence runs
  // and the terminal is never left in the alternate buffer.
  try {
    // Alt-screen buffer — main buffer is restored on stop().
    host.write("\x1b[?1049h\x1b[H");
    screen.mount(...mountList);
    let cycleIdx = 0;
    mutationTimer = setInterval(() => {
      cycleIdx = (cycleIdx + 1) % MUTATION_CYCLE.length;
      runInAction(() => {
        ddMutating.options = MUTATION_CYCLE[cycleIdx]!;
        ddMutating.selectedIndex = 0;
      });
    }, 3000);
    screen.start();
    router.start();
  } catch (err) {
    handle.stop();
    throw err;
  }

  return handle;
}
