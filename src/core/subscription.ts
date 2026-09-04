/**
 * Unsubscribe — the shape every `on…()` in this library hands back.
 *
 * [LAW:decomposition] It lives in `core/` because two subsystems that must not
 * depend on each other both need it: `host/` returns one from `onData` and
 * `onResize`, `widgets/` returns one from `onChange`, `onSubmit`, `onKey` and
 * `onMouse`. Either home above this tier would make the other import a
 * subsystem it has no business knowing about — the extraction of `src/host/`
 * out of `src/widgets/` is what surfaced that, since the type was sitting in
 * `widgets/types.ts` and the host seam was importing it from there.
 */

export type Unsubscribe = () => void;
