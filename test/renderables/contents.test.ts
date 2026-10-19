/**
 * A container's `contents` is what its `render` draws (`Composite` in
 * src/core/protocol.ts), for every renderable a consumer can import.
 *
 * `contents` is a second description of each container's traversal, read only
 * when the container is handed no column, so nothing else would notice it
 * drift. Every exported renderable (test/seam/exported-renderables.ts) must
 * have a row in `ROWS`, so a renderable added without one fails here, by name.
 *
 * A `holds` row puts a probe in every slot that takes a renderable. The probes
 * `render` reports drawing it at a generous width must be, in order, the
 * probes it reports holding it at none — and at none, no probe renders,
 * whether or not anything listens. A
 * `nothing` row is a renderable that draws only what it builds itself: handed
 * no column, it is reported held and nothing else is.
 */

import { describe, expect, it } from "vitest";
import { exportedRenderables } from "../seam/exported-renderables.js";
import { render, type Presence, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { NULL_STYLE, type Style } from "../../src/core/style.js";
import type { StyledRenderable } from "../../src/core/strip.js";
import {
  Align,
  Animation,
  Columns,
  Constrain,
  DEFAULT_TERMINAL_THEME,
  Effected,
  GlyphEffected,
  Emoji,
  FlexStrip,
  FrameSequence,
  Frames,
  Group,
  JOINERS,
  JSONRenderable,
  Layout,
  ListView,
  Markdown,
  Padding,
  Panel,
  Pretty,
  Progress,
  ProgressBar,
  RichText,
  Rule,
  Strip,
  Syntax,
  Table,
  Traceback,
  Tree,
  Viewport,
  type EffectFrame,
  type GlyphFrame,
} from "../../src/index.js";
import {
  Button,
  Checkbox,
  Dropdown,
  Slider,
  StaticItem,
  TextInput,
  Toggle,
} from "../../src/widgets/index.js";

/** One line of its own name, counting every render. */
class Probe implements StyledRenderable {
  renders = 0;
  constructor(readonly name: string) {}

  render(): Iterable<Segment> {
    this.renders += 1;
    return [new Segment(this.name), Segment.line()];
  }

  measure(): { minimum: number; maximum: number } {
    return { minimum: this.name.length, maximum: this.name.length };
  }

  edgeStyle(): Style {
    return NULL_STYLE;
  }
}

type Row =
  | { readonly holds: "probes"; readonly make: (probe: (name: string) => Probe) => Renderable }
  | { readonly holds: "nothing"; readonly make: () => Renderable; readonly why: string };

const ROWS: Record<string, Row> = {
  // src/index.ts
  RichText: { holds: "nothing", make: () => new RichText("plain"), why: "draws the text it holds" },
  Strip: { holds: "probes", make: (p) => new Strip([p("a"), p("b")], JOINERS.plain) },
  Emoji: { holds: "nothing", make: () => new Emoji("smile"), why: "draws the emoji its caller names" },
  Pretty: { holds: "nothing", make: () => new Pretty({ a: [1, "two"] }), why: "draws the text it builds from a value" },
  JSONRenderable: { holds: "nothing", make: () => JSONRenderable.fromData({ a: 1 }), why: "draws the text it builds from a value" },
  Constrain: { holds: "probes", make: (p) => new Constrain(p("a"), 20) },
  Effected: {
    holds: "probes",
    make: (p) => new Effected(p("a"), () => Animation.constant<EffectFrame>((c) => c), { t: 0, key: "probe", theme: DEFAULT_TERMINAL_THEME }),
  },
  GlyphEffected: {
    holds: "probes",
    make: (p) => new GlyphEffected(p("a"), () => Animation.constant<GlyphFrame>((cell) => cell.glyph), { t: 0, key: "probe" }),
  },
  Align: { holds: "probes", make: (p) => new Align(p("a")) },
  Padding: { holds: "probes", make: (p) => new Padding(p("a"), 1) },
  Viewport: { holds: "probes", make: (p) => new Viewport(p("a"), { rows: 2 }) },
  ListView: { holds: "probes", make: (p) => new ListView(new Viewport(new RichText(""), { rows: 2 }), [p("a"), p("b")], 1) },
  Rule: { holds: "nothing", make: () => new Rule("title"), why: "draws a line and the title text it builds" },
  Panel: { holds: "probes", make: (p) => new Panel(p("a"), { title: "title", subtitle: "subtitle" }) },
  Group: { holds: "probes", make: (p) => new Group(p("a"), p("b")) },
  ProgressBar: { holds: "nothing", make: () => new ProgressBar({ total: 10, completed: 5 }), why: "draws a bar it builds" },
  Frames: {
    holds: "nothing",
    make: () => new Frames(new FrameSequence([{ text: new RichText("a"), seconds: 1 }]), { t: 0 }),
    why: "draws the text of the frame in progress",
  },
  Table: {
    holds: "probes",
    make: (p) => {
      const table = new Table({ showFooter: true });
      table.addColumn(p("head-1"), { footer: p("foot-1") });
      table.addColumn(p("head-2"), { footer: p("foot-2") });
      table.addRow(p("cell-1-1"), p("cell-1-2"));
      table.addRow(p("cell-2-1"));
      return table;
    },
  },
  Tree: {
    holds: "probes",
    make: (p) => {
      const tree = new Tree(p("root"));
      tree.add(p("first")).add(p("nested"));
      tree.add(p("last"));
      tree.add(p("collapsed"), { expanded: false }).add(p("unseen"));
      return tree;
    },
  },
  Columns: { holds: "probes", make: (p) => new Columns([p("a"), p("b"), p("c")]) },
  FlexStrip: { holds: "probes", make: (p) => new FlexStrip([p("a"), p("b")], { joiner: JOINERS.plain }) },
  Progress: {
    holds: "probes",
    make: (p) => {
      const cells = new Map<number, Probe>();
      const progress = new Progress(
        { tableColumn: {}, render: (task) => cells.get(task.id) ?? cells.set(task.id, p(`task-${task.id}`)).get(task.id)! },
        { autoRefresh: false },
      );
      progress.addTask("one", { total: 10 });
      progress.addTask("two", { total: 10 });
      return progress;
    },
  },
  Traceback: { holds: "nothing", make: () => new Traceback(new Error("boom")), why: "draws the error's message and stack" },
  Syntax: { holds: "nothing", make: () => new Syntax("const a = 1;", "typescript"), why: "draws the code it highlights" },
  Markdown: { holds: "nothing", make: () => new Markdown("- item\n\n> quote"), why: "draws the renderables it builds from a document" },
  Layout: {
    holds: "probes",
    make: (p) => {
      const hidden = new Layout(p("hidden"));
      hidden.visible = false;
      const left = new Layout();
      left.splitColumn(new Layout(p("top")), new Layout(p("bottom")), hidden);
      const root = new Layout();
      root.splitRow(left, new Layout(p("right")));
      return root;
    },
  },

  // src/widgets/index.ts
  StaticItem: { holds: "probes", make: (p) => new StaticItem({ id: "static", render: p("a") }) },
  Button: { holds: "nothing", make: () => new Button({ label: "press" }), why: "draws its label" },
  Checkbox: { holds: "nothing", make: () => new Checkbox({ label: "check" }), why: "draws its box and label" },
  Toggle: { holds: "nothing", make: () => new Toggle({ label: "toggle" }), why: "draws its label and state" },
  TextInput: { holds: "nothing", make: () => new TextInput({ value: "typed" }), why: "draws the text typed into it" },
  Dropdown: { holds: "nothing", make: () => new Dropdown({ options: ["one", "two"] }), why: "draws its options as text" },
  Slider: { holds: "nothing", make: () => new Slider({ value: 50 }), why: "draws its track" },
};

/**
 * Containers in a configuration that changes what their `render` draws, held
 * to the same rule as their `ROWS` entry.
 */
const VARIANTS: Record<string, Extract<Row, { holds: "probes" }>> = {
  "Table without its header": {
    holds: "probes",
    make: (p) => {
      const table = new Table({ showHeader: false });
      table.addColumn(p("head-1"));
      table.addRow(p("cell-1-1"));
      return table;
    },
  },
  "Tree with its root hidden": {
    holds: "probes",
    make: (p) => {
      const tree = new Tree(p("root"), { hideRoot: true });
      tree.add(p("first"));
      return tree;
    },
  },
};

/** Every report `render` makes for `renderable` at `maxWidth`. */
function reports(renderable: Renderable, maxWidth: number): [Renderable, Presence][] {
  const heard: [Renderable, Presence][] = [];
  const options: RenderOptions = { maxWidth, onPresent: (reported, presence) => heard.push([reported, presence]) };
  [...render(renderable, options)];
  return heard;
}

/** The probes a row makes, in the order it makes them, and its container. */
function build(row: Extract<Row, { holds: "probes" }>): { container: Renderable; probes: Probe[] } {
  const probes: Probe[] = [];
  const container = row.make((name) => {
    const probe = new Probe(name);
    probes.push(probe);
    return probe;
  });
  return { container, probes };
}

const probesIn = (heard: [Renderable, Presence][]): string[] =>
  heard.flatMap(([reported]) => (reported instanceof Probe ? [reported.name] : []));

describe("contents", () => {
  it("has a row for every exported renderable, and none for a name no entry exports", () => {
    expect(Object.keys(ROWS).sort()).toEqual(exportedRenderables().map((cls) => cls.name).sort());
  });

  for (const [name, row] of [...Object.entries(ROWS), ...Object.entries(VARIANTS)]) {
    if (row.holds === "nothing") {
      it(`${name}, handed no column, is held and holds nothing (${row.why})`, () => {
        const renderable = row.make();
        expect(reports(renderable, 0)).toEqual([[renderable, "held"]]);
      });
      continue;
    }

    it(`${name}, handed no column, holds the probes it draws, in the order it draws them`, () => {
      const drawn = build(row);
      const held = build(row);
      const atWidth = probesIn(reports(drawn.container, 40));
      expect(atWidth.length).toBeGreaterThan(0);

      const atNone = reports(held.container, 0);
      expect(probesIn(atNone)).toEqual(atWidth);
      expect(atNone.every(([, presence]) => presence === "held")).toBe(true);
      expect(held.probes.map((probe) => probe.renders)).toEqual(held.probes.map(() => 0));
    });

    it(`${name}, handed no column with nothing listening, renders no probe`, () => {
      const { container, probes } = build(row);
      [...render(container, { maxWidth: 0 })];
      expect(probes.map((probe) => probe.renders)).toEqual(probes.map(() => 0));
    });
  }
});
