/// <reference lib="dom" />
/**
 * A program as one editable card: its code, and under it what the code does.
 * Three places show one, with one core between them (`cardCore`):
 *
 * - a docs example (`RichExample`). The build hands it the block
 *   (example-card.ts); the page renders it on the server, so a reader sees the
 *   card before any of this runs. At rest it is the page's own card:
 *   VitePress's highlighted fence, passed in as the default slot, over the
 *   block's output. A click in the code, or Enter on it, puts an editor in the
 *   fence's place, its cursor where the click was, the setup the block runs on
 *   locked and folded around it (setup-regions.ts). "Try it" opens the code
 *   the card holds in the playground.
 * - a demo's page (`RichDemo`): the demo's files (demo-card.ts) in an editor
 *   from the start, a tab for each, over the program running in a live
 *   terminal. "Open in playground" opens every file the card holds there.
 * - the playground (`RichPlayground`): the card at the page's full width,
 *   opened on the program in the URL's hash (playground-hash.ts), its setup
 *   unfolded and line numbers on. An edit is written back to the hash once
 *   typing pauses, so the address bar is a link to what the editor holds.
 *
 * A card's program is files, the entry first (`CardProgram`); one of several
 * files shows a tab for each, and the editor holds the one whose tab is
 * chosen. A fourth place shows one with its code hidden and nothing to edit:
 * the landing page's hero (RichShowcase.ts), a live card's output in the
 * card's frame, built there and not with `cardCore`.
 *
 * Once typing pauses the card shows what its program (`programFiles`) does
 * with the edit, in what stands under the code, its outlet:
 *
 * - a block the build runs shows the output the build printed for it until
 *   it is edited; an edit runs in a sandboxed worker (static-run.ts) and its
 *   output is drawn the way the build draws it (example-fragments.ts);
 * - a `live` block's output, and a demo's, is its program running in a live
 *   terminal (LiveScreen.ts), which an edit restarts on the edited program,
 *   or, for a program that accepts edits (hot-runtime.ts), re-runs in place;
 * - a playground program is run the static way, and drawn so when it ends; one
 *   that does what only a terminal shows, reading what is typed or redrawing
 *   what it drew, or is still running at the limit, moves to a live terminal.
 *   What the program does decides it, not a choice the visitor makes.
 *
 * Output shown for code other than the editor's is dimmed: while an edit
 * waits to run, and after one that could not, with what went wrong in red
 * under the code, where the reader is typing. A live program that fails as
 * it runs is said there too, by the terminal handing its report to the
 * card, never drawn over its last frame.
 *
 * A block the build does not run is the same card, read-only: its code over
 * the note its marker gives, and nothing to edit.
 *
 * [LAW:dataflow-not-control-flow] What the card shows is a function of the
 * code in it. Reset is putting the opened code back, nothing more.
 */
import {
  computed,
  defineAsyncComponent,
  defineComponent,
  h,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  shallowRef,
  useId,
  watch,
  type PropType,
  type Ref,
  type ShallowRef,
  type Slots,
  type VNode,
  type VNodeArrayChildren,
} from "vue";
import type { EditorState, Extension } from "@codemirror/state";
import type { EditorView } from "@codemirror/view";
import {
  DRAWN,
  NO_SETUP,
  PLAIN_CARD,
  PRINTS_NOTHING,
  RAN,
  RUNNING,
  blockOf,
  blockSpan,
  cardSource,
  codesOf,
  oneFile,
  programFiles,
  sameCodes,
  withCodes,
  type CardData,
  type CardOptions,
  type CardProgram,
  type Codes,
} from "../example-card.js";
import type { Drawn } from "../example-fragments.js";
import type { LiveProgram } from "./live-terminal.js";
import { decodeProgram, encodeProgram } from "../playground-hash.js";
import type { SetupStart } from "./setup-regions.js";
import type { StaticEnd, StaticRun } from "./static-run.js";

/** How long typing must pause before an edit runs. */
const RUN_AFTER_MS = 250;

/**
 * How much an edit may print. The card draws it on the page's thread, so this
 * bounds what one edit can cost the page; a docs example prints a few
 * thousand characters.
 */
const OUTPUT_LIMIT_CHARS = 1 << 18;

/** `load`, run the first time it is asked for and shared from then on; one that failed is forgotten, so the next ask tries again. */
function loader<T>(load: () => Promise<T>): () => Promise<T> {
  let loaded: Promise<T> | undefined;
  return () => (loaded ??= load().catch((error: unknown) => ((loaded = undefined), Promise.reject(error))));
}

/** What making a card's program into a script needs, loaded the first time a card runs one. */
const programs = loader(async () => {
  const [library, program] = await Promise.all([import("virtual:rich-live/library"), import("./playground-program.js")]);
  return {
    library: library.default,
    playgroundProgram: program.playgroundProgram,
    playgroundScript: program.playgroundScript,
    thrownAt: program.thrownAt,
  };
});

/**
 * What running an edit for its output needs besides. The example terminal is
 * among it: its themes would otherwise be in every page's first download.
 */
const statics = loader(async () => {
  const [made, runtime, fragments, run, terminal] = await Promise.all([
    programs(),
    import("virtual:rich-live/runtime"),
    import("../example-fragments.js"),
    import("./static-run.js"),
    import("../example-terminal.js"),
  ]);
  return {
    ...made,
    runtime: runtime.default,
    drawOutput: fragments.drawOutput,
    runStatic: run.runStatic,
    terminal: terminal.EXAMPLE_TERMINAL,
    limitMs: terminal.STATIC_RUN_LIMIT_MS,
  };
});

type ThrownAt = Awaited<ReturnType<typeof programs>>["thrownAt"];

/** A live card's terminal, loaded with the first page that has one: it brings xterm's setup and the example terminal's themes. */
const LiveScreen = defineAsyncComponent(() => import("./LiveScreen.js"));
type LiveFailure = import("./LiveScreen.js").LiveFailure;

/** A card's sliders, loaded with the first card that has them: they bring the library's curve names. */
const CardSliders = defineAsyncComponent(() => import("./CardSliders.js"));

/** The space VitePress's fence leaves above and below its code: the editor's too, and the height of the folded setup's strip, drawn in it. */
const FENCE_PADDING = "20px";

/** The editor, loaded the first time a reader's pointer or focus reaches a card, so a click has it at hand. */
const editorModules = loader(() =>
  Promise.all([import("./playground-editor.js"), import("@codemirror/view"), import("@codemirror/state"), import("./setup-regions.js")]),
);

type EditorModules = Awaited<ReturnType<typeof editorModules>>;

const message = (error: unknown): string => (error instanceof Error ? error.message : String(error));

type EditableCard = Extract<CardData, { readonly run: "build" | "browser" }>;
type ReadOnlyCard = Extract<CardData, { readonly run: "never" }>;
type LiveCard = Extract<CardData, { readonly run: "browser" }>;

/** `names` grouped by the folder each is in, "" for none, each group where its first name is, in the order the names come. */
function byFolder(names: readonly string[]): { readonly folder: string; readonly files: number[] }[] {
  const groups = new Map<string, number[]>();
  names.forEach((name, file) => {
    const folder = name.includes("/") ? name.slice(0, name.lastIndexOf("/")) : "";
    groups.set(folder, [...(groups.get(folder) ?? []), file]);
  });
  return [...groups].map(([folder, files]) => ({ folder, files }));
}

/** A failure in the card's one place for them: its sentence, and the whole report under it, folded, when there is more. */
const failureView = ({ said, report }: Failed, key: string): VNode =>
  report === null
    ? h("p", { key, class: "rich-example-failure", role: "alert" }, said)
    : h("details", { key, class: "rich-example-failure", role: "alert" }, [h("summary", said), h("pre", report)]);

/** The strip naming the output panel: its label, then what stands beside it. */
const labelStrip = (label: string, beside: readonly VNode[]): VNode =>
  h("div", { class: "rich-example-label" }, [h("span", { class: "rich-example-name" }, label), ...beside]);

/** A sentence in the output's place. */
const note = (said: string): VNode => h("p", { class: "rich-example-note" }, said);

/** A block the build does not run: its code over its note, nothing to edit. */
function readOnlyView(card: ReadOnlyCard, slots: Slots): () => VNode {
  return () =>
    h("div", { class: "rich-example rich-example-card" }, [
      slots["default"]?.(),
      h("div", { class: "rich-example-output" }, [labelStrip(card.label, []), note(card.note)]),
    ]);
}

/**
 * How showing an edit's output ended: shown, or what went wrong, said under
 * the code, with the file whose line it names, if it names one. A line of a
 * file counts its setup's lines, so the card puts them in view.
 */
type Outcome = { readonly kind: "shown" } | Failed;

/** What went wrong, said in a line, where it is, and the whole report it was said from, if there is more of it than the line. */
type Failed = { readonly kind: "failed"; readonly said: string; readonly at: string | null; readonly report: string | null };

/** A failure that is only its sentence. */
const failed = (said: string): Failed => ({ kind: "failed", said, at: null, report: null });

const SHOWN: Outcome = { kind: "shown" };

/** How a static run of an edit came out: as an outcome, or by doing what only a terminal shows, said as a failure would be. */
type StaticOutcome = Outcome | { readonly kind: "terminal"; readonly said: string };

/** The names of `program`'s files, the names a stack gives their lines. */
const namesOf = (program: CardProgram): string[] => program.files.map((file) => file.name);

/**
 * A failure said under the code: `headline`, then where it is, if it is in
 * one of the visitor's files, by its file and by its line where that is known.
 * A program of one file shows no tabs, so it needs no file's name.
 */
function failedAt(headline: string, at: { readonly file: string; readonly line: number | null } | null, names: readonly string[]): Failed {
  if (at === null) return failed(headline);
  const where = [...(names.length === 1 ? [] : [at.file]), ...(at.line === null ? [] : [`line ${at.line}`])].join(" ");
  return { kind: "failed", said: where === "" ? headline : `${headline} (${where})`, at: at.file, report: null };
}

/** A crash's report as said under the code: its first line, at the file of `names` its stack names first, with the whole report kept when it says more. */
function crashSaid(report: string, thrownAt: ThrownAt, names: readonly string[]): Failed {
  const [headline, ...rest] = report.split("\n");
  return { ...failedAt(headline!, thrownAt(report, names), names), report: rest.length === 0 ? null : report };
}

/** A program that ended itself with a code other than 0, as Node's would. */
const exitSaid = (code: number): Failed => failed(`It called process.exit(${code}).`);

/** How a static run that did not draw came out. */
function staticEnded(end: Exclude<StaticEnd, { kind: "finished" | "stopped" }>, thrownAt: ThrownAt, names: readonly string[]): StaticOutcome {
  switch (end.kind) {
    case "threw":
      return crashSaid(end.report, thrownAt, names);
    case "exited":
      return exitSaid(end.code);
    case "overflowed":
      return failed(`Stopped after ${end.limitChars} characters: it was still printing.`);
    case "timedOut":
      return { kind: "terminal", said: `Stopped after ${end.limitMs / 1000} s: it was still running.` };
    case "listening":
      return { kind: "terminal", said: "It reads what is typed at it, which only a live terminal gives it." };
    case "dropped":
      return { kind: "terminal", said: "It moves the cursor or changes the screen, which only a live terminal shows." };
    case "ranOn":
      return { kind: "terminal", said: "It runs on after its last line, a timer still set, which only a live terminal shows." };
  }
}

/** What stands under an editable card's code: the output of some code, and how an edit's output reaches it. */
interface Outlet {
  /** The code of each file what it shows is the output of; null before it shows any. */
  readonly codes: () => Codes | null;
  readonly label: () => string;
  readonly caption: () => string;
  /** How many columns what it shows is drawn in, for the font to fit the card; null when that is nothing at all. */
  readonly columns: () => number | null;
  readonly body: () => VNodeArrayChildren;
  /** What what it shows has failed with since it last started, said as a failure of an edit is; null while nothing has. */
  readonly failure: () => Failed | null;
  /** Show the output of the card's program with `codes` in its files, while `current` says no newer edit has come. */
  show(codes: Codes, current: () => boolean): Promise<Outcome>;
}

/** Output drawn under the code: the code it is the output of, what it printed, and the caption that says where it came from. */
interface Shown {
  readonly codes: Codes;
  readonly output: Drawn | null;
  readonly caption: string;
}

/** A card's code run for what it prints: the output last drawn, and how a run of other code draws its own. */
interface StaticRuns {
  readonly drawn: ShallowRef<Shown | null>;
  run(codes: Codes, current: () => boolean): Promise<StaticOutcome>;
}

/**
 * `program` with whatever code is run in its files, each run's frame in
 * `root`. Code `rest` is the output of is shown with that output, with nothing
 * run.
 */
function staticRuns(program: CardProgram, root: Ref<HTMLElement | null>, rest: Shown | null): StaticRuns {
  const drawn = shallowRef<Shown | null>(rest);
  let running: StaticRun | null = null;
  onBeforeUnmount(() => running?.stop());
  return {
    drawn,
    async run(codes, current) {
      running?.stop();
      if (rest !== null && sameCodes(codes, rest.codes)) {
        drawn.value = rest;
        return SHOWN;
      }
      const made = await statics();
      if (!current()) return SHOWN;
      running = made.runStatic(root.value!, {
        runtime: made.runtime,
        script: made.playgroundScript(programFiles(withCodes(program, codes)), made.library),
        terminal: { ...made.terminal, ...program.terminal },
        limitMs: made.limitMs,
        limitChars: OUTPUT_LIMIT_CHARS,
      });
      const { bytes, end } = await running.result;
      if (!current() || end.kind === "stopped") return SHOWN;
      // A program that exits 0 has ended as one that finished, as in Node.
      if (end.kind === "finished" || (end.kind === "exited" && end.code === 0)) {
        drawn.value = { codes, output: made.drawOutput(bytes), caption: RAN };
        return SHOWN;
      }
      return staticEnded(end, made.thrownAt, namesOf(program));
    },
  };
}

/** What `drawn` shows, under `label`. */
function drawnView(drawn: ShallowRef<Shown | null>, label: string): Omit<Outlet, "show"> {
  return {
    codes: () => drawn.value?.codes ?? null,
    label: () => label,
    caption: () => drawn.value?.caption ?? DRAWN.caption,
    columns: () => drawn.value?.output?.columns ?? null,
    // A static run's failure is its edit's outcome: nothing fails after it is drawn.
    failure: () => null,
    body: () => {
      const shown = drawn.value;
      if (shown === null) return [];
      return shown.output === null
        ? [note(PRINTS_NOTHING)]
        : [h("div", { class: "rich-example-light", innerHTML: shown.output.light }), h("div", { class: "rich-example-dark", innerHTML: shown.output.dark })];
    },
  };
}

/**
 * A block the build runs: the page's own code is shown with the output the
 * build proved for it, with nothing run; any other code is run, its frame in
 * `root`, and what only a terminal shows is a failure, as the block's marker
 * says it is static.
 */
function staticOutlet(card: Extract<CardData, { readonly run: "build" }>, root: Ref<HTMLElement | null>): Outlet {
  const runs = staticRuns(card.program, root, { codes: codesOf(card.program), output: card.output, caption: card.caption });
  return {
    ...drawnView(runs.drawn, card.label),
    async show(codes, current) {
      const outcome = await runs.run(codes, current);
      return outcome.kind === "terminal" ? failed(outcome.said) : outcome;
    },
  };
}

/**
 * `program` running in a live terminal of its size and contrast. An edit that
 * parses is a new version of it, which the terminal runs (`LiveScreen`); one
 * that does not leaves the terminal running the last that did.
 */
function liveOutlet(program: CardProgram, look: { readonly label: string; readonly caption: string }): Outlet {
  const { terminal, contrast } = program;
  const start = codesOf(program);
  // Made once and kept: each scroll into view and each Restart asks for it.
  // The opened code has parsed already: the build's, which refused it otherwise
  // (`refuseUnrunnable` in example-runner.ts), or an edit a static run ran first (`decidedOutlet`).
  const startProgram = loader(async (): Promise<LiveProgram> => {
    const made = await programs();
    const compiled = made.playgroundProgram(programFiles(program), made.library);
    if (compiled.kind === "refused") throw new Error(compiled.report);
    return compiled;
  });
  const running = shallowRef<{ readonly codes: Codes; readonly program: () => Promise<LiveProgram> }>({ codes: start, program: startProgram });
  // [LAW:one-source-of-truth] The terminal hands what goes wrong to the card,
  // which says it in its one place for failures. Each failure is a turn: a
  // crash's report is said once its stack is read, and only if no newer
  // failure, or newer run, has come meanwhile.
  const failure = shallowRef<Failed | null>(null);
  let heard = 0;
  const heardOf = (next: LiveFailure | null) => {
    const mine = ++heard;
    const say = (said: Failed | null) => void (mine === heard && (failure.value = said));
    if (next === null) return say(null);
    switch (next.kind) {
      case "unstarted":
        return say(failed(next.said));
      case "exited":
        return say(exitSaid(next.code));
      case "crashed":
        return void programs().then(
          (made) => say(crashSaid(next.report, made.thrownAt, namesOf(program))),
          (error: unknown) => say({ ...failed(next.report.split("\n")[0]!), report: `${next.report}\n\n(Its lines could not be placed: ${message(error)})` }),
        );
    }
  };
  return {
    codes: () => running.value.codes,
    label: () => look.label,
    caption: () => look.caption,
    columns: () => terminal.columns,
    failure: () => failure.value,
    body: () => [h(LiveScreen, { program: running.value.program, terminal, contrast, failed: heardOf })],
    async show(codes, current) {
      if (sameCodes(codes, start)) {
        running.value = { codes, program: startProgram };
        return SHOWN;
      }
      const made = await programs();
      const compiled = made.playgroundProgram(programFiles(withCodes(program, codes)), made.library);
      if (compiled.kind === "refused") return failedAt(`SyntaxError: ${compiled.message}`, compiled.at, namesOf(program));
      if (current()) running.value = { codes, program: () => Promise.resolve(compiled) };
      return SHOWN;
    },
  };
}

/**
 * A playground program: each version run the static way first, and drawn
 * when it ends; one that does what only a terminal shows is run in a live
 * terminal instead, until a version that ends is drawn again.
 */
function decidedOutlet(program: CardProgram, root: Ref<HTMLElement | null>): Outlet {
  const runs = staticRuns(program, root, null);
  const still = drawnView(runs.drawn, DRAWN.label);
  const live = shallowRef<Outlet | null>(null);
  const now = () => live.value ?? still;
  return {
    codes: () => now().codes(),
    label: () => now().label(),
    caption: () => now().caption(),
    columns: () => now().columns(),
    failure: () => now().failure(),
    body: () => now().body(),
    async show(codes, current) {
      const outcome = await runs.run(codes, current);
      if (!current()) return SHOWN;
      if (outcome.kind === "shown") live.value = null;
      if (outcome.kind !== "terminal") return outcome;
      if (current()) live.value = liveOutlet(withCodes(program, codes), RUNNING);
      return SHOWN;
    },
  };
}

/**
 * Where the code stands: the page's highlighted fence, with why the editor did
 * not load if a click asked for it and it failed; an editor on its way; the
 * editor; or nowhere, the card having left the page.
 */
type Code =
  | { readonly kind: "fence"; readonly refused: string | null }
  | { readonly kind: "opening" }
  | { readonly kind: "editor"; readonly view: EditorView; readonly unfoldSetup: () => void }
  | { readonly kind: "unmounted" };

/** How an editor sits in its card: where its setup starts, and what it shows around the code. */
interface Seat {
  readonly setup: SetupStart;
  readonly shown: (modules: EditorModules) => Extension[];
}

/** An editor in a docs card: the setup folded, and the fence's own measures, so the code does not move when the editor takes its place. */
const PAGE_SEAT: Seat = {
  setup: "folded",
  shown: ([, { EditorView: View }, { Prec }]) => [
    View.contentAttributes.of({ "aria-label": "Example code" }),
    // The folded setup's strip stands in the space above the code.
    Prec.highest(
      View.theme({
        "&": { backgroundColor: "var(--vp-code-block-bg)" },
        ".cm-scroller": { fontFamily: "var(--rich-code-font-family)", lineHeight: "var(--vp-code-line-height)" },
        ".cm-content": { padding: `${FENCE_PADDING} 0` },
        ".cm-line, .rich-setup-label, .rich-setup-strip": { padding: "0 24px" },
        ".rich-setup-strip": { lineHeight: FENCE_PADDING },
      }),
    ),
  ],
};

/** An editor that is a program's whole page, the playground's and a demo's: the setup in view from the start, with line numbers. */
const PROGRAM_SEAT: Seat = {
  setup: "unfolded",
  shown: ([{ PROGRAM_PANE }]) => [...PROGRAM_PANE],
};

/**
 * What every editable card does with its program: each of its files `opened`
 * in an editor, the one whose tab is chosen on screen, the edit shown by
 * `outlet` once typing pauses, a failure said under the code, and the opened code
 * put back on reset; and, where `options` turn them on, sliders over the
 * values in the chosen file's code, each an edit in the editor. `edited`
 * hears each change, with whether it is still the newest.
 */
function cardCore(opened: CardProgram, options: CardOptions, outlet: Outlet, edited: (codes: Codes, current: () => boolean) => void) {
  const code = shallowRef<Code>({ kind: "fence", refused: null });
  const openedCodes = codesOf(opened);
  const texts = shallowRef<Codes>(openedCodes);
  const failure = shallowRef<Failed | null>(null);
  /** The file whose tab is chosen. */
  const active = ref(0);
  /** The files by folder, each folder where its first file is, and the order their tabs are seen in. */
  const groups = byFolder(opened.files.map((file) => file.name));
  const order = groups.flatMap((group) => group.files);
  /** Whether the tabs fit in one row, as the unseen row says (`withFiles`); and, where they do not, whether the list is open. */
  const layout = ref<"row" | "list">("row");
  const listOpen = ref(true);
  const measure = ref<HTMLElement | null>(null);
  /** A card narrower than this starts with its list of files folded: beside the list, its code would be too narrow to read. */
  const LIST_OPEN_FROM_PX = 720;
  let measured: ResizeObserver | undefined;
  onMounted(() => {
    // A program of one file has no tabs to fit.
    if (opened.files.length === 1) return;
    const row = measure.value!;
    measured = new ResizeObserver(() => {
      const next = row.scrollWidth > row.clientWidth ? "list" : "row";
      if (next === "list" && layout.value === "row") listOpen.value = row.clientWidth >= LIST_OPEN_FROM_PX;
      layout.value = next;
    });
    measured.observe(row);
  });
  onBeforeUnmount(() => measured?.disconnect());
  /** The ids that tie each tab to the editor, the panel it shows its file in. */
  const ids = useId();
  const tabId = (file: number) => `${ids}-tab-${file}`;
  /**
   * Each file the editor has held and does not hold now, as it left it, its
   * undo history with it. The file it holds is its own state.
   */
  const away = new Map<number, EditorState>();
  /** Makes a file's state, the first time the editor is asked to hold it. */
  let stateOf: ((file: number) => EditorState) | null = null;

  // [LAW:no-ambient-temporal-coupling] Each edit is a turn, and only the
  // newest turn may show what it does: a show that ends after a newer edit is
  // no one's.
  let turn = 0;
  let pending: ReturnType<typeof setTimeout> | undefined;

  // [LAW:no-silent-failure] Whatever fails on the way, loading, compiling,
  // running or drawing, is said under the code (`failures`).
  async function show(codes: Codes, mine: number): Promise<void> {
    const current = () => mine === turn;
    try {
      const outcome = await outlet.show(codes, current);
      if (!current()) return;
      failure.value = outcome.kind === "shown" ? null : outcome;
    } catch (error) {
      if (current()) failure.value = failed(`The example could not run: ${message(error)}`);
    }
  }

  // A line a failure names counts its file's setup, so the setup is put in
  // view, whichever way the failure came: an edit's, or the running program's.
  watch([failure, () => outlet.failure()], (failures) => {
    const now = code.value;
    if (now.kind === "editor" && failures.some((said) => said?.at === opened.files[active.value]!.name)) now.unfoldSetup();
  });

  /**
   * Show what `codes` does once typing pauses, or `now` when the reader asks
   * for it; the opened code, whose output an outlet may already hold, at once.
   */
  function run(codes: Codes, when: "paused" | "now"): number {
    const mine = ++turn;
    clearTimeout(pending);
    pending = setTimeout(() => void show(codes, mine), when === "now" || sameCodes(codes, openedCodes) ? 0 : RUN_AFTER_MS);
    return mine;
  }

  /** The files' code changed to `codes`, or the reader asked to run it. */
  function changed(codes: Codes, when: "paused" | "now"): void {
    texts.value = codes;
    const mine = run(codes, when);
    edited(codes, () => mine === turn);
  }

  /** `file`'s code is now `source`, every other file's as it was. */
  const changedIn = (file: number, source: string, when: "paused" | "now") =>
    changed(texts.value.map((text, i) => (i === file ? source : text)), when);

  /** Put an editor holding the chosen file in `host`, seated as `seat` says. */
  async function openEditor(host: () => HTMLElement, seat: Seat): Promise<EditorView | null> {
    code.value = { kind: "opening" };
    const modules = await editorModules().catch((error: unknown) => {
      if (code.value.kind === "opening") code.value = { kind: "fence", refused: `The editor could not load: ${message(error)}` };
      return null;
    });
    if (modules === null) return null;
    const [{ createEditor, editorState }, { EditorView: View }, , { setupRegions, unfoldSetup }] = modules;
    // The failures stick over the bottom of the window (`failures`): the line
    // the cursor is brought into view on is kept above them, not under them.
    // The margin is how far they cover the editor, which is nothing where the
    // editor scrolls itself and they sit below it, as in the playground.
    const underFailures = View.scrollMargins.of((view) => {
      const box = failuresBox.value?.getBoundingClientRect();
      return { bottom: box === undefined ? 0 : Math.max(0, view.dom.getBoundingClientRect().bottom - box.top) };
    });
    await nextTick();
    // The card may have left the page while the editor loaded.
    if (code.value.kind !== "opening") return null;
    stateOf = (file) => {
      const { setup } = opened.files[file]!;
      const edit = (when: "paused" | "now") => (program: string) => changedIn(file, blockOf(setup, program), when);
      return editorState(cardSource(setup, texts.value[file]!), { change: edit("paused"), run: edit("now") }, [setupRegions(setup, seat.setup), underFailures, ...seat.shown(modules)]);
    };
    const view = createEditor(host(), stateOf(active.value));
    code.value = { kind: "editor", view, unfoldSetup: () => unfoldSetup(view) };
    await nextTick();
    return view;
  }

  /** Choose `file`'s tab: the editor holds it, as it was left. */
  function choose(file: number): void {
    const now = code.value;
    if (now.kind === "editor" && stateOf !== null && file !== active.value) {
      away.set(active.value, now.view.state);
      now.view.setState(away.get(file) ?? stateOf(file));
      away.delete(file);
    }
    active.value = file;
  }

  /** Put every file's opened code back, each as an edit its own undo can take back. */
  const reset = () => {
    const now = code.value;
    if (now.kind !== "editor") return;
    const restore = (state: EditorState, file: number) => {
      const { before, after } = blockSpan(opened.files[file]!.setup);
      return state.update({ changes: { from: before, to: state.doc.length - after, insert: openedCodes[file]! } });
    };
    for (const [file, state] of away) away.set(file, restore(state, file).state);
    now.view.dispatch(restore(now.view.state, active.value));
    changed(openedCodes, "paused");
  };

  onBeforeUnmount(() => {
    turn += 1;
    clearTimeout(pending);
    const now = code.value;
    if (now.kind === "editor") now.view.destroy();
    code.value = { kind: "unmounted" };
  });

  const isEdited = computed(() => !sameCodes(texts.value, openedCodes));

  /** The quiet line offering the opened code back, `● edited · reset`; or, where it always shows, that there is nothing to put back. */
  const editedLine = () =>
    h("div", { class: "rich-example-edited" }, [
      isEdited.value ? "● edited · " : "○ unedited · ",
      h("button", { type: "button", class: "rich-example-reset", disabled: !isEdited.value, onClick: reset }, "reset"),
    ]);

  /** The file each key that moves along a tab list chooses, from `file`, as the WAI-ARIA tabs pattern has them. */
  // Along the order the tabs are seen in, the row's and the list's alike, so
  // both arrow pairs move: the row is read left to right, the list top to bottom.
  const step = (file: number, by: number) => order[(order.indexOf(file) + by + order.length) % order.length]!;
  const tabKeys: Readonly<Record<string, (file: number) => number>> = {
    ArrowRight: (file) => step(file, 1),
    ArrowDown: (file) => step(file, 1),
    ArrowLeft: (file) => step(file, -1),
    ArrowUp: (file) => step(file, -1),
    Home: () => order[0]!,
    End: () => order.at(-1)!,
  };
  const moveTab = (event: KeyboardEvent) => {
    const move = tabKeys[event.key];
    if (move === undefined) return;
    event.preventDefault();
    const file = move(active.value);
    choose(file);
    document.getElementById(tabId(file))!.focus();
  };

  /** A tab choosing `file`, reading `label`, its whole name said to whoever cannot see the folder it is listed under. */
  const tab = (file: number, label: string) =>
    h(
      "button",
      {
        type: "button",
        role: "tab",
        id: tabId(file),
        class: "rich-example-tab",
        "aria-selected": String(file === active.value),
        "aria-controls": `${ids}-panel`,
        ...(label === opened.files[file]!.name ? {} : { "aria-label": opened.files[file]!.name }),
        tabindex: file === active.value ? 0 : -1,
        onClick: () => choose(file),
      },
      label,
    );

  /**
   * The editor, with a tab for each file above it, named as an import between
   * them names it; none for a program of one file, which has nothing to
   * choose between. Only the chosen tab takes focus by Tab, the arrow keys
   * move between them, and each controls the editor, the panel (`panel`).
   *
   * Tabs that would not fit in one row are a list beside the editor instead,
   * grouped by folder, which the reader can fold away to give the code the
   * width; a narrow card starts with it folded. A row of the same tabs is
   * kept, unseen, at the card's width, and says when they no longer fit,
   * whatever the width or the font.
   */
  const withFiles = (editor: VNode): VNodeArrayChildren => {
    if (opened.files.length === 1) return [editor];
    const measuring = h(
      "div",
      { class: "rich-example-tabs rich-example-tabs-measure", ref: measure, "aria-hidden": "true" },
      order.map((file) => h("span", { class: "rich-example-tab" }, opened.files[file]!.name)),
    );
    const tablist = (orientation: "horizontal" | "vertical", children: VNodeArrayChildren, shown = true) =>
      h(
        "div",
        { class: "rich-example-tabs", id: `${ids}-files`, role: "tablist", "aria-label": "Files", "aria-orientation": orientation, hidden: !shown, onKeydown: moveTab },
        children,
      );
    if (layout.value === "row") return [measuring, tablist("horizontal", order.map((file) => tab(file, opened.files[file]!.name))), editor];
    const open = listOpen.value;
    return [
      measuring,
      h("div", { class: ["rich-example-files", open ? null : "rich-example-files-folded"] }, [
        h("div", { class: "rich-example-filelist" }, [
          h(
            "button",
            { type: "button", class: "rich-example-files-toggle", "aria-expanded": String(open), "aria-controls": `${ids}-files`, onClick: () => (listOpen.value = !open) },
            open ? "◂ Files" : `▸ ${opened.files[active.value]!.name}`,
          ),
          tablist(
            "vertical",
            groups.flatMap(({ folder, files }) => [
              ...(folder === "" ? [] : [h("div", { class: "rich-example-folder", "aria-hidden": "true" }, `${folder}/`)]),
              ...files.map((file) => tab(file, opened.files[file]!.name.slice(folder === "" ? 0 : folder.length + 1))),
            ]),
            open,
          ),
        ]),
        editor,
      ]),
    ];
  };

  /** What makes the editor the tabs' panel, labelled by the chosen tab; nothing where there are no tabs. */
  const panel = () => (opened.files.length === 1 ? {} : { id: `${ids}-panel`, role: "tabpanel", "aria-labelledby": tabId(active.value) });

  /** The output panel: its label strip, with `beside` after the caption, and the output. */
  const output = (beside: readonly VNode[]) => {
    const columns = outlet.columns();
    const shown = outlet.codes();
    return h(
      "div",
      {
        class: ["rich-example-output", shown === null || !sameCodes(shown, texts.value) ? "rich-example-stale" : null],
        style: columns === null ? null : { "--rich-example-columns": columns },
      },
      [
        labelStrip(outlet.label(), [h("span", { class: "rich-example-caption" }, outlet.caption()), ...beside]),
        ...outlet.body(),
      ],
    );
  };

  /**
   * What went wrong, under the code rather than the output: the edit's, the
   * running program's, and the editor's own. It sticks to the bottom of the
   * window while the code above it is in view, so a failure is read where
   * the reader is typing, however tall the code or the output.
   */
  const failuresBox = ref<HTMLElement | null>(null);
  const failures = () => {
    const now = code.value;
    // Keyed by where each came from, so one going does not hand its element, and its folded report's state, to another.
    const said = (
      [
        ["edit", failure.value],
        ["running", outlet.failure()],
        ["editor", now.kind === "fence" && now.refused !== null ? failed(now.refused) : null],
      ] as const
    ).flatMap(([from, one]) => (one === null ? [] : [failureView(one, from)]));
    return said.length === 0 ? null : h("div", { class: "rich-example-failures", ref: failuresBox }, said);
  };

  /**
   * The sliders over the chosen file's values, once its editor is open: a
   * slider is an edit of the editor's text, and before the editor there is
   * none to make it in.
   */
  const sliders = () => {
    const now = code.value;
    if (!options.sliders || now.kind !== "editor") return null;
    const file = active.value;
    const { before } = blockSpan(opened.files[file]!.setup);
    return h(CardSliders, {
      key: file,
      source: texts.value[file]!,
      opened: openedCodes[file]!,
      write: (from: number, to: number, spelling: string) => now.view.dispatch({ changes: { from: before + from, to: before + to, insert: spelling } }),
    });
  };

  return { code, active, edited: isEdited, run, openEditor, editedLine, withFiles, panel, sliders, failures, output };
}

/**
 * Where a card's "Try it" goes: the playground, on the card's opened program
 * for its opened code, and on its program with any other code, which needs
 * nothing a run does; or why an edit has no link. `label` is what the link says.
 */
function tryItLink(program: CardProgram, tryIt: { readonly playground: string; readonly program: string }, label: string) {
  const linked = shallowRef<{ readonly hash: string } | { readonly refused: string }>({ hash: tryIt.program });
  const opened = codesOf(program);
  async function link(codes: Codes, current: () => boolean): Promise<void> {
    const next = sameCodes(codes, opened)
      ? { hash: tryIt.program }
      : await encodeProgram(withCodes(program, codes)).then(
          (hash) => ({ hash }),
          (error: unknown) => ({ refused: `"${label}" cannot carry this edit: ${message(error)}` }),
        );
    if (current()) linked.value = next;
  }
  const view = () => {
    const now = linked.value;
    return "hash" in now
      ? h("a", { class: "rich-example-try", href: `${tryIt.playground}#${now.hash}` }, label)
      : h("span", { class: "rich-example-try", "aria-disabled": "true", title: now.refused }, label);
  };
  return { link, view };
}

function editableView(card: EditableCard, slots: Slots): () => VNode {
  const root = ref<HTMLElement | null>(null);
  const host = ref<HTMLElement | null>(null);
  const outlet = card.run === "build" ? staticOutlet(card, root) : liveOutlet(card.program, card);
  const tryIt = tryItLink(card.program, card.tryIt, "Try it");
  const core = cardCore(card.program, card.options, outlet, (codes, current) => void tryIt.link(codes, current));

  /** Put the editor in the fence's place, its cursor at `at` on screen, or at the start. */
  async function edit(at: { readonly x: number; readonly y: number } | null): Promise<void> {
    if (core.code.value.kind !== "fence") return;
    const view = await core.openEditor(() => host.value!, PAGE_SEAT);
    if (view === null) return;
    // The cursor starts in the block, where the click was or nearest it: a
    // click in the space above the code is a click on its first line.
    const span = blockSpan(card.program.files[core.active.value]!.setup);
    const start = span.before;
    const end = view.state.doc.length - span.after;
    const anchor = at === null ? start : Math.min(Math.max(view.posAtCoords(at) ?? start, start), end);
    view.dispatch({ selection: { anchor } });
    view.focus();
  }

  // A failed fetch here is said by the click that needs the editor, which
  // fetches it again.
  const approached = () => void editorModules().catch(() => {});
  // A click that selected text is the reader copying, not editing; the
  // fence's own copy button is the reader copying too.
  const clicked = (event: MouseEvent) => {
    const target = event.target as Element;
    if (target.closest("div[class*='language-']") === null || target.closest("button") !== null) return;
    if (getSelection()?.isCollapsed === false) return;
    void edit({ x: event.clientX, y: event.clientY });
  };
  const pressed = (event: KeyboardEvent) => {
    if (event.key !== "Enter" || (event.target as Element).closest("div[class*='language-'] pre") === null) return;
    event.preventDefault();
    void edit(null);
  };

  // The page is the server's until this runs: a click before it reaches
  // nothing, so the card says it can be edited only from here.
  const editable = ref(false);
  onMounted(() => {
    editable.value = true;
  });

  return () => {
    const now = core.code.value;
    return h(
      "div",
      {
        class: ["rich-example rich-example-card", editable.value ? "rich-example-editable" : null],
        ref: root,
        onClick: clicked,
        onKeydown: pressed,
        onPointerenter: approached,
        onFocusin: approached,
      },
      [
        now.kind === "editor" ? null : slots["default"]?.(),
        now.kind === "fence" ? null : h("div", { class: "rich-example-editor", ref: host }),
        core.failures(),
        core.sliders(),
        core.edited.value ? core.editedLine() : null,
        core.output([tryIt.view()]),
      ],
    );
  };
}

export default defineComponent({
  name: "RichExample",
  props: {
    card: { type: Object as PropType<CardData>, required: true },
  },
  setup(props, { slots }) {
    const { card } = props;
    return card.run === "never" ? readOnlyView(card, slots) : editableView(card, slots);
  },
});

/**
 * A card open from the start, a program's whole page: its tabs, an editor on
 * the program's entry, the line offering the opened code back, and the output
 * of `outlet`, made with the card's frame, with `beside` in its label strip.
 */
function openCardView(
  program: CardProgram,
  options: CardOptions,
  outlet: (root: Ref<HTMLElement | null>) => Outlet,
  edited: (codes: Codes, current: () => boolean) => void,
  beside: () => VNode[],
) {
  const root = ref<HTMLElement | null>(null);
  const host = ref<HTMLElement | null>(null);
  const core = cardCore(program, options, outlet(root), edited);
  onMounted(() => void core.openEditor(() => host.value!, PROGRAM_SEAT));
  return {
    core,
    render: () =>
      h("div", { class: "rich-example rich-example-card", ref: root }, [
        ...core.withFiles(h("div", { class: "rich-example-editor", ref: host, ...core.panel() })),
        core.failures(),
        core.sliders(),
        core.editedLine(),
        core.output(beside()),
      ]),
  };
}

/**
 * A demo's page's card (demo-card.ts): its files in the editor from the
 * start, a tab for each, over the program running in a live terminal.
 */
export const RichDemo = defineComponent({
  name: "RichDemo",
  props: {
    card: { type: Object as PropType<LiveCard>, required: true },
  },
  setup(props) {
    const { card } = props;
    const tryIt = tryItLink(card.program, card.tryIt, "Open in playground");
    const live = () => liveOutlet(card.program, card);
    return openCardView(card.program, card.options, live, (codes, current) => void tryIt.link(codes, current), () => [tryIt.view()]).render;
  },
});

/**
 * The playground's card, on one program: an editor from the start, the
 * program run at once, and every edit handed to `edited`.
 */
const PlaygroundCard = defineComponent({
  name: "PlaygroundCard",
  props: {
    program: { type: Object as PropType<CardProgram>, required: true },
    edited: { type: Function as PropType<(program: CardProgram) => void>, required: true },
  },
  setup(props) {
    const { program } = props;
    const card = openCardView(program, PLAIN_CARD, (root) => decidedOutlet(program, root), (codes) => props.edited(withCodes(program, codes)), () => []);
    onMounted(() => card.core.run(codesOf(program), "now"));
    return card.render;
  },
});

/**
 * How long typing must pause before the link is written. Browsers refuse
 * (Safari, Firefox) or quietly drop (Chrome) a burst of history writes, and
 * one a keystroke is such a burst.
 */
const WRITE_AFTER_MS = 300;

/**
 * The playground page: the card on the program in the URL's hash, or, with
 * none, on the first block of the start page (`PLAYGROUND_MODULE` in
 * example-runner.ts), with no setup.
 */
export const RichPlayground = defineComponent({
  name: "RichPlayground",
  setup() {
    /** The program the card is open on, keyed by the event that opened it: a new one is a new card. */
    const opened = shallowRef<{ readonly key: number; readonly program: CardProgram } | null>(null);
    const failure = ref<string | null>(null);

    // [LAW:no-ambient-temporal-coupling] The card and the address bar are kept
    // agreed here and nowhere else. An edit, a link followed and the page
    // closing are each an event, and an encode or decode that finishes after a
    // later event is dropped: the newest event always wins. An edit still
    // waiting to be written when a link is followed never reaches the history
    // entry left behind.
    let latest = 0;
    let pending: ReturnType<typeof setTimeout> | undefined;
    const next = (): number => {
      clearTimeout(pending);
      return ++latest;
    };

    /** Open the program the hash holds, or the start page's for none. A link that cannot be read says so, and opens the start example rather than nothing. */
    async function follow(): Promise<void> {
      const event = next();
      const hash = location.hash.slice(1);
      const start = () => import("virtual:rich-live/playground").then(({ start }): CardProgram => oneFile(NO_SETUP, start));
      try {
        const program = await (hash === "" ? start() : decodeProgram(hash)).catch(async (error: unknown) => {
          const fallback = await start();
          if (event === latest) failure.value = `This link's program could not be read (${message(error)}), so the playground opened on its starting example.`;
          return fallback;
        });
        if (event !== latest) return;
        opened.value = { key: event, program };
      } catch (error) {
        if (event === latest) failure.value = `The playground could not start: ${message(error)}`;
      }
    }

    // A failure shown is about the address bar and the card disagreeing;
    // once a write makes them agree, it is over. The write itself can throw
    // too: a browser caps a URL's length below what a program may carry.
    const remember = (program: CardProgram) => {
      const event = next();
      pending = setTimeout(
        () =>
          void encodeProgram(program)
            .then((hash) => {
              if (event !== latest) return;
              history.replaceState(history.state, "", `#${hash}`);
              failure.value = null;
            })
            .catch((error: unknown) => {
              if (event === latest) failure.value = `The link could not be updated: ${message(error)}`;
            }),
        WRITE_AFTER_MS,
      );
    };

    // A playground link opened in this tab changes only the hash: the page
    // stays, and opens the link's program as a fresh page would.
    const followed = () => {
      failure.value = null;
      void follow();
    };
    onMounted(() => {
      addEventListener("hashchange", followed);
      void follow();
    });
    onBeforeUnmount(() => {
      next();
      removeEventListener("hashchange", followed);
    });

    return () => {
      const now = opened.value;
      return h("div", { class: "rich-playground vp-doc" }, [
        h("h1", "Playground"),
        failure.value === null ? null : h("p", { class: "rich-example-failure rich-playground-failure", role: "alert" }, failure.value),
        now === null ? null : h(PlaygroundCard, { key: now.key, program: now.program, edited: remember }),
      ]);
    };
  },
});
