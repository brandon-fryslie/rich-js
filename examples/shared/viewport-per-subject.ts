/**
 * One viewport per thing a pane shows. The same one comes back while the
 * subject holds, so its scroll position does too; a new subject gets a new
 * one, so it opens at its top rather than wherever the last subject was left.
 *
 * A frame is rebuilt on every key and a scroll position is a viewport's, so
 * this is what outlives the frame for a pane whose subject changes under it.
 */

import { RichText, Viewport } from "../../src/index.js";

const blank = (): Viewport => new Viewport(new RichText(""));

export class ViewportPerSubject {
  private held = { subject: "", viewport: blank() };

  of(subject: string): Viewport {
    if (subject !== this.held.subject) this.held = { subject, viewport: blank() };
    return this.held.viewport;
  }
}
