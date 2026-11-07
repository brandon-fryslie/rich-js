/**
 * A `TerminalHost` that answers what a recorded terminal answered: each query
 * a write carries is answered with its recorded reply, in the order the
 * queries were written, and DA1 always last, as a terminal answers in order.
 * A query the session has no reply for goes unanswered, as one a terminal
 * does not implement.
 */

import type { Env } from "../../src/core/env.js";
import { scriptedHost, type ScriptedHost } from "./scripted-host.js";

/** What one terminal, in one setting, answered. */
export interface ProbeSession {
  /** Where the bytes come from: a recording, or the documentation they were taken from. */
  readonly source: string;
  readonly env: Env;
  /** Each query, and the bytes the terminal sent back for it. */
  readonly answers: ReadonlyMap<string, string>;
  readonly da1: string;
}

const DA1 = "\x1b[c";

export function replayHost(session: ProbeSession): ScriptedHost {
  const host = scriptedHost();
  return {
    ...host,
    env: session.env,
    write(data) {
      host.write(data);
      const text = typeof data === "string" ? data : new TextDecoder().decode(data);
      const asked = [...session.answers].filter(([query]) => text.includes(query)).sort(([a], [b]) => text.indexOf(a) - text.indexOf(b));
      const reply = asked.map(([, answer]) => answer).join("") + (text.includes(DA1) ? session.da1 : "");
      // The terminal answers after the write returns, as a tty's reply arrives.
      if (reply !== "") queueMicrotask(() => host.type(reply));
    },
  };
}
