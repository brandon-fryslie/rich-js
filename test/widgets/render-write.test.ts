import { describe, it, expect } from "vitest";
import { RenderWriteError } from "../../src/core/state.js";
import { render, type Renderable, type RenderOptions } from "../../src/core/protocol.js";
import type { Segment } from "../../src/core/segment.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Dropdown } from "../../src/widgets/dropdown.js";

const options: RenderOptions = { maxWidth: 40 };
const drain = (renderable: Renderable): Segment[] => [...render(renderable, options)];

/** A checkbox that ticks itself while it is drawn: an `observable` written in render. */
class SelfChecking extends Checkbox {
  protected override draw(options: RenderOptions): Iterable<Segment> {
    this.checked = true;
    return super.draw(options);
  }
}

/** A dropdown that replaces its options while it is drawn: an `observableRef` written in render. */
class SelfFilling extends Dropdown {
  protected override draw(options: RenderOptions): Iterable<Segment> {
    this.options = ["late"];
    return super.draw(options);
  }
}

describe("a widget whose draw writes its own observable throws", () => {
  it("for an observable", () => {
    const box = new SelfChecking({ label: "a" });
    expect(() => drain(box)).toThrow(RenderWriteError);
    expect(box.checked).toBe(false);
  });

  it("for an observableRef", () => {
    const menu = new SelfFilling({ options: ["a"] });
    expect(() => drain(menu)).toThrow(/during a render or measure/);
    expect(menu.options).toEqual(["a"]);
  });
});

describe("a widget's observable may be written", () => {
  it("between passes", () => {
    const box = new Checkbox({ label: "a" });
    drain(box);
    box.checked = true;
    expect(box.checked).toBe(true);
  });

  it("in the pass that made the widget", () => {
    const builds: Renderable = {
      render(options) {
        const box = new Checkbox({ label: "a" });
        box.checked = true;
        return render(box, options);
      },
    };
    expect(drain(builds).map((s) => s.text).join("")).toContain("✓");
  });
});
