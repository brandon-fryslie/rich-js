/**
 * showcase — the program the docs site's landing page runs in its hero
 * terminal (docs/.vitepress/theme/RichShowcase.ts). It needs no input and
 * never ends: a full-screen dashboard of the library's renderables, most of
 * them moving, drawn the way any program would draw them.
 *
 * Every moving pane is a function of the seconds since the program started,
 * and the loop only asks for the frame at that moment, so the dashboard is
 * already full in its first frame, the one a reader who asked for reduced
 * motion is shown (theme/live-terminal.ts).
 *
 * It imports the library only through its entry points: the docs site runs it
 * on the library every live example shares, and a deep import would bundle a
 * second copy of the code it names.
 */

import {
  BarColumn,
  ColorRgba,
  ColorSpec,
  DEFAULT_TERMINAL_THEME,
  EASES,
  EFFECT_CATALOGUE,
  Effected,
  FrameSequence,
  Layout,
  Live,
  Panel,
  Progress,
  RichText,
  Segment,
  SpinnerColumn,
  Style,
  Table,
  TaskProgressColumn,
  TextColumn,
  Tree,
  beat,
  onBeat,
  regionRows,
  steppedInk,
  withCellWidth,
  type Effect,
  type Renderable,
  type RenderOptions,
} from "../../src/index.js";

/** A service on the dashboard, and how its figures swing. */
interface Service {
  readonly name: string;
  /** Mean latency, ms. */
  readonly latency: number;
  /** Mean requests per second. */
  readonly load: number;
  /** Where in its swing it starts, so the rows do not move in step. */
  readonly phase: number;
}

const SERVICES: readonly Service[] = [
  { name: "api-gateway", latency: 12, load: 1840, phase: 0 },
  { name: "auth", latency: 31, load: 612, phase: 1.3 },
  { name: "search", latency: 88, load: 947, phase: 2.1 },
  { name: "billing", latency: 45, load: 203, phase: 3.7 },
  { name: "render-farm", latency: 140, load: 77, phase: 4.4 },
  { name: "notifications", latency: 22, load: 1290, phase: 5.2 },
  { name: "storage", latency: 9, load: 3310, phase: 0.8 },
  { name: "metrics", latency: 17, load: 2650, phase: 2.9 },
];

/** A swing between -1 and 1, the sum of two waves so it never looks periodic. */
const swing = (t: number, phase: number): number => (Math.sin(t * 1.7 + phase) + Math.sin(t * 0.61 + phase * 2.3)) / 2;

/** How far above its mean a service's latency swings before it reads as slow. */
const SLOW = 0.55;

function services(t: number): Table {
  const table = new Table({
    title: "Services",
    caption: "p50 latency and load, live",
    expand: true,
    borderStyle: "bright_black",
    headerStyle: "bold",
  });
  table.addColumn("Service", { style: "cyan", noWrap: true });
  table.addColumn("p50", { justify: "right" });
  table.addColumn("req/s", { justify: "right" });
  table.addColumn("Status", { noWrap: true });
  for (const service of SERVICES) {
    const s = swing(t, service.phase);
    const slow = s > SLOW;
    const latency = Math.round(service.latency * (1 + 0.6 * s));
    const load = Math.round(service.load * (1 - 0.3 * s));
    table.addRow(
      service.name,
      slow ? `[yellow]${latency} ms[/]` : `${latency} ms`,
      load.toLocaleString("en-US"),
      slow ? "[yellow]● slow[/]" : "[green]● up[/]",
    );
  }
  return table;
}

/**
 * Truecolor: each cell is two pixels, an upper half block in one colour over
 * a background of the next, and the hues drift with time.
 */
class Spectrum implements Renderable {
  constructor(private readonly t: number) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const width = withCellWidth(options).maxWidth;
    const rows = regionRows(options.height) ?? 5;
    const colour = (x: number, y: number): ColorSpec =>
      hsl((x / width) * 360 + this.t * 40, 0.85, 0.72 - (y / (rows * 2)) * 0.5);
    for (let row = 0; row < rows; row++) {
      for (let x = 0; x < width; x++) {
        yield new Segment("▀", Style.fromColor(colour(x, row * 2), colour(x, row * 2 + 1)));
      }
      yield Segment.line();
    }
  }
}

/** A truecolor colour, from a hue in degrees and a saturation and lightness in 0–1. */
function hsl(hue: number, saturation: number, lightness: number): ColorSpec {
  const a = saturation * Math.min(lightness, 1 - lightness);
  const channel = (n: number): number => {
    const k = (n + hue / 30) % 12;
    return Math.round((lightness - a * Math.max(-1, Math.min(k - 3, 9 - k, 1))) * 255);
  };
  return ColorSpec.fromRgb(channel(0), channel(8), channel(4));
}

/** Jobs that fill at their own pace and start over when full. */
const JOBS = [
  { description: "Rendering frames", seconds: 5.5, offset: 0.35 },
  { description: "Downloading assets", seconds: 8, offset: 0.6 },
  { description: "Compiling shaders", seconds: 3.2, offset: 0.1 },
  { description: "Indexing docs", seconds: 11, offset: 0.8 },
  { description: "Uploading build", seconds: 6.5, offset: 0.45 },
] as const;

const STEPS = 1000;

// The one display every frame is drawn on, made first: the jobs' Progress is
// drawn in its frames, and so is timed on them.
const live = new Live(undefined, { altScreen: true, autoRefresh: false });

const jobs = new Progress(
  new SpinnerColumn("dots"),
  new TextColumn("[progress.description]{task.description}"),
  new BarColumn(32),
  new TaskProgressColumn(),
  { expand: true, drawnBy: live },
);
const tasks = JOBS.map((job) => jobs.addTask(job.description, { total: STEPS }));

const project = new Tree("[bold]rich-js", { guide_style: "bright_black" });
project.add("[magenta]core").add("console.ts");
project.add("[magenta]renderables").add("table.ts");

/**
 * The chevrons after the name: one, two, three, one again, a second each,
 * all drawn at one width, so the tagline never moves, and their ink stepping
 * through three bright colours on the same beat, each kept readable on the
 * bubble behind it. Frames and steps are seconds, so the gauge turns at the
 * same pace however often the dashboard redraws. The name itself walks the
 * hue wheel a step a second: a wheel that would take six seconds to turn,
 * sampled once a second.
 */
const CHEVRONS = new FrameSequence(
  ["›", "››", "›››"].map((glyphs) => ({
    text: new RichText(glyphs, { style: Style.parse("bold #cdd6f4 on #313244") }),
    seconds: 1,
  })),
);
const SIGNAL = steppedInk([
  { color: new ColorRgba(255, 85, 85), seconds: 1 },
  { color: new ColorRgba(241, 250, 140), seconds: 1 },
  { color: new ColorRgba(80, 250, 123), seconds: 1 },
]);
const WALK = onBeat(EFFECT_CATALOGUE.loops.wheel({ z: 0 }, { seconds: 6, ease: EASES.linear, swing: 0 }), beat([1]));
// A cursor blinking after the tagline, in a cell of its own.
const CURSOR = new FrameSequence([
  { text: new RichText("▌", { style: Style.parse("dim") }), seconds: 0.5 },
  { text: new RichText(" "), seconds: 0.5 },
]);
const THEME = DEFAULT_TERMINAL_THEME;

/**
 * A flash over an effect: for the first 0.3 s of every 10 s the ground
 * lights up white and fades back over whatever `effect` draws, and the rest
 * of the time `effect` draws alone. A composer of the dashboard's own, so it
 * says itself when its frame next changes — every frame while lit, and while
 * dark the sooner of the next flash and whatever `effect` answers for the
 * frame it is drawing — and a host drawing it wakes for the flash and for
 * the inner effect's steps, and rests between.
 */
const FLASH_BEAT = beat([0.3, 9.7]);
function flashing(effect: Effect): Effect {
  return (drawn) => {
    const inner = effect(drawn);
    return {
      at(t) {
        const under = inner.at(t);
        // Dark, the frame is the inner effect's own.
        if (FLASH_BEAT.at(t) !== 0) return under;
        const left = 1 - (t - FLASH_BEAT.lastChange(t)) / FLASH_BEAT.holds[0]!;
        const toward = (channel: number): number => Math.round(channel + (255 - channel) * left);
        return (look, cell) => {
          const moved = under(look, cell);
          return { ...moved, bg: new ColorRgba(toward(moved.bg.red), toward(moved.bg.green), toward(moved.bg.blue)) };
        };
      },
      nextChange: (t) => (FLASH_BEAT.at(t) === 0 ? t : Math.min(FLASH_BEAT.nextChange(t), inner.nextChange(t))),
      lastChange: (t) => (FLASH_BEAT.at(t) === 0 ? t : Math.max(FLASH_BEAT.lastChange(t), inner.lastChange(t))),
      // Reduced there is no flash: a flash is news, and a reader who asked for no motion gets the effect alone, reduced.
      reduced: () => inner.reduced(),
    };
  };
}
const BRAND = flashing(WALK);

// Every animation in the heading is placed, so it draws at the time of the frame the Live draws.
const heading = Table.grid({ padding: 0 });
heading.addColumn();
heading.addColumn();
heading.addColumn();
heading.addColumn();
heading.addRow(
  new Effected(new RichText("rich-js ", { style: Style.parse("bold #1e1e2e on #cba6f7"), end: "" }), BRAND, { key: "brand", theme: THEME }),
  new Effected(CHEVRONS, SIGNAL, { key: "effort", theme: THEME }),
  new RichText(" · beautiful terminal output for TypeScript ", { style: Style.parse("dim"), end: "" }),
  CURSOR,
);

const root = new Layout(undefined, { name: "root" });
root.splitColumn(
  new Layout(undefined, { name: "heading", size: 3 }),
  new Layout(undefined, { name: "middle" }),
  new Layout(new Panel(jobs, { title: "Progress", borderStyle: "bright_black", expand: true }), { name: "jobs", size: 7 }),
);
const right = new Layout(undefined, { name: "right", ratio: 2 });
root.getByName("middle")!.splitRow(new Layout(undefined, { name: "services", ratio: 3 }), right);
right.splitColumn(
  new Layout(undefined, { name: "spectrum" }),
  new Layout(new Panel(project, { title: "Tree", borderStyle: "bright_black", expand: true }), { name: "tree", size: 7 }),
);

/** The dashboard as it stands `t` seconds in. */
function dashboardAt(t: number): Layout {
  root.getByName("heading")!.update(new Panel(heading, { expand: true, borderStyle: "magenta" }));
  root.getByName("services")!.update(services(t));
  root.getByName("spectrum")!.update(new Panel(new Spectrum(t), { title: "Truecolor", borderStyle: "bright_black", expand: true, padding: 0 }));
  JOBS.forEach((job, i) => jobs.updateTask(tasks[i]!, { completed: Math.round(((t / job.seconds + job.offset) % 1) * STEPS) }));
  return root;
}

// One clock draws every frame, the first before the program's body returns:
// a still frame can be taken as soon as the body has run, and it has to show
// the dashboard, not the empty screen Live starts on.
const FRAMES_PER_SECOND = 12;
const draw = (): void => live.update(dashboardAt(live.frameTime), { refresh: true });
live.start();
draw();
setInterval(draw, 1000 / FRAMES_PER_SECOND);
