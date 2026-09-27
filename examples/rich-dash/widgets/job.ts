/**
 * job — fake build pipeline driving a `Progress` instance.
 *
 * `Progress` is reused as a pure Renderable: we never call `progress.start()`,
 * so its internal Live timer never fires. The dashboard's outer Live drives
 * all painting; this widget just advances task counters in `tick`.
 *
 * [LAW:single-enforcer] One Live owns the screen — the runtime's. We use
 * Progress for its rendering, not its scheduling.
 *
 * Under the bars, a build log shows its newest lines in whatever rows the pane
 * has left. The pane's rows arrive as the `Height` on its render options — the
 * Layout cell's share of the screen Live hands down — so the tail grows and
 * shrinks with the terminal and nothing here knows how tall it is.
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
  insetHeight,
  regionRows,
  stackedHeight,
  type Renderable,
  type RenderOptions,
} from "../../../src/index.js";
import { defineWidget } from "../runtime/widget.js";

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
}

// Past any terminal's height, so the tail always has more than it can show.
const LOG_KEPT = 200;

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
  return { progress: built.progress, stages: built.stages, cursor: 0, log: ["build started"] };
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
  const advance = 1 + Math.floor(Math.random() * 4);
  stage.completed = Math.min(stage.completed + advance, stage.total);
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

/**
 * The bars, then the log in the rows they leave. The bars are one of two
 * stacked blocks, so they get the budget as a ceiling; the log is the one
 * child filling the rest, so it gets the budget less the bars' rows, and this
 * pane — having set that region — shapes what comes back to it.
 */
class JobPane implements Renderable {
  constructor(
    private readonly bars: Renderable,
    private readonly log: Renderable,
  ) {}

  *render(options: RenderOptions): Iterable<Segment> {
    const bars = Segment.splitLines(
      this.bars.render({ ...options, height: stackedHeight(options.height) }),
    );
    const rest = insetHeight(options.height, bars.length);
    const log = fitHeight(Segment.splitLines(this.log.render({ ...options, height: rest })), rest);
    for (const line of [...bars, ...log]) {
      yield* line;
      yield Segment.line();
    }
  }
}

function render(state: JobState): Renderable {
  return new JobPane(state.progress, new LogTail(state.log));
}

export const jobWidget = defineWidget<JobState>({
  id: "job",
  title: " build ",
  borderStyle: "yellow",
  init,
  tick,
  render,
});
