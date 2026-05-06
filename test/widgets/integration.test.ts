/**
 * End-to-end integration test for the interactive widget pipeline.
 *
 * Drives DefaultScreen + EventRouter with a fake stdin (PassThrough) and
 * a captured stdout (Writable subclass), feeds raw byte sequences, and
 * asserts both widget state transitions and the ANSI output that Screen
 * produced. This is the machine-verifiable acceptance criterion for the
 * widget framework: green here means the whole stack agrees end to end.
 *
 * [LAW:verifiable-goals] exit-zero from `npm run test` proves the
 * pipeline works.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PassThrough, Writable } from "stream";
import { DefaultScreen } from "../../src/widgets/screen.js";
import { DefaultFocusManager } from "../../src/widgets/focus-manager.js";
import { EventRouter } from "../../src/widgets/event-router.js";
import { Button } from "../../src/widgets/button.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Toggle } from "../../src/widgets/toggle.js";
import { TextInput } from "../../src/widgets/text-input.js";

class CapturingStream extends Writable {
  chunks: string[] = [];
  isTTY = false;
  columns = 80;
  rows = 24;

  override _write(
    chunk: Buffer | string,
    _encoding: BufferEncoding,
    cb: (err?: Error | null) => void,
  ): void {
    this.chunks.push(typeof chunk === "string" ? chunk : chunk.toString("utf8"));
    cb();
  }

  joined(): string {
    return this.chunks.join("");
  }

  reset(): void {
    this.chunks = [];
  }
}

interface Harness {
  screen: DefaultScreen;
  router: EventRouter;
  stdout: CapturingStream;
  stdin: PassThrough;
  button: Button;
  checkbox: Checkbox;
  toggle: Toggle;
  input: TextInput;
}

function makeHarness(): Harness {
  const stdout = new CapturingStream();
  const stdin = new PassThrough();
  const fm = new DefaultFocusManager();

  const screen = new DefaultScreen({
    out: stdout,
    width: 80,
    colorSystem: null,
    manageCursor: false,
    focusManager: fm,
  });

  const router = new EventRouter({
    screen,
    input: stdin as unknown as NodeJS.ReadableStream & { setRawMode?: (raw: boolean) => unknown; isTTY?: boolean },
    output: stdout,
    manageMouse: false,
    manageRawMode: false,
  });

  const button = new Button({ label: "Save", id: "btn" });
  const checkbox = new Checkbox({ label: "Agree", id: "cb" });
  const toggle = new Toggle({ label: "Sound", id: "tg" });
  const input = new TextInput({ placeholder: "name", id: "in" });

  screen.mount(button, checkbox, toggle, input);

  return { screen, router, stdout, stdin, button, checkbox, toggle, input };
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("widget pipeline integration", () => {
  let h: Harness;

  beforeEach(() => {
    h = makeHarness();
    h.screen.start();
    h.router.start();
  });

  afterEach(() => {
    h.router.stop();
    h.screen.stop();
  });

  describe("focus navigation via tab", () => {
    it("first mounted widget auto-focuses", async () => {
      await flush();
      expect(h.screen.focusManager.current).toBe(h.button);
      expect(h.button.focused).toBe(true);
    });

    it("tab byte (0x09) advances focus to the next widget", async () => {
      await flush();
      h.router.feed(Buffer.from([0x09]));
      expect(h.screen.focusManager.current).toBe(h.checkbox);
      expect(h.button.focused).toBe(false);
      expect(h.checkbox.focused).toBe(true);
    });

    it("tab cycles through all four widgets and wraps", async () => {
      await flush();
      const order = [h.checkbox, h.toggle, h.input, h.button];
      for (const expected of order) {
        h.router.feed(Buffer.from([0x09]));
        expect(h.screen.focusManager.current).toBe(expected);
      }
    });

    it("shift+tab (ESC[Z) moves focus backward", async () => {
      await flush();
      // Wrap forward to checkbox first, then shift+tab back to button.
      h.router.feed(Buffer.from([0x09]));
      expect(h.screen.focusManager.current).toBe(h.checkbox);
      h.router.feed(Buffer.from([0x1b, 0x5b, 0x5a])); // ESC[Z
      expect(h.screen.focusManager.current).toBe(h.button);
    });
  });

  describe("widget interaction via keyboard", () => {
    it("space on Checkbox toggles checked", async () => {
      await flush();
      // Tab past Button to Checkbox.
      h.router.feed(Buffer.from([0x09]));
      expect(h.screen.focusManager.current).toBe(h.checkbox);
      h.router.feed(Buffer.from([0x20])); // space
      expect(h.checkbox.checked).toBe(true);
      h.router.feed(Buffer.from([0x20]));
      expect(h.checkbox.checked).toBe(false);
    });

    it("space on Toggle flips on", async () => {
      await flush();
      h.router.feed(Buffer.from([0x09, 0x09])); // tab twice → Toggle
      expect(h.screen.focusManager.current).toBe(h.toggle);
      h.router.feed(Buffer.from([0x20]));
      expect(h.toggle.on).toBe(true);
    });

    it("printable bytes typed into focused TextInput accumulate as value", async () => {
      await flush();
      // Tab thrice → TextInput.
      h.router.feed(Buffer.from([0x09, 0x09, 0x09]));
      expect(h.screen.focusManager.current).toBe(h.input);

      h.router.feed(Buffer.from("hi"));
      expect(h.input.value).toBe("hi");
      expect(h.input.cursorPosition).toBe(2);
    });

    it("backspace (0x7f) removes the char before the cursor", async () => {
      await flush();
      h.router.feed(Buffer.from([0x09, 0x09, 0x09]));
      h.router.feed(Buffer.from("abc"));
      h.router.feed(Buffer.from([0x7f]));
      expect(h.input.value).toBe("ab");
      expect(h.input.cursorPosition).toBe(2);
    });

    it("enter on Button fires onSubmit", async () => {
      await flush();
      // Button is already focused — first mounted widget.
      const submits: string[] = [];
      h.button.onSubmit((w) => submits.push(w.id));
      h.router.feed(Buffer.from([0x0d])); // CR
      expect(submits).toEqual(["btn"]);
    });
  });

  describe("ctrl+c", () => {
    it("emits a key event with ctrl: true and key: 'c'", async () => {
      await flush();
      const seen: { key: string; ctrl: boolean }[] = [];
      h.router.onKey((e) => seen.push({ key: e.key, ctrl: e.ctrl }));
      h.router.feed(Buffer.from([0x03])); // ETX = ctrl+c
      expect(seen).toContainEqual({ key: "c", ctrl: true });
    });
  });

  describe("Screen ANSI output", () => {
    it("first frame contains all four widget bodies and emits no cursor-up", async () => {
      await flush();
      const out = h.stdout.joined();
      expect(out).toContain("[ Save ]");
      expect(out).toContain("[ ] Agree");
      expect(out).toContain("[OFF] Sound");
      // Empty TextInput renders as bracket + spaces + bracket; just check brackets exist.
      expect(out).toMatch(/\[\s+\]/);
      // No "move cursor up" sequence on the first frame.
      expect(out).not.toMatch(/\x1b\[\d+A/);
    });

    it("subsequent frame after a state change emits cursor-up + erase-line", async () => {
      await flush();
      h.stdout.reset();

      // Trigger a re-render by tabbing focus.
      h.router.feed(Buffer.from([0x09]));
      await flush();

      const out = h.stdout.joined();
      // 4 widgets → 4 lines drawn last frame → \x1b[4A to top.
      expect(out).toMatch(/\x1b\[4A/);
      // Erase-to-end-of-line on each line.
      expect(out).toMatch(/\x1b\[K/);
      // The full-screen-clear pattern is forbidden.
      expect(out).not.toMatch(/\x1b\[2J/);
    });

    it("checking the checkbox is reflected in the next frame's text", async () => {
      await flush();

      // Tab to Checkbox + space.
      h.router.feed(Buffer.from([0x09, 0x20]));
      await flush();

      // The latest frame should contain the checked indicator.
      const out = h.stdout.joined();
      // Last frame's checkbox text is "[✓] Agree" — appears in the chunk.
      expect(out).toContain("[✓] Agree");
    });

    it("typing into TextInput updates the rendered cell content", async () => {
      await flush();

      // Tab three times → TextInput, type "hi".
      h.router.feed(Buffer.from([0x09, 0x09, 0x09]));
      h.router.feed(Buffer.from("hi"));
      await flush();

      const out = h.stdout.joined();
      expect(out).toContain("hi");
    });

    it("debounces multiple inputs within one tick into a single render", async () => {
      await flush();
      h.stdout.reset();

      // Three state-changing inputs in the same synchronous tick.
      h.router.feed(Buffer.from([0x09, 0x09, 0x09])); // tab x3
      await flush();

      // queueMicrotask coalescing: one frame, not three.
      expect(h.stdout.chunks.length).toBe(1);
    });
  });

  describe("hooks fire before focus dispatch", () => {
    it("router.onKey hooks see events even when no widget is focused", async () => {
      // Stop and recreate without auto-focus — empty screen.
      h.router.stop();
      h.screen.stop();

      const stdout = new CapturingStream();
      const stdin = new PassThrough();
      const screen = new DefaultScreen({
        out: stdout,
        width: 80,
        colorSystem: null,
        manageCursor: false,
        focusManager: new DefaultFocusManager(),
      });
      const router = new EventRouter({
        screen,
        input: stdin as unknown as NodeJS.ReadableStream & { setRawMode?: (raw: boolean) => unknown; isTTY?: boolean },
        output: stdout,
        manageMouse: false,
        manageRawMode: false,
      });

      const seen: string[] = [];
      router.onKey((e) => seen.push(e.key));

      screen.start();
      router.start();

      router.feed(Buffer.from([0x71])); // 'q'
      expect(seen).toEqual(["q"]);

      router.stop();
      screen.stop();
    });
  });
});
