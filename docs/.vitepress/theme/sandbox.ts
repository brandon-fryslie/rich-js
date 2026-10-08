/// <reference lib="dom" />
/**
 * Where a program runs in the page: a Web Worker, one per run, made inside a
 * hidden frame sandboxed to an opaque origin, and the messages the page and
 * the worker exchange (live-worker.ts is the worker's side).
 *
 * [LAW:effects-at-boundaries] The worker is what makes a program stoppable:
 * removing the frame ends it, so a stopped `Progress` leaves no timer behind
 * and a loop that never yields takes nothing from the page. The alternative,
 * running in the page, can start a program but never stop one: nothing outside
 * a program can cancel the timers it set, or interrupt a `while (true)`. The
 * frame is what keeps the program off the site: a worker the page made itself
 * would share the site's origin, its storage and its credentials, which a
 * program a visitor typed must not reach. A program in the frame has no origin
 * of its own to share, and nothing to reach but the one message port the page
 * gave it.
 *
 * Two things run programs here: a live terminal (live-terminal.ts), which
 * shows a program as it runs, and a static run (static-run.ts), which collects
 * what a program prints.
 */

/** The terminal a program sees: everything about it but where its bytes go. */
export interface TerminalSpec {
  readonly columns: number;
  readonly rows: number;
  readonly isTTY: boolean;
  readonly env: Readonly<Record<string, string>>;
}

/** What the page sends the worker running a program. */
export type ToWorker =
  | { readonly kind: "run"; readonly script: string; readonly terminal: TerminalSpec }
  | { readonly kind: "input"; readonly chunk: string | Uint8Array }
  /** Answered with a `mark` at once; see that message. */
  | { readonly kind: "mark" };

/** What the worker running a program sends the page. */
export type FromWorker =
  | { readonly kind: "output"; readonly chunk: string | Uint8Array }
  /** The program began reading what is typed at its terminal. */
  | { readonly kind: "listening" }
  | { readonly kind: "exit"; readonly code: number }
  /**
   * The program's body has returned and every job it queued has run.
   * `runsOn` says whether a timer it set is still set, so it runs on after
   * this; a program with listeners set runs on too, and says so by
   * `listening`.
   */
  | { readonly kind: "settled"; readonly runsOn: boolean }
  /**
   * The program failed: its body threw, or something it set running did. The
   * report is what a terminal shows for it, as Node reports an uncaught error.
   */
  | { readonly kind: "crashed"; readonly report: string }
  /**
   * The answer to a `mark`, sent between two of the program's tasks. Every
   * output message before it was written before it, and a frame the program
   * draws in one task (an inline Live erases its last frame and writes the
   * next in one refresh) is wholly before it or wholly after.
   */
  | { readonly kind: "mark" };

/** One run's frame and its worker, as the page sees them. */
export interface Sandbox {
  post(message: ToWorker): void;
  /** Remove the frame, which ends its worker and whatever the worker was running. */
  end(): void;
}

/**
 * A hidden frame in `parent`, sandboxed to an opaque origin, running `runtime`
 * (the default export of `LIVE_RUNTIME_MODULE`, example-runner.ts) as a worker
 * whose every message reaches `receive`. The page and the worker talk over one
 * message port, and messages posted before the frame has loaded wait in that
 * port.
 */
export function sandbox(parent: HTMLElement, runtime: string, receive: (message: FromWorker) => void): Sandbox {
  const frame = Object.assign(document.createElement("iframe"), { srcdoc: `<script>(${relay})()</script>` });
  // Hidden by its own style, which no stylesheet overrides: VitePress styles
  // every iframe `display: block`, which undoes the `hidden` attribute and
  // leaves an invisible frame over the terminal taking its clicks.
  frame.style.display = "none";
  // Scripts, and nothing else: no same origin, no forms, no popups, no navigating the page.
  frame.sandbox.add("allow-scripts");
  const { port1, port2 } = new MessageChannel();
  port1.onmessage = ({ data }: MessageEvent<FromWorker>) => receive(data);
  // An opaque origin cannot be named, so the target is "*"; the runtime is no secret.
  frame.addEventListener("load", () => frame.contentWindow!.postMessage(runtime, "*", [port2]), { once: true });
  parent.append(frame);
  return {
    post: (message) => port1.postMessage(message),
    end: () => {
      port1.close();
      frame.remove();
    },
  };
}

/**
 * The frame's one script, written into it as source: it may use nothing but
 * its own names and the frame's globals. It starts the worker from the text
 * of its first message and joins the worker to the port that came with it.
 */
function relay(): void {
  addEventListener(
    "message",
    ({ data, ports }: MessageEvent<string>) => {
      const port = ports[0]!;
      const crashed = (report: string) => port.postMessage({ kind: "crashed", report } satisfies FromWorker);
      // [LAW:no-silent-failure] An engine that refuses this frame a worker
      // throws here, where only the port can carry it to the page.
      try {
        const worker = new Worker(URL.createObjectURL(new Blob([data], { type: "text/javascript" })));
        port.onmessage = (event) => worker.postMessage(event.data);
        worker.onmessage = (event) => port.postMessage(event.data);
        // live-worker.ts reports every failure of a program itself. What reaches
        // here is the worker failing before it could: a script that threw reads
        // "Uncaught …", and one that never loaded fires a bare `Event`, whatever
        // lib.dom's `ErrorEvent` says.
        worker.onerror = (event: ErrorEvent | Event) => {
          event.preventDefault();
          crashed(event instanceof ErrorEvent ? event.message : "The worker that runs the program did not load.");
        };
      } catch (error) {
        crashed(`The worker that runs the program did not start: ${String(error)}`);
      }
    },
    { once: true },
  );
}
