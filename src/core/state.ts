/**
 * state — `State<T>`, the one place a renderable keeps state that changes after
 * it is built, and the refusal of a write to it while something is drawn.
 *
 * A render changes nothing. React refuses a state update during render because
 * state changes only through a setter, and the setter knows the render phase;
 * this is that setter. `set` throws while a render or measure is in progress
 * (`activePass`, owned by `render` and `measure` in `./protocol.ts`).
 *
 * Ownership is React's line too: a state made during a pass belongs to that
 * pass, and the pass may set it. A render that builds a fresh value and fills
 * it as it draws — a `Table` it adds rows to — changes nothing anyone held
 * before it began. Only a state that existed before the pass is refused.
 *
 * `test/seam/render-purity.test.ts` is the static half: nothing else reachable
 * from a renderable, or from module scope, may be writable.
 */

import { activePass, type Pass } from "./protocol.js";

/** A `State` was set during a render or measure that did not make it. */
export class RenderWriteError extends Error {
  constructor() {
    super(
      "A State was set during a render or measure. A render changes nothing: " +
        "change state in an event handler, an update, or between frames.",
    );
    this.name = "RenderWriteError";
  }
}

export class State<T> {
  #value: T;
  readonly #owner: Pass | undefined = activePass();

  constructor(value: T) {
    this.#value = value;
  }

  get(): T {
    return this.#value;
  }

  set(value: T): void {
    const pass = activePass();
    // [LAW:no-silent-failure] Refused loudly, as React refuses a setState in render.
    if (pass !== undefined && pass !== this.#owner) throw new RenderWriteError();
    this.#value = value;
  }
}
