/**
 * The animation playground: every kind of motion rich-js has, on one
 * timeline, with the controls that move it.
 *
 * THIS IS A DEMO (`examples/animation-playground/`), run by `main.ts` in the
 * docs card and in Node alike. It runs on whatever `TerminalHost` it is
 * handed and reads the time off the `Clock` it is handed, so the program
 * never touches `process` [LAW:effects-at-boundaries].
 *
 * [LAW:one-source-of-truth] Playback is the app's `timeline` and the frame
 * rate is the app's `rate`, and nothing else: pause, reverse, speed and seek
 * are `Timeline` operations at the clock's now, and the readout reads both
 * back. The two things an app is handed once — reduced motion and the colour
 * depth its environment says — are `Preferences`; changing one stops the app
 * and builds the next over the same host, clock, widgets and gallery, handing
 * on the timeline, the rate and the focus, so the animation goes on from the
 * time it was at with nothing the reader did undone.
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
  frameRate,
  render,
  type Anchor,
  type Clock,
  type Env,
  type FrameRate,
  type Renderable,
  type RenderOptions,
} from "@promptctl/rich-js";
import { Button, TextInput, WidgetApp, type ButtonVariant, type InteractiveWidget } from "@promptctl/rich-js/widgets";
import type { TerminalHost } from "@promptctl/rich-js/host";
import { KINDS, MUTED, TEXT, panel } from "./kinds.js";

/**
 * The colour depths the playground can ask its terminal for, each by the
 * environment variables colour detection reads. The first is the host's own
 * environment untouched, so a run starts at what the terminal and its user say.
 */
const DEPTHS = {
  "terminal's own colours": {},
  "16 colours": { FORCE_COLOR: "1", NO_COLOR: undefined },
  "no colour": { NO_COLOR: "1" },
  truecolor: { FORCE_COLOR: "3", NO_COLOR: undefined },
} as const satisfies Record<string, Env>;
type Depth = keyof typeof DEPTHS;
const DEPTH_ORDER = Object.keys(DEPTHS) as Depth[];

const RATES = [60, 1] as const;

/** What an app is handed once, when it is built. */
interface Preferences {
  readonly reducedMotion: boolean;
  readonly depth: Depth;
}

/** What one app hands the next: where the animation is, how often it paints, and which widget has focus. */
interface Carried {
  readonly timeline: Timeline;
  readonly rate: FrameRate;
  readonly focused: InteractiveWidget | null;
}

/** How an app's run ended: the program is done, or it goes on in a new app with these preferences. */
type Outcome = { readonly kind: "quit" } | { readonly kind: "rebuild"; readonly preferences: Preferences; readonly carried: Carried };

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
/** The cells it takes at most: a cell for every half second. */
const TRACK = 60;
/** The fewest cells it is drawn in, so a narrow terminal still has a track to press. */
const SHORTEST = 10;
/**
 * The half second of the window the marker is on, stepping every half second
 * and around the window again. The bar reads out where the time is, which is
 * not motion, so reduced it is itself: with motion reduced it still says where
 * the timeline is.
 */
const steps = beat(Array.from({ length: TRACK }, () => WINDOW / TRACK));
const marker: Animation<number> = { at: (t) => steps.at(t), nextChange: (t) => steps.nextChange(t), lastChange: (t) => steps.lastChange(t), reduced: () => marker };

/**
 * What drew a scrub track: the window it showed and the cells it took. Every
 * cell of the track is anchored to it, so a press reads the window the reader
 * was looking at off the cell it landed on, not off a time the frame was not
 * drawn for.
 */
class ScrubTrack {
  constructor(
    readonly start: number,
    readonly cells: number,
  ) {}

  /** The time under cell `col`: the middle of the stretch of the window it covers. */
  timeAt(col: number): number {
    return this.start + ((col + 0.5) * WINDOW) / this.cells;
  }
}

/** The track of the window from `start`, the marker on half second `step` of it, in as many cells as it is given. */
function track(start: number, step: number): Renderable & { measure(options: RenderOptions): { minimum: number; maximum: number } } {
  return {
    measure: () => ({ minimum: SHORTEST, maximum: TRACK }),
    render: (options: RenderOptions) => {
      const cells = Math.min(TRACK, options.maxWidth);
      const col = Math.floor((step * cells) / TRACK);
      const text = new RichText("", { end: "" });
      text.append("━".repeat(col), "#89b4fa");
      text.append("●", "bold #f9e2af");
      text.append("─".repeat(cells - col - 1), MUTED);
      return Segment.anchorLines([...Segment.splitLines(render(text, options))], new ScrubTrack(start, cells)).flatMap((line) => [...line, Segment.line()]);
    },
  };
}

/** The scrub track that drew a cell, and the cell of it, if a scrub track is in the chain of owners that drew it. */
function scrubbed(anchor: Anchor | undefined): { readonly track: ScrubTrack; readonly col: number } | undefined {
  if (anchor === undefined) return undefined;
  return anchor.owner instanceof ScrubTrack ? { track: anchor.owner, col: anchor.col } : scrubbed(anchor.inner);
}

const seconds = (t: number): string => `${t.toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 })} s`;

/**
 * `controls` over `gallery`: the controls take the rows they draw at the
 * width they are given, so a narrow terminal that wraps them pushes the
 * gallery down rather than cutting the controls off, and the gallery takes the
 * rest. The controls are drawn once, and those rows are the pane.
 */
function stacked(controls: Renderable, gallery: Renderable): Renderable {
  return {
    render: (options: RenderOptions) => {
      const rows = Segment.splitLines(render(controls, { ...options, height: undefined }));
      const drawn: Renderable = { render: () => rows.flatMap((line) => [...line, Segment.line()]) };
      const layout = new Layout();
      layout.splitColumn(new Layout(drawn, { size: rows.length }), new Layout(gallery));
      return render(layout, options);
    },
  };
}

/** The widgets and the gallery: made once, so a rebuild keeps what was typed, where the gallery was scrolled to, and which control has focus. */
function controls() {
  const button = (label: string, variant: ButtonVariant = "default"): Button => new Button({ label, variant });
  return {
    playPause: button("play / pause", "primary"),
    reverse: button("reverse", "primary"),
    speeds: ([0.25, 1, 4] as const).map((speed) => [speed, button(`${speed}×`)] as const),
    back: button("−5 s"),
    forward: button("+5 s"),
    far: button("seek 999 990 s"),
    motion: button("reduced motion", "warning"),
    depth: button("colour depth", "warning"),
    fps: button("frame rate", "warning"),
    quit: button("quit", "danger"),
    input: new TextInput({ placeholder: "type here: the caret blinks" }),
    gallery: new Viewport({ scrollbar: SCROLLBAR }),
  };
}
type Controls = ReturnType<typeof controls>;

const caret = panel("TextInput · its caret");

const row = (...cells: Renderable[]): Table => {
  const grid = Table.grid({ padding: [0, 1] });
  cells.forEach(() => grid.addColumn());
  grid.addRow(...cells);
  return grid;
};

/** One app's run, with these preferences, going on from what the last one carried; resolves with how it ended. */
async function session(host: TerminalHost, clock: Clock, c: Controls, preferences: Preferences, from: Carried): Promise<Outcome> {
  let outcome: Outcome = { kind: "quit" };

  const view = (): Renderable => {
    const timeline = app.timeline;
    const playback = `${timeline.playing ? "▶ playing" : "⏸ paused"} at ${Math.abs(timeline.rate)}×${timeline.rate < 0 ? " in reverse" : ""}`;
    const gallery = c.gallery.showing(new Columns([...KINDS.map((kind) => kind.view), caret(c.input)], { padding: [0, 1] }));
    return stacked(
      new Group(
        new RichText("animation playground — Tab moves between controls, Enter or a click presses, the wheel scrolls", { style: MUTED }),
        row(c.playPause, c.reverse, ...c.speeds.map(([, b]) => b), c.back, c.forward, c.far),
        row(c.motion, c.depth, c.fps, c.quit),
        // The time is read off the frame, mapped to what shows it: the window
        // the marker runs across, and the readout.
        Animation.map(Animation.time(), (t) => {
          const start = Math.floor(t / WINDOW) * WINDOW;
          return row(
            new RichText(seconds(start), { style: MUTED }),
            Animation.map(marker, (step) => track(start, step)),
            new RichText(seconds(start + WINDOW), { style: MUTED }),
          );
        }),
        Animation.map(Animation.time(), (t) =>
          new RichText(
            [`t = ${seconds(t)}`, playback, preferences.depth, `${app.rate.perSecond} fps`, preferences.reducedMotion ? "motion reduced" : "full motion"].join("  ·  "),
            { style: TEXT },
          ),
        ),
      ),
      gallery,
    );
  };

  const app = new WidgetApp({
    host: atDepth(host, preferences.depth),
    surface: "alternate",
    clock,
    timeline: from.timeline,
    rate: from.rate,
    reducedMotion: preferences.reducedMotion,
    view,
  });

  // Every handler is this app's, and is taken off when it ends: the widgets outlive it.
  const subscriptions = [
    // [LAW:one-source-of-truth] Every playback control is one `Timeline` operation on the app's timeline at the clock's now.
    ...(
      [
        [c.playPause, (timeline, now) => (timeline.playing ? Timeline.pause(timeline, now) : Timeline.resume(timeline, now))],
        [c.reverse, (timeline, now) => Timeline.withRate(timeline, now, -timeline.rate)],
        ...c.speeds.map(([speed, b]) => [b, (timeline: Timeline, now: number) => Timeline.withRate(timeline, now, Math.sign(timeline.rate) * speed)] as const),
        [c.back, (timeline, now) => Timeline.seek(timeline, now, Timeline.at(timeline, now) - 5)],
        [c.forward, (timeline, now) => Timeline.seek(timeline, now, Timeline.at(timeline, now) + 5)],
        [c.far, (timeline, now) => Timeline.seek(timeline, now, 999_990)],
      ] as const satisfies readonly (readonly [Button, (timeline: Timeline, now: number) => Timeline])[]
    ).map(([b, change]) =>
      b.onSubmit(() => {
        app.timeline = change(app.timeline, clock.now());
      }),
    ),
    // A preference is the next app's: this one ends, handing on what the next goes on from.
    ...(
      [
        [c.motion, (p) => ({ ...p, reducedMotion: !p.reducedMotion })],
        [c.depth, (p) => ({ ...p, depth: DEPTH_ORDER[(DEPTH_ORDER.indexOf(p.depth) + 1) % DEPTH_ORDER.length]! })],
      ] as const satisfies readonly (readonly [Button, (p: Preferences) => Preferences])[]
    ).map(([b, change]) =>
      b.onSubmit(() => {
        outcome = { kind: "rebuild", preferences: change(preferences), carried: { timeline: app.timeline, rate: app.rate, focused: app.focusManager.current } };
        app.stop();
      }),
    ),
    c.fps.onSubmit(() => {
      const next = RATES[(RATES.findIndex((rate) => rate === app.rate.perSecond) + 1) % RATES.length]!;
      app.rate = frameRate(next);
      app.refresh();
    }),
    c.quit.onSubmit(() => app.stop()),
    // A press on the track seeks to the time under it, in the window the pressed frame showed.
    app.onMouse((event) => {
      if (event.type !== "mouse_down") return;
      const hit = scrubbed(Segment.anchorAt(app.frame, event.x, event.y));
      if (hit === undefined) return;
      app.timeline = Timeline.seek(app.timeline, clock.now(), hit.track.timeAt(hit.col));
    }),
  ];

  app.focusManager.focus(from.focused ?? c.input);
  await app.run();
  for (const unsubscribe of subscriptions) unsubscribe();
  return outcome;
}

/** Run the playground on `host`, reading the time off `clock`; settles once the reader quits and the terminal is handed back. */
export async function run(host: TerminalHost, clock: Clock): Promise<void> {
  const c = controls();
  let preferences: Preferences = { reducedMotion: false, depth: DEPTH_ORDER[0]! };
  let carried: Carried = { timeline: Timeline.play(clock.now()), rate: frameRate(RATES[0]), focused: null };
  for (;;) {
    const outcome = await session(host, clock, c, preferences, carried);
    if (outcome.kind === "quit") return;
    ({ preferences, carried } = outcome);
  }
}
