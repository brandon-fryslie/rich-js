/**
 * observable — the widgets' state carrier: mobx's `observableRef` accessor
 * decorator, refusing a write during a render or measure the widget was not
 * made in.
 *
 * A render changes nothing (`src/core/state.ts`). `State` refuses a write in
 * its setter; a widget's state is a mobx observable, whose setter is mobx's, so
 * the refusal is an interceptor every instance registers on each of its
 * observables as it is made, holding the pass it was made in. `core/` cannot do
 * this itself: mobx is an optional peer, reachable only through `./widgets`.
 *
 * There is no deep `observable`. It turns an array or object into a mobx one
 * whose contents are written without the interceptor, so a refusal on the
 * accessor alone would be a refusal of half the writes. A held value is
 * replaced whole, and the render-purity gate reports one whose type can be
 * written in place.
 *
 * Every observable accessor in `src/widgets/` is declared with this, never
 * with mobx's own: `test/seam/render-purity.ts` sanctions an accessor
 * decorated from this module and reports any other as a writable property.
 */

import { observableRef as mobxObservableRef, intercept } from "mobx";
import { activePass } from "../core/protocol.js";
import { refuseRenderWrite } from "../core/state.js";

/** mobx's accessor decorator, typed as what it returns for an accessor: a `get`, a `set` and an `init`, always all three. */
const mobxRef = mobxObservableRef as <This extends object, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
) => Required<ClassAccessorDecoratorResult<This, Value>>;

/** mobx's `observableRef` (the reference, not its contents), refusing a write during a render or measure. */
export function observableRef<This extends object, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
): ClassAccessorDecoratorResult<This, Value> {
  const inner = mobxRef(target, context);
  return {
    ...inner,
    init(value) {
      const initial = inner.init.call(this, value);
      const owner = activePass();
      // [LAW:single-enforcer] The rule is `State`'s, applied by its one enforcer.
      intercept(this, context.name as keyof This, (change) => {
        refuseRenderWrite(owner);
        return change;
      });
      return initial;
    },
  };
}
