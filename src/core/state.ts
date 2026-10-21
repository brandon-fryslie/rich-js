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
 * `ListState` is the same for a list a renderable appends to — a table's rows,
 * a text's spans — which a `State<readonly T[]>` would copy on every append.
 *
 * `refuseRenderWrite` is that refusal, written once: a widget's observables
 * refuse a write through it too (`src/widgets/observable.ts`).
 *
 * `test/seam/render-purity.test.ts` is the static half: nothing else reachable
 * from a renderable, or from module scope, may be writable.
 */

import { activePass, type Pass } from "./protocol.js";

/** State was written during a render or measure that did not make it. */
export class RenderWriteError extends Error {
  constructor() {
    super(
      "State was written during a render or measure. A render changes nothing: " +
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
    refuseRenderWrite(this.#owner);
    this.#value = value;
  }
}

/**
 * A list kept as `State` keeps a value, appended to in place: a `State` of a
 * readonly array copies it on every append, which makes filling a 10,000-row
 * table quadratic. `get` hands out the list itself, typed readonly, so a
 * reader that keeps it sees later appends; `set` replaces it, leaving a kept
 * one as it was.
 */
export class ListState<T> {
  #items: T[];
  readonly #owner: Pass | undefined = activePass();

  constructor(items: Iterable<T> = []) {
    this.#items = [...items];
  }

  get(): readonly T[] {
    return this.#items;
  }

  // One item, not a rest parameter: a caller spreading a long list into one overflows the call stack.
  push(item: T): void {
    refuseRenderWrite(this.#owner);
    this.#items.push(item);
  }

  set(items: Iterable<T>): void {
    refuseRenderWrite(this.#owner);
    this.#items = [...items];
  }
}

/**
 * Throws unless state made in `owner` — the pass in progress when it was made,
 * if any — may be written now: between passes, or in the pass that made it.
 */
export function refuseRenderWrite(owner: Pass | undefined): void {
  const pass = activePass();
  // [LAW:no-silent-failure] Refused loudly, as React refuses a setState in render.
  if (pass !== undefined && pass !== owner) throw new RenderWriteError();
}
