/**
 * dropdown-demo body — three Dropdowns exercising baseline, filter, and
 * mutation paths. [LAW:dataflow-not-control-flow]
 *
 * The demo runs against any `TerminalHost`. Node bootstraps with
 * `NodeTerminalHost`; the browser bootstrap with `BrowserTerminalHost`. The
 * code path here is identical in both — the host is the value that differs.
 *
 * The widgets are laid out by composition — a `Group` for the body, a
 * `Layout` that keeps the status rows at the bottom of the screen — and
 * `WidgetApp` finds them wherever they land.
 *
 * Keyboard: Tab navigates · Enter/Space opens · printable filters ·
 *           Backspace undoes a filter char · Esc cancels.
 */

import { runInAction, observable, action } from "mobx";
import { Segment, Style, ColorSpec, Group, Layout } from "../../src/index.js";
import {
  Dropdown,
  WidgetApp,
  widgetAt,
  StaticItem,
  WidgetBase,
  hasOverlay,
  KeyEvent,
} from "../../src/widgets/index.js";
import type { TerminalHost } from "../../src/host/index.js";
import type { InteractiveWidget } from "../../src/widgets/types.js";
import type {
  Renderable,
  RenderOptions,
} from "../../src/core/protocol.js";

export interface DemoHandle {
  stop(): void;
  /** Settles once the demo has stopped and handed the terminal back. */
  readonly done: Promise<void>;
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
 * abstracts — `id`, `focusable`, `handleKey`, `draw`, `measure` — so a custom
 * widget is those, and nothing else: no focus bookkeeping, no hover state, no
 * hit-testing, no change/submit plumbing.
 *
 * This one shows the last key it was handed, which makes the KeyEvent contract
 * visible: the app hands the *focused* widget its key, and `event.stop()`
 * is how a widget claims one. Space is claimed here; Tab is not, so Tab still
 * reaches the app's focus traversal.
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

  protected draw(_options: RenderOptions): Iterable<Segment> {
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

export function runDemo(host: TerminalHost): DemoHandle {
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
  // has. `allWidgets` is the wider list the overlay readout walks and needs no cast.
  const dropdowns: Dropdown[] = [ddShort, ddLong, ddMutating];
  const allWidgets: InteractiveWidget[] = [...dropdowns, keyEcho];

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

  // `hasOverlay` is the runtime's own test for the overlay protocol: a widget
  // opts in by having `renderOverlay`, and WidgetApp paints the overlays of
  // exactly those. The Dropdowns paint their expanded list that way; the
  // custom widget below does not, and the line reports the difference.
  const overlayItem = new StaticItem({
    id: "static-overlay",
    render: styledLine(
      "overlay protocol → " +
        allWidgets.map((w) => `${w.id}=${hasOverlay(w)}`).join(" · "),
      dimStyle,
    ),
  });

  // The body flows down from the top; the status rows hold the bottom two
  // rows of the screen, whatever its height.
  const body = new Group(
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
    keyEcho,
    overlayItem,
  );
  const view = new Layout();
  view.splitColumn(new Layout(body), new Layout(new Group(statusItem, cheatSheetItem), { size: 2 }));

  const app = new WidgetApp({ host, surface: "alternate", view: () => view });

  // [LAW:single-enforcer] The app owns the terminal and hands it back on
  // every path out; the demo only adds a global Ctrl-C handler and the
  // click→focus policy.
  app.onKey(
    (event) => {
      if (event.ctrl && event.key === "c") {
        app.stop();
        event.stop();
      }
    },
    { priority: "high" },
  );

  app.onMouse((event) => {
    if (event.type !== "mouse_up") return;
    // The frame on screen says who drew the cell under the pointer; focus()
    // ignores a widget that cannot take focus.
    const hit = widgetAt(app.frame, event.x, event.y);
    if (hit) app.focusManager.focus(hit.widget);
  });

  let cycleIdx = 0;
  const mutationTimer = setInterval(() => {
    cycleIdx = (cycleIdx + 1) % MUTATION_CYCLE.length;
    runInAction(() => {
      ddMutating.options = MUTATION_CYCLE[cycleIdx]!;
      ddMutating.selectedIndex = 0;
    });
  }, 3000);

  return {
    stop: () => app.stop(),
    done: app.run().finally(() => clearInterval(mutationTimer)),
  };
}
