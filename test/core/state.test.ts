import { describe, it, expect } from "vitest";
import { ListState, State, RenderWriteError } from "../../src/core/state.js";
import { activePass, measure, render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { Table } from "../../src/renderables/table.js";

const options: RenderOptions = { maxWidth: 40 };
const drain = (renderable: Renderable): Segment[] => [...render(renderable, options)];

describe("a render that sets a State it did not make throws", () => {
  it("in the render call", () => {
    const count = new State(0);
    const writes: Renderable = {
      render() {
        count.set(1);
        return [];
      },
    };
    expect(() => drain(writes)).toThrow(RenderWriteError);
    expect(count.get()).toBe(0);
  });

  it("after a yield, when the caller iterates", () => {
    const count = new State(0);
    const writes: Renderable = {
      *render() {
        yield new Segment("a");
        count.set(1);
      },
    };
    expect(() => drain(writes)).toThrow(/during a render or measure/);
  });

  it("in a child's render, drawn through its parent", () => {
    const count = new State(0);
    const child: Renderable = {
      *render() {
        count.set(1);
      },
    };
    const parent: Renderable = {
      *render(o) {
        yield new Segment("p");
        yield* render(child, o);
      },
    };
    expect(() => drain(parent)).toThrow(RenderWriteError);
  });

  it("held, handed no column: it is drawn all the same", () => {
    const count = new State(0);
    const writes: Renderable = {
      *render() {
        count.set(1);
      },
    };
    expect(() => [...render(writes, { maxWidth: 0 })]).toThrow(RenderWriteError);
    expect(count.get()).toBe(0);
  });

  it("in a measure", () => {
    const count = new State(0);
    const measured = {
      measure() {
        count.set(1);
        return { minimum: 0, maximum: 0 };
      },
    };
    expect(() => measure(measured, options)).toThrow(RenderWriteError);
  });
});

describe("what a render builds is its own", () => {
  it("a State made in the render may be set on both sides of a yield", () => {
    const builds: Renderable = {
      *render() {
        const rows = new State(0);
        rows.set(1);
        yield new Segment(String(rows.get()));
        rows.set(2);
        yield new Segment(String(rows.get()));
      },
    };
    expect(drain(builds).map((s) => s.text)).toEqual(["1", "2"]);
  });

  it("a Table built and filled in the render draws", () => {
    const builds: Renderable = {
      *render(o) {
        const table = new Table();
        table.addColumn("n");
        table.addRow("1");
        yield* render(table, o);
      },
    };
    expect(drain(builds).length).toBeGreaterThan(0);
  });

  it("a State made by one pass is refused in the next", () => {
    let kept: State<number> | undefined;
    const keeps: Renderable = {
      render() {
        kept ??= new State(0);
        kept.set(kept.get() + 1);
        return [];
      },
    };
    drain(keeps);
    expect(() => drain(keeps)).toThrow(RenderWriteError);
  });
});

describe("between passes, state changes", () => {
  it("a set outside any render is legal, and no pass is active", () => {
    const count = new State(0);
    let during: unknown;
    drain({
      render() {
        during = activePass();
        return [];
      },
    });
    expect(during).toBeDefined();
    expect(activePass()).toBeUndefined();
    count.set(1);
    expect(count.get()).toBe(1);
  });

  it("between steps of a lazy render, the caller is not rendering", () => {
    const count = new State(0);
    const steps = render(
      {
        *render() {
          yield new Segment("a");
          yield new Segment("b");
        },
      },
      options,
    )[Symbol.iterator]();
    steps.next();
    count.set(1);
    expect(steps.next().value?.text).toBe("b");
  });

  it("a lazy render's iterator is iterable itself, as the generator it steps is", () => {
    const steps = render(
      {
        *render() {
          yield new Segment("a");
          yield new Segment("b");
          yield new Segment("c");
        },
      },
      options,
    )[Symbol.iterator]();
    steps.next();
    expect([...(steps as IterableIterator<Segment>)].map((s) => s.text)).toEqual(["b", "c"]);
  });
});

describe("a ListState", () => {
  it("refuses an append or a replacement during a render it did not make, and keeps its items", () => {
    const rows = new ListState([1]);
    const appends: Renderable = {
      render() {
        rows.push(2);
        return [];
      },
    };
    const replaces: Renderable = {
      render() {
        rows.set([]);
        return [];
      },
    };
    expect(() => drain(appends)).toThrow(RenderWriteError);
    expect(() => drain(replaces)).toThrow(RenderWriteError);
    expect(rows.get()).toEqual([1]);
  });

  it("made in a render, is filled by it", () => {
    const builds: Renderable = {
      *render() {
        const rows = new ListState<string>();
        rows.push("a");
        rows.push("b");
        yield new Segment(rows.get().join(""));
      },
    };
    expect(drain(builds).map((s) => s.text)).toEqual(["ab"]);
  });

  it("appends in place, and a replacement leaves a list already read as it was", () => {
    const rows = new ListState<number>();
    const read = rows.get();
    rows.push(1);
    rows.push(2);
    expect(read).toEqual([1, 2]);
    rows.set([3]);
    expect(read).toEqual([1, 2]);
    expect(rows.get()).toEqual([3]);
  });
});
