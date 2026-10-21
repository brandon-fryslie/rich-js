/**
 * observable — the widgets' state carrier: mobx's `observable` and
 * `observableRef` accessor decorators, each refusing a write during a render or
 * measure the widget was not made in.
 *
 * A render changes nothing (`src/core/state.ts`). `State` refuses a write in
 * its setter; a widget's state is a mobx observable, whose setter is mobx's, so
 * the refusal is an interceptor every instance registers on each of its
 * observables as it is made, holding the pass it was made in. `core/` cannot do
 * this itself: mobx is an optional peer, reachable only through `./widgets`.
 *
 * Every observable accessor in `src/widgets/` is declared with one of these,
 * never with mobx's own: `test/seam/render-purity.ts` sanctions an accessor
 * decorated from this module and reports any other as a writable property.
 */

import { observable as mobxObservable, observableRef as mobxObservableRef, intercept } from "mobx";
import { activePass } from "../core/protocol.js";
import { refuseRenderWrite } from "../core/state.js";

type AccessorDecorator = <This extends object, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
) => ClassAccessorDecoratorResult<This, Value>;

/** mobx's accessor decorators, typed as what they return: a `get`, a `set` and an `init`, always all three. */
type MobxAccessorDecorator = <This extends object, Value>(
  target: ClassAccessorDecoratorTarget<This, Value>,
  context: ClassAccessorDecoratorContext<This, Value>,
) => Required<ClassAccessorDecoratorResult<This, Value>>;

function refusingRenderWrites(observe: MobxAccessorDecorator): AccessorDecorator {
  return (target, context) => {
    const inner = observe(target, context);
    return {
      ...inner,
      init(value) {
        const initial = inner.init.call(this, value);
        const owner = activePass();
        // [LAW:single-enforcer] The rule is `State`'s, applied by its one enforcer.
        intercept(this, context.name as keyof typeof this, (change) => {
          refuseRenderWrite(owner);
          return change;
        });
        return initial;
      },
    };
  };
}

/** mobx's `observable` (deep), refusing a write during a render or measure. */
export const observable = refusingRenderWrites(mobxObservable as MobxAccessorDecorator);
/** mobx's `observableRef` (the reference, not its contents), refusing a write during a render or measure. */
export const observableRef = refusingRenderWrites(mobxObservableRef as MobxAccessorDecorator);
