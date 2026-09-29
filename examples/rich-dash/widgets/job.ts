/**
 * job — fake build pipeline driving a `Progress` instance.
 *
 * `Progress` is reused as a pure Renderable: we never call `progress.start()`,
 * so its internal Live timer never fires. The dashboard's `App` drives
 * all painting; this widget just advances task counters in `tick`.
 *
 * [LAW:single-enforcer] The dashboard's `App` owns the screen. We use
 * Progress for its rendering, not its scheduling.
 *
 * Under the bars, a sparkline draws how far each tick advanced the build, and
 * a build log shows its newest lines in whatever rows the pane has left. The
 * pane's rows arrive as the `Height` on its render options — the Layout cell's
 * share of the screen the `App` hands down — so the tail grows and shrinks
 * with the terminal and nothing here knows how tall it is.
 */

import {
  BarColumn,
  MofNCompleteColumn,
  Progress,
  TaskProgressColumn,
  TextColumn,
  TimeElapsedColumn,
  RichText,
  Segment,
  fitHeight,
  getStyle,
  insetHeight,
  regionRows,
  stackedHeight,
  withCellWidth,
  type Renderable,
  type RenderOptions,
} from "../../../src/index.js";
import { defineWidget } from "../widget.js";

interface Stage {
  readonly description: string;
  readonly total: number;
  taskId: number;
  completed: number;
}

interface JobState {
  progress: Progress;
  stages: Stage[];
  cursor: number;
  log: string[];
  /** How far each advancing tick moved its stage, oldest first. */
  rates: number[];
}

// Past any terminal's height, so the tail always has more than it can show.
const LOG_KEPT = 200;

// The most a tick advances a stage, and the most samples the sparkline draws.
const MAX_ADVANCE = 4;
const RATES_KEPT = 48;

const STAGE_PLAN: ReadonlyArray<{ description: string; total: number }> = [
  { description: "fetch sources", total: 40 },
  { description: "compile",       total: 120 },
  { description: "link",          total: 30 },
  { description: "package",       total: 20 },
];

function buildProgress(): { progress: Progress; stages: Stage[] } {
  const progress = new Progress(
    new TextColumn("{task.description}"),
    new BarColumn(30),
    new TaskProgressColumn(),
    new MofNCompleteColumn(),
    new TimeElapsedColumn(),
    { autoRefresh: false },
  );
  const stages: Stage[] = STAGE_PLAN.map((s) => ({
    description: s.description,
    total: s.total,
    taskId: progress.addTask(s.description, { total: s.total, start: false }),
    completed: 0,
  }));
  if (stages[0]) progress.startTask(stages[0].taskId);
  return { progress, stages };
}

function init(): JobState {
  const built = buildProgress();
  return { progress: built.progress, stages: built.stages, cursor: 0, log: ["build started"], rates: [] };
}

function record(state: JobState, entry: string): void {
  state.log.push(entry);
  state.log.splice(0, state.log.length - LOG_KEPT);
}

function tick(state: JobState): JobState {
  if (state.cursor >= state.stages.length) {
    const fresh = buildProgress();
    state.progress = fresh.progress;
    state.stages = fresh.stages;
    state.cursor = 0;
    record(state, "build started");
    return state;
  }

  const stage = state.stages[state.cursor]!;
  const advance = 1 + Math.floor(Math.random() * MAX_ADVANCE);
  const before = stage.completed;
  stage.completed = Math.min(stage.completed + advance, stage.total);
  state.rates.push(stage.completed - before);
  state.rates.splice(0, state.rates.length - RATES_KEPT);
  state.progress.updateTask(stage.taskId, { completed: stage.completed });
  record(state, `${stage.description}: ${stage.completed}/${stage.total}`);

  if (stage.completed >= stage.total) {
    record(state, `${stage.description} done`);
    state.cursor += 1;
    const next = state.stages[state.cursor];
    if (next) state.progress.startTask(next.taskId);
  }
  return state;
}

/** The newest entries that fit the region it is given; with none, all of them. */
class LogTail implements Renderable {
  constructor(private readonly entries: readonly string[]) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const rows = Math.min(regionRows(options.height) ?? Infinity, this.entries.length);
    const shown = this.entries.slice(this.entries.length - rows);
    yield* new RichText(shown.join("\n"), {
      style: "dim",
      end: "",
      noWrap: true,
      overflow: "ellipsis",
    }).render(options);
  }
}

const LEVELS = "▁▂▃▄▅▆▇█";
const RATE_LABEL = "rate ";

/**
 * One cell per sample, its height the sample's share of `MAX_ADVANCE`, newest
 * at the right, and the cells no sample has reached yet drawn as empty track.
 *
 * It picks a glyph per cell, so it yields its own segments rather than a text,
 * and it draws them with the names a running progress bar draws its fill and
 * track with — `bar.complete` and `bar.back` — resolved by `getStyle` against
 * the theme of the render, so a theme that recolours those recolours this too.
 * It is one row, cut to the width and the ceiling it is offered.
 */
class RateSparkline implements Renderable {
  constructor(private readonly samples: readonly number[]) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const { maxWidth } = withCellWidth(options);
    const cells = Math.max(0, Math.min(maxWidth - RATE_LABEL.length, RATES_KEPT));
    const shown = this.samples.slice(this.samples.length - cells);
    const level = (sample: number) => LEVELS[Math.round((sample / MAX_ADVANCE) * (LEVELS.length - 1))];
    const line = Segment.adjustLineLength(
      [
        new Segment(RATE_LABEL),
        new Segment(LEVELS[0]!.repeat(cells - shown.length), getStyle(options, "bar.back")),
        new Segment(shown.map(level).join(""), getStyle(options, "bar.complete")),
      ],
      maxWidth,
      undefined,
      false,
    );
    for (const row of [line].slice(0, options.height?.rows)) yield* row;
  }
}

/**
 * The bars and the sparkline, then the log in the rows they leave. The bars
 * and the sparkline are stacked blocks, so each gets as a ceiling the budget
 * less the rows drawn above it; the log is the one child filling the rest, so
 * it gets the budget less every row above it, and this pane — having set that
 * region — shapes what comes back to it.
 */
class JobPane implements Renderable {
  constructor(
    private readonly above: readonly Renderable[],
    private readonly log: Renderable,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const above = this.above.reduce<Segment[][]>(
      (drawn, block) => [
        ...drawn,
        ...Segment.splitLines(
          block.render({ ...options, height: stackedHeight(insetHeight(options.height, drawn.length)) }),
        ),
      ],
      [],
    );
    const rest = insetHeight(options.height, above.length);
    const log = fitHeight(Segment.splitLines(this.log.render({ ...options, height: rest })), rest);
    for (const line of [...above, ...log]) {
      yield* line;
      yield Segment.line();
    }
  }
}

function render(state: JobState): Renderable {
  return new JobPane([state.progress, new RateSparkline(state.rates)], new LogTail(state.log));
}

export const jobWidget = defineWidget<JobState>({
  id: "job",
  title: " build ",
  borderStyle: "yellow",
  init,
  tick,
  render,
});
