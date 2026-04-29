/**
 * job — fake build pipeline driving a `Progress` instance.
 *
 * `Progress` is reused as a pure Renderable: we never call `progress.start()`,
 * so its internal Live timer never fires. The dashboard's outer Live drives
 * all painting; this widget just advances task counters in `tick`.
 *
 * [LAW:single-enforcer] One Live owns the screen — the runtime's. We use
 * Progress for its rendering, not its scheduling.
 */

import {
  BarColumn,
  MofNCompleteColumn,
  Progress,
  TaskProgressColumn,
  TextColumn,
  TimeElapsedColumn,
  type Renderable,
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
}

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
  return { progress: built.progress, stages: built.stages, cursor: 0 };
}

function tick(state: JobState): JobState {
  if (state.cursor >= state.stages.length) {
    const fresh = buildProgress();
    state.progress = fresh.progress;
    state.stages = fresh.stages;
    state.cursor = 0;
    return state;
  }

  const stage = state.stages[state.cursor]!;
  const advance = 1 + Math.floor(Math.random() * 4);
  stage.completed = Math.min(stage.completed + advance, stage.total);
  state.progress.updateTask(stage.taskId, { completed: stage.completed });

  if (stage.completed >= stage.total) {
    state.cursor += 1;
    const next = state.stages[state.cursor];
    if (next) state.progress.startTask(next.taskId);
  }
  return state;
}

function render(state: JobState): Renderable {
  return state.progress;
}

export const jobWidget = defineWidget<JobState>({
  id: "job",
  title: " build ",
  borderStyle: "yellow",
  init,
  tick,
  render,
});
