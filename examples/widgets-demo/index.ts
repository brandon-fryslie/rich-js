/**
 * widgets-demo — interactive showcase of the rich-js widget framework.
 *
 * Mounts one of each widget type into a DefaultScreen and routes raw
 * stdin through an EventRouter. A StateRow widget reads each widget's
 * observable state and renders a "live status" line; MobX's autorun in
 * Screen automatically re-draws when any of those observables change.
 *
 * Run with: npm run widgets-demo
 * Press Tab to navigate · Space/Enter to interact · Ctrl-C to exit.
 */

import {
  Button,
  Checkbox,
  Toggle,
  TextInput,
  Dropdown,
  Slider,
  DefaultScreen,
  EventRouter,
} from "../../src/index.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { ColorSpec, DEFAULT_TERMINAL_THEME } from "../../src/core/color.js";
import type { RenderOptions } from "../../src/core/protocol.js";
import type { KeyEvent } from "../../src/widgets/types.js";
import { WidgetBase } from "../../src/widgets/widget-base.js";

// --- Widgets ---

const button = new Button({ label: "Save", variant: "primary", id: "btn-save" });
const checkbox = new Checkbox({ label: "Subscribe to newsletter", id: "cb-news" });
const toggle = new Toggle({ label: "Notifications", variant: "success", id: "tg-notif" });
const textInput = new TextInput({ placeholder: "Enter your name", id: "in-name" });
const dropdown = new Dropdown({
  options: ["Light", "Dark", "Solarized", "Monokai"],
  id: "dd-theme",
});
const slider = new Slider({ value: 40, min: 0, max: 100, step: 5, width: 25, id: "sl-volume" });

// --- Static rows: header + footer (rendered as widgets so they share the
//     Screen layout pipeline; visible=true keeps them in the column). ---

class StaticTextRow extends WidgetBase {
  readonly focusable = false;
  constructor(readonly id: string, private readonly text: string) {
    super();
  }
  handleKey(_event: KeyEvent): void {}
  render(_options: RenderOptions): Iterable<Segment> {
    return [new Segment(this.text, new Style({ bold: true }))];
  }
  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: this.text.length, maximum: this.text.length };
  }
}

const titleRow = new StaticTextRow("title", "rich-js widgets demo");
const helpRow = new StaticTextRow("help", "Tab: focus  ·  Space/Enter: interact  ·  Ctrl-C: exit");

// --- Live status row: reads every widget's observables in render(). MobX's
//     autorun (in Screen) subscribes to whatever was read on the last render
//     and refires when any of those observables change. ---

class StateRow extends WidgetBase {
  readonly id = "state-row";
  readonly focusable = false;

  handleKey(_event: KeyEvent): void {}

  render(_options: RenderOptions): Iterable<Segment> {
    // [LAW:dataflow-not-control-flow] same render every frame; the
    // observed values produce the variability via their string forms.
    const sliderFraction = (slider.value - slider.min) / (slider.max - slider.min);
    const focusedId = focusedWidgetId();
    const status =
      `[focus=${focusedId}]  ` +
      `Checked: ${checkbox.checked}  ` +
      `Toggle: ${toggle.on ? "ON" : "OFF"}  ` +
      `Name: ${JSON.stringify(textInput.value)}  ` +
      `Theme: ${dropdown.options[dropdown.selectedIndex] ?? "-"}  ` +
      `Volume: ${slider.value} (${sliderFraction.toFixed(2)})`;

    const palette = DEFAULT_TERMINAL_THEME.palette;
    const fg = ColorSpec.fromRgba(palette.get("text-primary")!);
    return [new Segment(status, new Style({ color: fg }))];
  }

  measure(_options: RenderOptions): { minimum: number; maximum: number } {
    return { minimum: 40, maximum: 200 };
  }
}

const stateRow = new StateRow();

function focusedWidgetId(): string {
  const w = screen.focusManager.current;
  return w ? w.id : "(none)";
}

// --- Screen + EventRouter ---

const screen = new DefaultScreen();
const router = new EventRouter({ screen });

// [LAW:single-enforcer] Router.onKey is the one place that handles
// process-level keystrokes (Ctrl-C exit). Per-widget keys still flow
// through focusManager.current.handleKey via dispatchKey.
router.onKey((event) => {
  if (event.ctrl && event.key === "c") shutdown(0);
});

screen.mount(
  titleRow,
  button,
  checkbox,
  toggle,
  textInput,
  dropdown,
  slider,
  stateRow,
  helpRow,
);

// --- Submission logging through onSubmit handlers (visible via stateRow
//     since stateRow re-renders on any tracked observable). ---

button.onSubmit(() => { /* no-op for demo; could trigger a save action */ });

// --- Lifecycle ---

let stopped = false;
function shutdown(code = 0): void {
  if (stopped) return;
  stopped = true;
  router.stop();
  screen.stop();
  process.stdout.write("\n");
  process.exit(code);
}

process.once("SIGINT", () => shutdown(0));
process.once("SIGTERM", () => shutdown(0));

if (!process.stdin.isTTY) {
  process.stderr.write("widgets-demo requires an interactive terminal (TTY).\n");
  process.exit(1);
}

screen.start();
router.start();
