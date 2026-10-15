/**
 * job — this repository's build pipeline, played back, driving a `Progress`
 * instance: its real steps, each working through the real things that step
 * works through, and each run a different length, as runs are.
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
  withBoundedWidth,
  withCellWidth,
  type Measurable,
  type Renderable,
  type RenderOptions,
} from "@promptctl/rich-js";
import { defineWidget } from "../widget.js";

interface Stage {
  readonly description: string;
  readonly items: readonly string[];
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

const STAGE_PLAN: ReadonlyArray<{ readonly description: string; readonly items: readonly string[] }> = [
  { description: "lint", items: ["tsc --noEmit", "tsc -p tsconfig.scripts.json", "tsc -p tsconfig.test.json"] },
  {
    description: "tsc",
    items: [
      "src/core/color.ts", "src/core/style.ts", "src/core/segment.ts", "src/core/text.ts", "src/core/markup.ts",
      "src/core/console.ts", "src/renderables/table.ts", "src/renderables/panel.ts", "src/renderables/layout.ts",
      "src/renderables/progress.ts", "src/host/app.ts", "src/widgets/widget-app.ts", "src/themes/transpose.ts",
    ],
  },
  {
    description: "vitest",
    items: [
      "test/core/color.test.ts", "test/core/style.test.ts", "test/core/text-wrap.test.ts", "test/core/markup.test.ts",
      "test/core/export-svg.test.ts", "test/renderables/table.test.ts", "test/renderables/layout.test.ts",
      "test/renderables/viewport.test.ts", "test/host/app-input.test.ts", "test/widgets/dropdown.test.ts",
      "test/themes/transpose.test.ts", "test/seam/browser-safe.test.ts", "test/seam/tarball.test.ts",
      "test/coverage/coverage.test.ts",
    ],
  },
  {
    description: "docs:build",
    items: ["introduction.md", "console.md", "markup.md", "tables.md", "panel.md", "layout.md", "live.md", "widgets.md", "demos/index.md"],
  },
  {
    description: "test:demos",
    items: ["example-card.spec.ts", "playground.spec.ts", "claude-sessions.spec.ts", "rich-dash.spec.ts", "rich-explore.spec.ts", "wheel.spec.ts"],
  },
];

/** Ticks a stage takes per item: each run between three and nine, so no two runs are the same length. */
const runLength = (items: number) => items * (3 + Math.floor(Math.random() * 7));

function buildProgress(): { progress: Progress; stages: Stage[] } {
  const progress = new Progress(
    new TextColumn("{task.description}"),
    new BarColumn(30),
    new TaskProgressColumn(),
    new MofNCompleteColumn(),
    new TimeElapsedColumn(),
    { autoRefresh: false },
  );
  const stages: Stage[] = STAGE_PLAN.map((s) => {
    const total = runLength(s.items.length);
    return {
      description: s.description,
      items: s.items,
      total,
      taskId: progress.addTask(s.description, { total, start: false }),
      completed: 0,
    };
  });
  if (stages[0]) progress.startTask(stages[0].taskId);
  return { progress, stages };
}

/** The item a stage is on when it has done `completed` of its work. */
const itemAt = (stage: Stage, completed: number) => stage.items[Math.min(stage.items.length - 1, Math.floor((completed / stage.total) * stage.items.length))]!;

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
  // A line when the stage reaches its next item, as a tool's log does.
  if (before === 0 || itemAt(stage, before) !== itemAt(stage, stage.completed)) {
    record(state, `${stage.description}  ${itemAt(stage, stage.completed)}`);
  }

  if (stage.completed >= stage.total) {
    record(state, `${stage.description} ok`);
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
 * It is one row, cut to the width and the ceiling it is offered; offered no
 * bound, it is as wide as its label and every sample it keeps.
 */
class RateSparkline implements Renderable, Measurable {
  constructor(private readonly samples: readonly number[]) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const { maxWidth } = withBoundedWidth(options, this);
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

  measure(options: RenderOptions): { minimum: number; maximum: number } {
    // `withCellWidth` and not `withBoundedWidth`: the bounded parse asks this very method.
    // It crops to any width, so the least it needs is nothing.
    const width = Math.min(RATE_LABEL.length + RATES_KEPT, withCellWidth(options).maxWidth);
    return { minimum: 0, maximum: width };
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
