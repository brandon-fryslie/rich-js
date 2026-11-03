/**
 * The animation playground: every kind of motion rich-js has, on one
 * timeline, with the controls that move it.
 *
 * THIS IS A DEMO (`examples/animation-playground/`), run by `main.ts` in the
 * docs card and in Node alike. It runs on whatever `TerminalHost` it is
 * handed and reads the time off the `Clock` it is handed, so the program
 * never touches `process` [LAW:effects-at-boundaries].
 *
 * Where to read: the kinds of motion are `kinds/`, a few to a file, each
 * file headed by the idiom it teaches; `gallery.ts` lists them. This file is
 * one app's run — the view and what each control does — and the loop that
 * builds the next app when a preference changes.
 *
 * [LAW:one-source-of-truth] Playback is the app's `timeline` and the frame
 * rate is the app's `rate`, and nothing else; the readout reads both back.
 * The two things an app is handed once — reduced motion and the color depth
 * its environment says — are `Preferences`; changing one stops the app and
 * builds the next over the same host, clock, widgets and gallery, handing on
 * the timeline, the rate and the focus.
 */
import { Animation, Columns, Group, Layout, RichText, Segment, Timeline, frameRate, render, type Clock, type FrameRate, type Renderable, type RenderOptions } from "@promptctl/rich-js";
import { WidgetApp, type Button, type InteractiveWidget } from "@promptctl/rich-js/widgets";
import type { TerminalHost } from "@promptctl/rich-js/host";
import { controls, playback, row, type Controls } from "./controls.js";
import { atDepth, hostDepth, nextDepth, type Depth } from "./depth.js";
import { KINDS } from "./gallery.js";
import { MUTED, TEXT, THEME, panel } from "./kinds/look.js";
import { WINDOW } from "./scrub.js";

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

// Made once: `toLocaleString` builds a formatter on every call, and the readout is formatted every frame.
const TENTHS = new Intl.NumberFormat("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const seconds = (t: number): string => `${TENTHS.format(t)} s`;

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

const caret = panel("TextInput · its caret");

/** One app's run, with these preferences, going on from what the last one carried; resolves with how it ended. */
async function session(host: TerminalHost, clock: Clock, c: Controls, preferences: Preferences, from: Carried): Promise<Outcome> {
  let outcome: Outcome = { kind: "quit" };

  const view = (): Renderable => {
    const timeline = app.timeline;
    const playing = `${timeline.playing ? "▶ playing" : "⏸ paused"} at ${Math.abs(timeline.rate)}×${timeline.rate < 0 ? " in reverse" : ""}`;
    const gallery = c.gallery.showing(new Columns([...KINDS.map((kind) => kind.view), caret(c.input)], { padding: [0, 1] }));
    // The time is read off the frame, mapped to what shows it: the window's two ends, and the readout.
    const end = (offset: number) => Animation.map(Animation.time(), (t) => new RichText(seconds(Math.floor(t / WINDOW) * WINDOW + offset), { style: MUTED }));
    return stacked(
      new Group(
        new RichText("animation playground — Tab moves, Enter or a click presses, the wheel scrolls, ← → seek on the scrub bar", { style: MUTED }),
        row(c.playPause, c.reverse, ...c.speeds.map(([, b]) => b), c.back, c.forward, c.far),
        row(c.motion, c.depth, c.fps, c.quit),
        row(end(0), c.scrub, end(WINDOW)),
        Animation.map(Animation.time(), (t) =>
          new RichText(
            [`t = ${seconds(t)}`, playing, preferences.depth, `${app.rate.perSecond} fps`, preferences.reducedMotion ? "motion reduced" : "full motion"].join("  ·  "),
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
    terminal: THEME,
    view,
  });

  const rebuild = (change: (p: Preferences) => Preferences) => () => {
    outcome = { kind: "rebuild", preferences: change(preferences), carried: { timeline: app.timeline, rate: app.rate, focused: app.focusManager.current } };
    app.stop();
  };

  // Every handler is this app's, and is taken off when it ends: the widgets outlive it.
  const subscriptions = [
    ...playback(c).map(([b, change]: readonly [Button, (timeline: Timeline, now: number) => Timeline]) =>
      b.onSubmit(() => {
        app.timeline = change(app.timeline, clock.now());
      }),
    ),
    c.scrub.onChange(() => {
      const now = clock.now();
      app.timeline = Timeline.seek(app.timeline, now, c.scrub.requested(Timeline.at(app.timeline, now)));
    }),
    // A preference is the next app's: this one ends, handing on what the next goes on from.
    c.motion.onSubmit(rebuild((p) => ({ ...p, reducedMotion: !p.reducedMotion }))),
    c.depth.onSubmit(rebuild((p) => ({ ...p, depth: nextDepth(p.depth) }))),
    c.fps.onSubmit(() => {
      const next = RATES[(RATES.findIndex((rate) => rate === app.rate.perSecond) + 1) % RATES.length]!;
      app.rate = frameRate(next);
      app.refresh();
    }),
    c.quit.onSubmit(() => app.stop()),
  ];

  app.focusManager.focus(from.focused ?? c.input);
  await app.run();
  for (const unsubscribe of subscriptions) unsubscribe();
  return outcome;
}

/** Run the playground on `host`, reading the time off `clock`; settles once the reader quits and the terminal is handed back. */
export async function run(host: TerminalHost, clock: Clock): Promise<void> {
  const c = controls();
  let preferences: Preferences = { reducedMotion: false, depth: hostDepth(host) };
  let carried: Carried = { timeline: Timeline.play(clock.now()), rate: frameRate(RATES[0]), focused: null };
  for (;;) {
    const outcome = await session(host, clock, c, preferences, carried);
    if (outcome.kind === "quit") return;
    ({ preferences, carried } = outcome);
  }
}
