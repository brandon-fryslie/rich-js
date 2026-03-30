/**
 * Status — displays a spinner animation with a status message.
 */

import { Segment } from "../core/segment.js";
import { Style, NULL_STYLE } from "../core/style.js";
import { Console } from "../core/console.js";
import { Spinner } from "./spinner.js";
import { Live } from "./live.js";
import type { Renderable, RenderOptions } from "../core/protocol.js";

export interface StatusOptions {
  spinner?: string;
  speed?: number;
  style?: string | Style;
  console?: Console;
}

function resolveStyle(style: string | Style | undefined): Style {
  if (style === undefined) return NULL_STYLE;
  if (typeof style === "string") return Style.parse(style);
  return style;
}

/** A renderable that shows spinner + message */
class StatusRenderable implements Renderable {
  message: string;
  private _spinner: Spinner;
  private _style: Style;

  constructor(message: string, spinner: Spinner, style: Style) {
    this.message = message;
    this._spinner = spinner;
    this._style = style;
  }

  *render(options: RenderOptions): Iterable<Segment> {
    yield* this._spinner.render(options);
    const msgStyle = this._style.isNull ? undefined : this._style;
    yield new Segment(` ${this.message}`, msgStyle);
  }
}

export class Status {
  private _live: Live;
  private _renderable: StatusRenderable;
  private _console: Console;

  constructor(message: string, options?: StatusOptions) {
    this._console = options?.console ?? new Console({ forceTerminal: true });
    const spinner = new Spinner(options?.spinner ?? "dots", undefined, { speed: options?.speed });
    const style = resolveStyle(options?.style);
    this._renderable = new StatusRenderable(message, spinner, style);
    this._live = new Live(this._renderable, {
      console: this._console,
      transient: true,
      refreshPerSecond: 12.5,
    });
  }

  get console(): Console {
    return this._console;
  }

  get message(): string {
    return this._renderable.message;
  }

  set message(value: string) {
    this._renderable.message = value;
  }

  start(): void {
    this._live.start();
  }

  stop(): void {
    this._live.stop();
  }

  update(message: string): void {
    this._renderable.message = message;
    this._live.update(this._renderable, { refresh: true });
  }
}
