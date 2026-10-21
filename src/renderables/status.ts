/**
 * Status — displays a spinner animation with a status message.
 *
 * Its view is a `Spinner` whose label is the message, as Rich's is, so the
 * message is drawn the way the spinner draws its label: a string is markup
 * under the console that draws it. The `Live` hands each frame its time, and
 * the spinner is asked for its frame at it, so the frame is the clock's, not
 * the platform's. [LAW:no-ambient-temporal-coupling]
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
  private _spinner: Spinner;
  private _console: Console;

  constructor(message: string | RichText, options?: StatusOptions) {
    this._console = options?.console ?? new Console();
    this._spinner = new Spinner(options?.spinner ?? "dots", message, {
      speed: options?.speed,
      style: options?.spinnerStyle ?? "status.spinner",
    });
    this._live = new Live(this._spinner, {
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
    return this._spinner.text;
  }

  set message(value: string | RichText) {
    this._spinner.text = value;
  }

  start(): void {
    this._live.start();
  }

  stop(): void {
    this._live.stop();
  }

  update(message: string | RichText): void {
    this._spinner.text = message;
    this._live.refresh();
  }
}
