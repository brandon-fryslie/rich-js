/**
 * End-to-end integration test for the interactive widget pipeline.
 *
 * Drives a WidgetApp over a NodeTerminalHost with a fake stdin
 * (PassThrough) and a captured stdout (Writable subclass), feeds raw byte
 * sequences, and asserts both widget state transitions and the frame the
 * app painted. This is the machine-verifiable acceptance criterion for the
 * widget framework: green here means the whole stack agrees end to end.
 *
 * [LAW:verifiable-goals] exit-zero from `npm run test` proves the
 * pipeline works.
 */

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { PassThrough, Writable } from "stream";
import stripAnsi from "strip-ansi";
import { WidgetApp } from "../../src/widgets/widget-app.js";
import { Group } from "../../src/renderables/group.js";
import type { Renderable } from "../../src/core/protocol.js";
import { NodeTerminalHost } from "../../src/node/terminal-host.js";
import { Button } from "../../src/widgets/button.js";
import { Checkbox } from "../../src/widgets/checkbox.js";
import { Toggle } from "../../src/widgets/toggle.js";
import { TextInput } from "../../src/widgets/text-input.js";
import { MONOKAI } from "../../src/themes/terminalThemes.js";

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
  app: WidgetApp;
  stdout: CapturingStream;
  stdin: PassThrough;
  button: Button;
  checkbox: Checkbox;
  toggle: Toggle;
  input: TextInput;
}

function makeApp(view: () => Renderable): { app: WidgetApp; stdout: CapturingStream; stdin: PassThrough } {
  const stdout = new CapturingStream();
  const stdin = new PassThrough();
  // [LAW:single-enforcer] One host wraps the mock streams for both the
  // painting and the input — same contract production code uses, just
  // satisfied by PassThrough + CapturingStream instead of process.stdin/stdout.
  const host = new NodeTerminalHost({
    stdin: stdin as unknown as NodeJS.ReadStream,
    stdout: stdout as unknown as NodeJS.WriteStream,
  });
  return { app: new WidgetApp({ host, surface: "alternate", view }), stdout, stdin };
}

function makeHarness(): Harness {
  const button = new Button({ label: "Save", id: "btn" });
  const checkbox = new Checkbox({ label: "Agree", id: "cb" });
  const toggle = new Toggle({ label: "Sound", id: "tg" });
  const input = new TextInput({ placeholder: "name", id: "in" });
  const view = new Group(button, checkbox, toggle, input);
  return { ...makeApp(() => view), button, checkbox, toggle, input };
}

/** The frame on screen, as the user reads it. */
function screenText(app: WidgetApp): string {
  return app.frame.map((line) => line.map((s) => s.text).join("")).join("\n");
}

async function flush(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("widget pipeline integration", () => {
  let h: Harness;

  beforeEach(() => {
    h = makeHarness();
    void h.app.run();
  });

  afterEach(() => {
    h.app.stop();
  });

  describe("focus navigation via tab", () => {
    it("the first widget in the view is focused before any key", async () => {
      await flush();
      expect(h.app.focusManager.current).toBe(h.button);
      expect(h.button.focused).toBe(true);
    });

    it("tab byte (0x09) advances focus to the next widget", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09]));
      expect(h.app.focusManager.current).toBe(h.checkbox);
      expect(h.button.focused).toBe(false);
      expect(h.checkbox.focused).toBe(true);
    });

    it("tab cycles through all four widgets and wraps", async () => {
      await flush();
      const order = [h.checkbox, h.toggle, h.input, h.button];
      for (const expected of order) {
        h.stdin.write(Buffer.from([0x09]));
        expect(h.app.focusManager.current).toBe(expected);
      }
    });

    it("shift+tab (ESC[Z) moves focus backward", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09]));
      expect(h.app.focusManager.current).toBe(h.checkbox);
      h.stdin.write(Buffer.from([0x1b, 0x5b, 0x5a])); // ESC[Z
      expect(h.app.focusManager.current).toBe(h.button);
    });
  });

  describe("widget interaction via keyboard", () => {
    it("space on Checkbox toggles checked", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09]));
      expect(h.app.focusManager.current).toBe(h.checkbox);
      h.stdin.write(Buffer.from([0x20])); // space
      expect(h.checkbox.checked).toBe(true);
      h.stdin.write(Buffer.from([0x20]));
      expect(h.checkbox.checked).toBe(false);
    });

    it("space on Toggle flips on", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09, 0x09])); // tab twice → Toggle
      expect(h.app.focusManager.current).toBe(h.toggle);
      h.stdin.write(Buffer.from([0x20]));
      expect(h.toggle.on).toBe(true);
    });

    it("printable bytes typed into focused TextInput accumulate as value", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09, 0x09, 0x09]));
      expect(h.app.focusManager.current).toBe(h.input);

      h.stdin.write(Buffer.from("hi"));
      expect(h.input.value).toBe("hi");
      expect(h.input.cursorPosition).toBe(2);
    });

    it("backspace (0x7f) removes the char before the cursor", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09, 0x09, 0x09]));
      h.stdin.write(Buffer.from("abc"));
      h.stdin.write(Buffer.from([0x7f]));
      expect(h.input.value).toBe("ab");
      expect(h.input.cursorPosition).toBe(2);
    });

    it("enter on Button fires onSubmit", async () => {
      await flush();
      const submits: string[] = [];
      h.button.onSubmit((w) => submits.push(w.id));
      h.stdin.write(Buffer.from([0x0d])); // CR
      expect(submits).toEqual(["btn"]);
    });
  });

  describe("ctrl+c", () => {
    it("emits a key event with ctrl: true and key: 'c'", async () => {
      await flush();
      const seen: { key: string; ctrl: boolean }[] = [];
      h.app.onKey((e) => seen.push({ key: e.key, ctrl: e.ctrl }));
      h.stdin.write(Buffer.from([0x03])); // ETX = ctrl+c
      expect(seen).toContainEqual({ key: "c", ctrl: true });
    });
  });

  describe("the painted frame", () => {
    it("shows all four widget bodies", async () => {
      await flush();
      const text = screenText(h.app);
      expect(text).toContain("[ Save ]");
      expect(text).toContain("[ ] Agree");
      expect(text).toContain("[OFF] Sound");
      expect(text).toMatch(/\[\s+\]/);
      expect(stripAnsi(h.stdout.joined())).toContain("[ ] Agree");
    });

    it("checking the checkbox is reflected in the next frame", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09, 0x20]));
      await flush();
      expect(screenText(h.app)).toContain("[✓] Agree");
    });

    it("typing into TextInput updates the rendered cells", async () => {
      await flush();
      h.stdin.write(Buffer.from([0x09, 0x09, 0x09]));
      h.stdin.write(Buffer.from("hi"));
      await flush();
      expect(screenText(h.app)).toContain("hi");
    });

    it("paints one frame for several inputs within one tick", async () => {
      await flush();
      h.stdout.reset();

      h.stdin.write(Buffer.from([0x09, 0x09, 0x09])); // tab x3
      await flush();

      expect(h.stdout.chunks.length).toBe(1);
    });
  });

  describe("theme reactivity", () => {
    it("setTheme on a widget in the view paints a new frame", async () => {
      // [LAW:dataflow-not-control-flow] The theme reference is
      // @observable.ref + setTheme is @action across all 5 widgets, so a
      // swap participates in the app's reaction like any other mutation.
      // This pins that contract — it broke once already when _theme was a
      // plain field and went undetected because the unit tests on widget
      // rendering didn't exercise the painting pipeline.
      await flush();
      h.stdout.reset();

      h.button.setTheme(MONOKAI);
      await flush();

      expect(h.stdout.chunks.length).toBeGreaterThan(0);
    });
  });

  describe("hooks fire before focus dispatch", () => {
    it("onKey hooks see keys even when no widget can take focus", async () => {
      const bare = makeApp(() => new Group());
      const seen: string[] = [];
      bare.app.onKey((e) => seen.push(e.key));
      void bare.app.run();
      await flush();

      bare.stdin.write(Buffer.from([0x71])); // 'q'
      expect(bare.app.focusManager.current).toBeNull();
      expect(seen).toEqual(["q"]);

      bare.app.stop();
    });
  });
});
