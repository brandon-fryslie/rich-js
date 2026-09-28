/**
 * The `node:readline` stand-in a live example's `nodeAsk` reads through: a
 * line typed at the terminal, with the keys a reader actually presses.
 * `nodeAsk` over the simulated process end to end is
 * test/docs/simulated-process.test.ts.
 */
import { describe, expect, it } from "vitest";
import { createInterface } from "../../docs/.vitepress/node-readline.js";

type Listener = (chunk: string | Uint8Array) => void;

function keyboard() {
  const listeners = new Set<Listener>();
  const echoed: string[] = [];
  return {
    input: { on: (_: "data", l: Listener) => listeners.add(l), off: (_: "data", l: Listener) => listeners.delete(l) },
    output: { write: (text: string) => echoed.push(text) },
    type: (chunk: string | Uint8Array) => [...listeners].forEach((l) => l(chunk)),
    echoed,
  };
}

/** Ask one question on a fresh interface, as `nodeAsk` does for each prompt. */
function ask(keys: ReturnType<typeof keyboard>, query = "? "): Promise<string> {
  return new Promise((resolve) => {
    const rl = createInterface(keys);
    rl.question(query, (line) => {
      rl.close();
      resolve(line);
    });
  });
}

describe("node-readline stand-in", () => {
  it("answers with the typed line, echoing keys and taking back a backspaced one", async () => {
    const keys = keyboard();
    const answer = ask(keys, "Name? ");
    keys.type("Adx");
    keys.type("\x7f");
    keys.type("a\r");
    expect(await answer).toBe("Ada");
    expect(keys.echoed.join("")).toBe("Name? Adx\b \ba\r\n");
  });

  it("reads an arrow or Home key whole and puts none of it in the line", async () => {
    const keys = keyboard();
    const answer = ask(keys);
    keys.type("ab\x1b[D\x1b[H\x1b[3~c\r");
    expect(await answer).toBe("abc");
  });

  it("skips a lone Esc and keeps the key after it, Enter included", async () => {
    const keys = keyboard();
    const answer = ask(keys);
    keys.type("Ad\x1b");
    keys.type("a");
    keys.type("\x1b");
    keys.type("\r");
    expect(await answer).toBe("Ada");
  });

  it("keeps the keys after an Enter for the next question, asked on a new interface", async () => {
    const keys = keyboard();
    const first = ask(keys);
    keys.type("dev\rWARN\r");
    expect(await first).toBe("dev");
    expect(await ask(keys)).toBe("WARN");
  });

  it("reads \\r\\n split across two chunks as one Enter", async () => {
    const keys = keyboard();
    const first = ask(keys);
    keys.type("yes\r");
    expect(await first).toBe("yes");
    const second = ask(keys);
    keys.type("\nno\r");
    expect(await second).toBe("no");
  });

  it("decodes a character whose UTF-8 bytes arrive in two chunks", async () => {
    const keys = keyboard();
    const answer = ask(keys);
    const bytes = new TextEncoder().encode("é\r");
    keys.type(bytes.slice(0, 1));
    keys.type(bytes.slice(1));
    expect(await answer).toBe("é");
  });
});
