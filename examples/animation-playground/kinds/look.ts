/**
 * The gallery's look: its theme, its colors, the width a kind is drawn in,
 * and the titled panel every kind sits in.
 *
 * THIS IS A DEMO (`examples/animation-playground/`). Every file beside this
 * one teaches one idiom of writing an animation, and imports only this and
 * the library. A kind is a name and a renderable: an animation value placed
 * in its panel beside whatever static content goes with it, exactly as a
 * program places one in any container. Nothing a kind file writes reads the
 * frame's time; the panel draws the animation at it.
 */
import { CATPPUCCIN_MOCHA, EASES, Panel, type Renderable } from "@promptctl/rich-js";

/** One kind of motion: what it is called, and the titled panel it is shown in. */
export interface Kind {
  readonly name: string;
  readonly view: Renderable;
}

export const THEME = CATPPUCCIN_MOCHA;
export const TEXT = "#cdd6f4";
export const MUTED = "#6c7086";
export const BORDER = "#585b70";
/** The cells a kind's content may take: every panel is this wide inside its border and padding. */
export const SLOT = 32;

/** How long a status is shown before the next, and the motion between the two. */
export const STAY = 3;
export const CHANGE = { seconds: 1.2, ease: EASES["ease-in-out"], swing: 1 };

/** `content` in a kind's titled panel. */
export const panel =
  (name: string) =>
  (content: Renderable): Panel =>
    new Panel(content, { title: name, titleStyle: MUTED, borderStyle: BORDER, width: SLOT + 4 });

/** A kind: `content` — an animation, or anything an animation sits inside — in its titled panel. */
export const kind = (name: string, content: Renderable): Kind => ({ name, view: panel(name)(content) });
