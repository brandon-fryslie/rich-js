/**
 * Status — displays a spinner animation with a status message.
 *
 * Its view is a `Spinner` whose label is the message, as Rich's is, so the
 * message is drawn the way the spinner draws its label: a string is markup
 * under the console that draws it. The `Live` hands each frame its time, and
 * the spinner is built for it, so the frame is the clock's, not the
 * platform's. [LAW:no-ambient-temporal-coupling]
 */

import type { Clock } from "../core/clock.js";
import type { Style } from "../core/style.js";
import type { RichText } from "../core/text.js";
import { Console } from "../core/console.js";
import { Spinner } from "./spinner.js";
import { Live } from "./live.js";

export interface StatusOptions {
  spinner?: string;
  speed?: number;
  /** The spinner's frame style; the message styles itself with its markup. */
  spinnerStyle?: string | Style;
  console?: Console;
  /** What the frames are timed and drawn on. The platform's, unless given. */
  clock?: Clock;
}

export class Status {
  private _live: Live;
  private _message: string | RichText;
  private _console: Console;

  constructor(message: string | RichText, options?: StatusOptions) {
    this._console = options?.console ?? new Console();
    this._message = message;
    const spinner = options?.spinner ?? "dots";
    const speed = options?.speed;
    const style = options?.spinnerStyle ?? "status.spinner";
    this._live = new Live((t) => new Spinner(spinner, this._message, { t, speed, style }), {
      console: this._console,
      clock: options?.clock,
      transient: true,
      refreshPerSecond: 12.5,
    });
  }

  get console(): Console {
    return this._console;
  }

  get message(): string | RichText {
    return this._message;
  }

  set message(value: string | RichText) {
    this._message = value;
  }

  start(): void {
    this._live.start();
  }

  stop(): void {
    this._live.stop();
  }

  update(message: string | RichText): void {
    this._message = message;
    this._live.refresh();
  }
}
