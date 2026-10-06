/**
 * effects-playground — what the page says, so a real terminal can play what
 * a panel plays (terminal.ts) beside it.
 *
 * The page says each change once, to the dev server (vite's own socket);
 * the server keeps the latest of each and passes every change on to the
 * terminals following that effect (vite.config.effects-playground.ts). A
 * terminal that joins late is told the state first, so it plays what the
 * panel plays now, not what it opened on.
 */
import type { EffectName } from "../effects-feel/vocabulary.js";
import type { Controls } from "./controls.js";

/** Something the page did: an effect's program as it now stands, its restart or replay, or new run controls (every effect's). */
export type Said =
  | { readonly kind: "source"; readonly effect: EffectName; readonly source: string }
  | { readonly kind: "restart"; readonly effect: EffectName; readonly source: string }
  | { readonly kind: "replay"; readonly effect: EffectName }
  | { readonly kind: "controls"; readonly controls: Controls };

/** The event the page sends a `Said` to the dev server under. */
export const SAID_EVENT = "effects-playground:said";

/** Where a terminal follows effects: a stream of `Said`, as server-sent events, for each `?effect=<name>`, or every effect for none. */
export const EVENTS_PATH = "/__effects-playground/events";

/** Where a terminal reads the live library with the kit added, the script a program runs on. */
export const LIBRARY_PATH = "/__effects-playground/library";

/** Whether `said` is about one of `effects`: run controls are about every one. */
export function concerns(said: Said, effects: readonly EffectName[]): boolean {
  return said.kind === "controls" || effects.includes(said.effect);
}
