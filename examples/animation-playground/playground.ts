/**
 * The animation playground: every kind of motion rich-js has, on one
 * timeline, with the controls that move it.
 *
 * THIS IS A DEMO (`examples/animation-playground/`), run by `main.ts` in the
 * docs card and in Node alike. It runs on whatever `TerminalHost` it is
 * handed and reads the time off the `Clock` it is handed, so the program
 * never touches `process` [LAW:effects-at-boundaries].
 *
 * [LAW:one-source-of-truth] Playback is the app's `timeline` and nothing
 * else: pause, reverse, speed and seek are `Timeline` operations at the
 * clock's now, and the readout reads the timeline back. The three things a
 * host is handed once — reduced motion, the colour depth its environment
 * says, and the frame rate — are `Preferences`; changing one stops the app
 * and builds the next over the same host, clock and timeline, so the
 * animation goes on from the time it was at.
 */
import {
  Animation,
  Columns,
  Group,
  Layout,
  RichText,
  Segment,
  Table,
  Timeline,
  Viewport,
  SCROLLBAR,
  beat,
  frameAt,
  frameRate,
  render,
  type Anchor,
  type Clock,
  type Env,
  type Renderable,
  type RenderOptions,
} from "@promptctl/rich-js";
import { Button, TextInput, WidgetApp } from "@promptctl/rich-js/widgets";
import type { TerminalHost } from "@promptctl/rich-js/host";
import { KINDS, MUTED, TEXT, panel } from "./kinds.js";

/** The colour depths the playground can ask its terminal for, each by the environment variables colour detection reads. */
const DEPTHS = {
  truecolor: { FORCE_COLOR: "3", NO_COLOR: undefined },
  "16 colours": { FORCE_COLOR: "1", NO_COLOR: undefined },
  "no colour": { NO_COLOR: "1" },
} as const satisfies Record<string, Env>;
type Depth = keyof typeof DEPTHS;
const DEPTH_ORDER = Object.keys(DEPTHS) as Depth[];

const RATES = [60, 1] as const;
type Rate = (typeof RATES)[number];

/** What a host is handed once, when the app is built. */
interface Preferences {
  readonly reducedMotion: boolean;
  readonly depth: Depth;
  readonly fps: Rate;
}

/** How an app's run ended: the program is done, or it goes on in a new app with these preferences, from this timeline. */
type Outcome = { readonly kind: "quit" } | { readonly kind: "rebuild"; readonly preferences: Preferences; readonly timeline: Timeline };

/** `host`, its environment saying `depth`: everything else is the host's own. */
function atDepth(host: TerminalHost, depth: Depth): TerminalHost {
  const env: Env = { ...host.env, ...DEPTHS[depth] };
  return {
    env,
    get isTTY() {
      return host.isTTY;
    },
    get writesToTerminal() {
      return host.writesToTerminal;
    },
    get inputChunks() {
      return host.inputChunks;
    },
    write: (data) => host.write(data),
    onData: (handler) => host.onData(handler),
    onResize: (handler) => host.onResize(handler),
    size: () => host.size(),
    setRawMode: (raw) => host.setRawMode(raw),
    passWheel: (lines) => host.passWheel(lines),
    onExit: (handler) => host.onExit(handler),
    suspend: () => host.suspend(),
    start: () => host.start(),
    stop: () => host.stop(),
  };
}

// --- The scrub bar ---

/** The seconds the scrub bar spans: the window of the timeline `t` is in. */
const WINDOW = 30;
/** Its cells: a cell for every half second. */
const TRACK = 60;
/**
 * The cell the marker is on, stepping a cell every half second and around the
 * window again. The bar reads out where the time is, which is not motion, so
 * reduced it is itself: with motion reduced it still says where the timeline is.
 */
const steps = beat(Array.from({ length: TRACK }, () => WINDOW / TRACK));
const marker: Animation<number> = { at: (t) => steps.at(t), nextChange: (t) => steps.nextChange(t), lastChange: (t) => steps.lastChange(t), reduced: () => marker };

/** The scrub track's owner: what a press on the frame is matched against, by identity. */
const SCRUB = { name: "scrub track" };

/** The track with the marker on cell `col`, every cell anchored to `SCRUB` so a press finds which cell it landed on. */
function track(col: number): Renderable {
  const text = new RichText("", { end: "" });
  text.append("━".repeat(col), "#89b4fa");
  text.append("●", "bold #f9e2af");
  text.append("─".repeat(TRACK - col - 1), MUTED);
  return {
    render: (options: RenderOptions) => Segment.anchorLines([...Segment.splitLines(render(text, options))], SCRUB).flat(),
  };
}
const scrubbing = Animation.map(marker, track);

/** The `SCRUB` anchor in the chain of owners that drew a cell, if a `SCRUB` drew it. */
function scrubAnchor(anchor: Anchor | undefined): Anchor | undefined {
  return anchor === undefined || anchor.owner === SCRUB ? anchor : scrubAnchor(anchor.inner);
}

const seconds = (t: number): string => `${t.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/** One app's run, with these preferences, from this timeline; resolves with how it ended. */
async function session(host: TerminalHost, clock: Clock, preferences: Preferences, from: Timeline): Promise<Outcome> {
  const button = (label: string, variant: "default" | "primary" | "warning" | "danger" = "default"): Button => new Button({ label, variant });
  const playPause = button("play / pause", "primary");
  const reverse = button("reverse", "primary");
  const speeds = ([0.25, 1, 4] as const).map((speed) => [speed, button(`${speed}×`)] as const);
  const back = button("−5 s");
  const forward = button("+5 s");
  const far = button("seek 999 990 s");
  const motion = button("reduced motion", "warning");
  const depth = button("colour depth", "warning");
  const fps = button("frame rate", "warning");
  const quit = button("quit", "danger");
  const input = new TextInput({ placeholder: "type here: the caret blinks" });

  const gallery = new Viewport(new RichText(""), { scrollbar: SCROLLBAR });
  const caret = panel("TextInput · its caret");

  let outcome: Outcome = { kind: "quit" };

  const row = (...cells: Renderable[]): Table => {
    const grid = Table.grid({ padding: [0, 1] });
    cells.forEach(() => grid.addColumn());
    grid.addRow(...cells);
    return grid;
  };

  const view = (t: number): Renderable => {
    const timeline = app.timeline;
    const start = Math.floor(t / WINDOW) * WINDOW;
    const playback = `${timeline.playing ? "▶ playing" : "⏸ paused"} at ${Math.abs(timeline.rate)}×${timeline.rate < 0 ? " in reverse" : ""}`;
    const said = [
      `t = ${seconds(t)}`,
      playback,
      preferences.depth,
      `${preferences.fps} fps`,
      preferences.reducedMotion ? "motion reduced" : "full motion",
    ].join("  ·  ");
    gallery.content = new Columns([...KINDS.map((kind) => kind.draw(t)), caret(input)], { padding: [0, 1] });
    const controls = new Group(
      new RichText("animation playground — Tab moves between controls, Enter or a click presses, the wheel scrolls", { style: MUTED }),
      row(playPause, reverse, ...speeds.map(([, b]) => b), back, forward, far),
      row(motion, depth, fps, quit),
      row(new RichText(seconds(start), { style: MUTED }), frameAt(scrubbing, t), new RichText(seconds(start + WINDOW), { style: MUTED })),
      new RichText(said, { style: TEXT }),
    );
    const layout = new Layout();
    layout.splitColumn(new Layout(controls, { size: 5 }), new Layout(gallery));
    return layout;
  };

  const app = new WidgetApp({
    host: atDepth(host, preferences.depth),
    surface: "alternate",
    clock,
    timeline: from,
    rate: frameRate(preferences.fps),
    reducedMotion: preferences.reducedMotion,
    view,
  });

  // [LAW:one-source-of-truth] Every playback control is one `Timeline` operation on the app's timeline at the clock's now.
  const onTimeline = (b: Button, change: (timeline: Timeline, now: number) => Timeline): void => {
    b.onSubmit(() => {
      app.timeline = change(app.timeline, clock.now());
    });
  };
  onTimeline(playPause, (timeline, now) => (timeline.playing ? Timeline.pause(timeline, now) : Timeline.resume(timeline, now)));
  onTimeline(reverse, (timeline, now) => Timeline.withRate(timeline, now, -timeline.rate));
  for (const [speed, b] of speeds) onTimeline(b, (timeline, now) => Timeline.withRate(timeline, now, Math.sign(timeline.rate) * speed));
  onTimeline(back, (timeline, now) => Timeline.seek(timeline, now, Timeline.at(timeline, now) - 5));
  onTimeline(forward, (timeline, now) => Timeline.seek(timeline, now, Timeline.at(timeline, now) + 5));
  onTimeline(far, (timeline, now) => Timeline.seek(timeline, now, 999_990));

  // A preference is the next app's: this one ends, handing on the timeline as it is now.
  const onPreference = (b: Button, change: (preferences: Preferences) => Preferences): void => {
    b.onSubmit(() => {
      outcome = { kind: "rebuild", preferences: change(preferences), timeline: app.timeline };
      app.stop();
    });
  };
  onPreference(motion, (p) => ({ ...p, reducedMotion: !p.reducedMotion }));
  onPreference(depth, (p) => ({ ...p, depth: DEPTH_ORDER[(DEPTH_ORDER.indexOf(p.depth) + 1) % DEPTH_ORDER.length]! }));
  onPreference(fps, (p) => ({ ...p, fps: p.fps === 60 ? 1 : 60 }));
  quit.onSubmit(() => app.stop());

  // A press on the track seeks to the time under it: the window `t` is in, at the middle of the cell.
  app.onMouse((event) => {
    if (event.type !== "mouse_down") return;
    const hit = scrubAnchor(Segment.anchorAt(app.frame, event.x, event.y));
    if (hit === undefined) return;
    const now = clock.now();
    const start = Math.floor(Timeline.at(app.timeline, now) / WINDOW) * WINDOW;
    app.timeline = Timeline.seek(app.timeline, now, start + ((hit.col + 0.5) * WINDOW) / TRACK);
  });

  app.focusManager.focus(input);
  await app.run();
  return outcome;
}

/** Run the playground on `host`, reading the time off `clock`; settles once the reader quits and the terminal is handed back. */
export async function run(host: TerminalHost, clock: Clock): Promise<void> {
  let preferences: Preferences = { reducedMotion: false, depth: "truecolor", fps: 60 };
  let timeline = Timeline.play(clock.now());
  for (;;) {
    const outcome = await session(host, clock, preferences, timeline);
    if (outcome.kind === "quit") return;
    ({ preferences, timeline } = outcome);
  }
}
