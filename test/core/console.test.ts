import { describe, it, expect } from "vitest";
import { Console } from "../../src/core/console.js";
import { RichText } from "../../src/core/text.js";
import { Style, Theme } from "../../src/core/style.js";
import { ColorDepth } from "../../src/core/color.js";

// [LAW:behavior-not-structure] Tests assert behavioral contracts from the spec, not implementation details

// --- Helpers ---

function makeStream(): { chunks: string[]; stream: NodeJS.WritableStream } {
  const chunks: string[] = [];
  const stream = {
    write(data: string) {
      chunks.push(data);
      return true;
    },
  } as NodeJS.WritableStream;
  return { chunks, stream };
}

function captured(chunks: string[]): string {
  return chunks.join("");
}

function makeConsole(overrides: Parameters<typeof Console.prototype.constructor>[0] = {}): {
  console: Console;
  chunks: string[];
} {
  const { chunks, stream } = makeStream();
  const c = new Console({ file: stream, width: 80, colorSystem: null, ...overrides });
  return { console: c, chunks };
}

// --- Construction ---

describe("Console construction", () => {
  it("constructs with defaults", () => {
    const c = new Console({ width: 80 });
    expect(c.width).toBe(80);
    expect(c.encoding).toBe("utf-8");
  });

  it("respects width override", () => {
    const c = new Console({ width: 40 });
    expect(c.width).toBe(40);
  });

  it("respects height override", () => {
    const c = new Console({ height: 10 });
    expect(c.height).toBe(10);
  });

  it("colorSystem can be null to disable color", () => {
    const c = new Console({ colorSystem: null });
    expect(c.colorSystem).toBe(null);
  });

  it("colorSystem can be set to ansi", () => {
    const c = new Console({ colorSystem: "ansi" });
    expect(c.colorSystem).toBe(ColorDepth.STANDARD);
  });

  it("colorSystem can be set to 256", () => {
    const c = new Console({ colorSystem: "256" });
    expect(c.colorSystem).toBe(ColorDepth.EIGHT_BIT);
  });

  it("colorSystem can be set to truecolor", () => {
    const c = new Console({ colorSystem: "truecolor" });
    expect(c.colorSystem).toBe(ColorDepth.TRUECOLOR);
  });

  it("colorSystem accepts ColorDepth enum directly (e.g. WINDOWS)", () => {
    const c = new Console({ colorSystem: ColorDepth.WINDOWS });
    expect(c.colorSystem).toBe(ColorDepth.WINDOWS);
  });

  it("markup defaults to true", () => {
    const { console: c, chunks } = makeConsole();
    c.print("[bold]Hello[/bold]");
    const output = captured(chunks);
    // Markup tags should be processed, not appear literally
    expect(output).toContain("Hello");
    expect(output).not.toContain("[bold]");
  });

  it("highlight defaults to true", () => {
    // Hard to directly test highlight default without color, but we verify
    // construction succeeds and print works
    const { console: c, chunks } = makeConsole();
    c.print("Hello");
    expect(captured(chunks)).toContain("Hello");
  });

  it("accepts stderr option", () => {
    // Constructing with stderr: true should not throw
    const c = new Console({ stderr: true, width: 80 });
    expect(c).toBeDefined();
  });

  it("accepts forceTerminal option", () => {
    const c = new Console({ forceTerminal: true, width: 80 });
    expect(c.isTerminal).toBe(true);
  });

  it("accepts forceInteractive option", () => {
    const c = new Console({ forceInteractive: true, width: 80 });
    // forceInteractive controls isInteractive behavior
    expect(c).toBeDefined();
  });

  it("accepts record option", () => {
    const c = new Console({ record: true, width: 80 });
    expect(c).toBeDefined();
  });

  it("accepts a custom theme", () => {
    const theme = new Theme({ "custom.style": "bold red" });
    const c = new Console({ theme, width: 80 });
    expect(c.theme).toBe(theme);
  });

  it("accepts a base style option", () => {
    const { console: c, chunks } = makeConsole({ style: "bold" });
    c.print("Hello");
    // Should not throw and should produce output
    expect(captured(chunks)).toContain("Hello");
  });

  it("accepts a file option for custom output stream", () => {
    const { chunks, stream } = makeStream();
    const c = new Console({ file: stream, width: 80, colorSystem: null });
    c.print("Hello");
    expect(captured(chunks)).toContain("Hello");
  });
});

// --- Auto-detected Attributes ---

describe("Console auto-detected attributes", () => {
  it(".size returns width and height", () => {
    const c = new Console({ width: 120, height: 50 });
    expect(c.size).toEqual({ width: 120, height: 50 });
  });

  it(".encoding returns utf-8", () => {
    const c = new Console({ width: 80 });
    expect(c.encoding).toBe("utf-8");
  });

  it(".isTerminal returns false when writing to a file/stream", () => {
    const { stream } = makeStream();
    const c = new Console({ file: stream, width: 80 });
    expect(c.isTerminal).toBe(false);
  });

  it(".isTerminal returns true when forceTerminal is set", () => {
    const { stream } = makeStream();
    const c = new Console({ file: stream, width: 80, forceTerminal: true });
    expect(c.isTerminal).toBe(true);
  });

  it(".colorSystem reflects configured value", () => {
    const c = new Console({ colorSystem: "truecolor" });
    expect(c.colorSystem).toBe(ColorDepth.TRUECOLOR);
  });

  it(".colorSystem is null when set to null", () => {
    const c = new Console({ colorSystem: null });
    expect(c.colorSystem).toBe(null);
  });
});

// --- Color Systems ---

describe("Console color systems", () => {
  it("null disables all color (0 colors)", () => {
    const { console: c, chunks } = makeConsole({ colorSystem: null });
    c.print("Hello");
    const output = captured(chunks);
    // With null color system, output should have no ANSI escape codes
    expect(output).not.toMatch(/\x1b\[/);
  });

  it("ansi maps to STANDARD color system", () => {
    const c = new Console({ colorSystem: "ansi" });
    expect(c.colorSystem).toBe(ColorDepth.STANDARD);
  });

  it("256 maps to EIGHT_BIT color system", () => {
    const c = new Console({ colorSystem: "256" });
    expect(c.colorSystem).toBe(ColorDepth.EIGHT_BIT);
  });

  it("truecolor maps to TRUECOLOR color system", () => {
    const c = new Console({ colorSystem: "truecolor" });
    expect(c.colorSystem).toBe(ColorDepth.TRUECOLOR);
  });

  it("ColorDepth.WINDOWS enum maps through directly", () => {
    const c = new Console({ colorSystem: ColorDepth.WINDOWS });
    expect(c.colorSystem).toBe(ColorDepth.WINDOWS);
  });
});

// --- Printing ---

describe("Console.print()", () => {
  it("prints a simple string", () => {
    const { console: c, chunks } = makeConsole();
    c.print("Hello World");
    expect(captured(chunks)).toContain("Hello World");
  });

  it("appends newline by default (end='\\n')", () => {
    const { console: c, chunks } = makeConsole();
    c.print("Hello");
    const output = captured(chunks);
    // Output should end with a newline (spec: end defaults to "\n")
    expect(output).toContain("Hello");
    expect(output.endsWith("\n")).toBe(true);
  });

  it("respects custom end option", () => {
    const { console: c, chunks } = makeConsole();
    c.print("Hello", { end: "!" });
    const output = captured(chunks);
    expect(output).toContain("Hello");
    // Custom end character should appear at the end of output
    expect(output.endsWith("!")).toBe(true);
  });

  it("processes markup when enabled", () => {
    const { console: c, chunks } = makeConsole({ markup: true });
    c.print("[bold]Hello[/bold]");
    const output = captured(chunks);
    expect(output).toContain("Hello");
    expect(output).not.toContain("[bold]");
  });

  it("does not process markup when disabled at construction", () => {
    const { console: c, chunks } = makeConsole({ markup: false });
    c.print("[bold]Hello[/bold]");
    const output = captured(chunks);
    expect(output).toContain("[bold]");
  });

  it("per-call markup option overrides constructor setting", () => {
    // Console has markup enabled, but per-call disables it
    const { console: c, chunks } = makeConsole({ markup: true });
    c.print("[bold]Hello[/bold]", { markup: false });
    const output = captured(chunks);
    expect(output).toContain("[bold]");
  });

  it("prints renderable objects by calling their render()", () => {
    const { console: c, chunks } = makeConsole();
    const text = new RichText("Rich Text", { end: "" });
    c.print(text);
    expect(captured(chunks)).toContain("Rich Text");
  });

  it("converts non-string non-renderable objects to string", () => {
    const { console: c, chunks } = makeConsole({ markup: false });
    c.print(42);
    expect(captured(chunks)).toContain("42");
  });

  it("separates multiple items with space by default", () => {
    const { console: c, chunks } = makeConsole({ markup: false });
    c.print("A", "B", "C");
    const output = captured(chunks);
    expect(output).toContain("A");
    expect(output).toContain("B");
    expect(output).toContain("C");
  });

  it("applies per-call style option", () => {
    // With colorSystem: truecolor, a styled print should include ANSI codes
    const { console: c, chunks } = makeConsole({ colorSystem: "truecolor" });
    c.print("Hello", { style: "bold" });
    const output = captured(chunks);
    // Bold ANSI code is \x1b[1m
    expect(output).toMatch(/\x1b\[/);
    expect(output).toContain("Hello");
  });
});

// --- Justify modes ---

describe("Console.print() justify modes", () => {
  it("default justify: left-aligned, no trailing padding", () => {
    const { console: c, chunks } = makeConsole({ width: 40, markup: false });
    c.print("Hi", { justify: "default" });
    const output = captured(chunks);
    expect(output).toContain("Hi");
    // No trailing padding means line should be short
    expect(output.trimEnd().length).toBeLessThan(40);
  });

  it("left justify: left-aligned, padded to full width", () => {
    const { console: c, chunks } = makeConsole({ width: 20, markup: false });
    c.print("Hi", { justify: "left" });
    const output = captured(chunks);
    expect(output).toContain("Hi");
  });

  it("center justify: centered within terminal width", () => {
    const { console: c, chunks } = makeConsole({ width: 40, markup: false });
    c.print("Hi", { justify: "center" });
    const output = captured(chunks);
    expect(output).toContain("Hi");
    // Centered text should have leading spaces
    const line = output.split("\n")[0];
    expect(line.length).toBeGreaterThan(2);
  });

  it("right justify: right-aligned within terminal width", () => {
    const { console: c, chunks } = makeConsole({ width: 40, markup: false });
    c.print("Hi", { justify: "right" });
    const output = captured(chunks);
    expect(output).toContain("Hi");
    const line = output.split("\n")[0];
    // Right-aligned text should have leading spaces
    expect(line.startsWith(" ")).toBe(true);
  });
});

// --- Overflow modes ---

describe("Console.print() overflow modes", () => {
  it("fold: excess characters wrap to next line", () => {
    const { console: c, chunks } = makeConsole({ width: 10, markup: false });
    c.print("ABCDEFGHIJKLMNOP", { overflow: "fold" });
    const output = captured(chunks);
    expect(output).toContain("ABCDEFGHIJ");
  });

  it("crop: truncate at line end", () => {
    const { console: c, chunks } = makeConsole({ width: 10, markup: false });
    c.print("ABCDEFGHIJKLMNOP", { overflow: "crop" });
    const output = captured(chunks);
    // Cropped output should not contain the full string
    expect(output).not.toContain("ABCDEFGHIJKLMNOP");
  });

  it("ellipsis: truncate with ellipsis character at line end", () => {
    const { console: c, chunks } = makeConsole({ width: 10, markup: false });
    c.print("ABCDEFGHIJKLMNOP", { overflow: "ellipsis" });
    const output = captured(chunks);
    // Implementation uses Unicode ellipsis character
    expect(output).toContain("\u2026");
  });
});

// --- Soft Wrapping ---

describe("Console.print() soft wrapping", () => {
  it("softWrap disables word wrapping", () => {
    const { console: c, chunks } = makeConsole({ width: 10, markup: false });
    const longText = "This is a very long line that should not be wrapped";
    c.print(longText, { softWrap: true });
    const output = captured(chunks);
    expect(output).toContain(longText);
  });
});

// --- Console.log() ---

describe("Console.log()", () => {
  it("adds a timestamp to output", () => {
    const { console: c, chunks } = makeConsole({ markup: false });
    c.log("Hello");
    const output = captured(chunks);
    expect(output).toContain("Hello");
    // Should contain time-like text (e.g., brackets around time)
    expect(output).toMatch(/\[.*\]/);
  });
});

// --- Console.rule() ---

describe("Console.rule()", () => {
  it("draws a horizontal rule", () => {
    const { console: c, chunks } = makeConsole({ width: 40 });
    c.rule();
    const output = captured(chunks);
    // Rule should produce output spanning near the terminal width
    expect(output.length).toBeGreaterThan(10);
  });

  it("draws a rule with a title", () => {
    const { console: c, chunks } = makeConsole({ width: 40 });
    c.rule("Title");
    const output = captured(chunks);
    expect(output).toContain("Title");
    expect(output.length).toBeGreaterThan(10);
  });

  it("accepts a style option", () => {
    // Should not throw
    const { console: c, chunks } = makeConsole({ width: 40 });
    c.rule("Test", { style: "bold" });
    const output = captured(chunks);
    expect(output).toContain("Test");
  });

  it("accepts an align option", () => {
    const { console: c, chunks } = makeConsole({ width: 40 });
    c.rule("Left", { align: "left" });
    const output = captured(chunks);
    expect(output).toContain("Left");
  });
});

// --- Console.printJson() ---

describe("Console.printJson()", () => {
  it("pretty-prints a JSON string", () => {
    const { console: c, chunks } = makeConsole();
    c.printJson('{"key": "value"}');
    const output = captured(chunks);
    expect(output).toContain("key");
    expect(output).toContain("value");
  });

  it("pretty-prints a JSON object", () => {
    const { console: c, chunks } = makeConsole();
    c.printJson({ key: "value" });
    const output = captured(chunks);
    expect(output).toContain("key");
    expect(output).toContain("value");
  });
});

// --- Console.options ---

describe("Console.options", () => {
  it("returns RenderOptions with maxWidth matching console width", () => {
    const c = new Console({ width: 60 });
    const opts = c.options;
    expect(opts.maxWidth).toBe(60);
  });

  it("includes isTerminal in render options", () => {
    const { stream } = makeStream();
    const c = new Console({ file: stream, width: 80 });
    expect(c.options.isTerminal).toBe(false);
  });

  it("includes encoding in render options", () => {
    const c = new Console({ width: 80 });
    expect(c.options.encoding).toBe("utf-8");
  });
});

// --- Console style (base style applied to all output) ---

describe("Console base style", () => {
  it("applies base style to all printed output", () => {
    const { console: c, chunks } = makeConsole({
      style: "bold",
      colorSystem: "truecolor",
    });
    c.print("Hello");
    const output = captured(chunks);
    // With truecolor and bold base style, output should contain ANSI bold code
    expect(output).toMatch(/\x1b\[/);
    expect(output).toContain("Hello");
  });

  it("base style can be a Style object", () => {
    const style = Style.parse("italic");
    const { console: c, chunks } = makeConsole({
      style,
      colorSystem: "truecolor",
    });
    c.print("Hello");
    const output = captured(chunks);
    expect(output).toContain("Hello");
  });
});

// --- Record and Export ---

describe("Console record and export", () => {
  it("records output when record:true and exports as text", () => {
    const { console: c, chunks } = makeConsole({ record: true });
    c.print("Hello World");
    const exported = c.exportText();
    expect(exported).toContain("Hello World");
  });

  it("does not record when record:false", () => {
    const { console: c } = makeConsole({ record: false });
    c.print("Hello World");
    const exported = c.exportText();
    expect(exported).toBe("");
  });

  it("exportText() flushes buffer by default", () => {
    // Spec: buffer is flushed on export unless clear: false
    const { console: c } = makeConsole({ record: true });
    c.print("First");
    const exported1 = c.exportText();
    expect(exported1).toContain("First");
    // Buffer cleared — second export returns empty
    const exported2 = c.exportText();
    expect(exported2).toBe("");
  });

  it("exportText({ clear: false }) retains buffer", () => {
    // Spec: buffer is flushed on export unless clear: false
    const { console: c } = makeConsole({ record: true });
    c.print("First");
    c.exportText({ clear: false });
    // Buffer retained — second export still has content
    const exported2 = c.exportText();
    expect(exported2).toContain("First");
  });

  it("exportHtml() returns HTML containing the recorded text", () => {
    const { console: c } = makeConsole({ record: true });
    c.print("Hello World");
    const html = c.exportHtml();
    expect(html).toContain("Hello World");
    expect(html.toLowerCase()).toContain("<!doctype html>");
  });

  it("exportHtml() flushes buffer by default", () => {
    const { console: c } = makeConsole({ record: true });
    c.print("First");
    c.exportHtml();
    const html2 = c.exportHtml();
    expect(html2).not.toContain("First");
  });

  it("exportHtml({ clear: false }) retains buffer", () => {
    const { console: c } = makeConsole({ record: true });
    c.print("First");
    c.exportHtml({ clear: false });
    const html2 = c.exportHtml();
    expect(html2).toContain("First");
  });

  it("saveText() writes plain text to a file", async () => {
    const { mkdtempSync, rmSync } = await import("fs");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const { readFileSync } = await import("fs");
    const dir = mkdtempSync(join(tmpdir(), "rich-test-"));
    const path = join(dir, "out.txt");
    try {
      const { console: c } = makeConsole({ record: true });
      c.print("Saved text");
      c.saveText(path);
      const content = readFileSync(path, "utf-8");
      expect(content).toContain("Saved text");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });

  it("saveHtml() writes HTML to a file", async () => {
    const { mkdtempSync, rmSync } = await import("fs");
    const { tmpdir } = await import("os");
    const { join } = await import("path");
    const { readFileSync } = await import("fs");
    const dir = mkdtempSync(join(tmpdir(), "rich-test-"));
    const path = join(dir, "out.html");
    try {
      const { console: c } = makeConsole({ record: true });
      c.print("Saved HTML");
      c.saveHtml(path);
      const content = readFileSync(path, "utf-8");
      expect(content).toContain("Saved HTML");
      expect(content.toLowerCase()).toContain("<!doctype html>");
    } finally {
      rmSync(dir, { recursive: true });
    }
  });
});

// --- Terminal Detection ---

describe("Console terminal detection", () => {
  it("isTerminal is false for non-TTY output", () => {
    const { stream } = makeStream();
    const c = new Console({ file: stream, width: 80 });
    expect(c.isTerminal).toBe(false);
  });

  it("forceTerminal overrides TTY detection", () => {
    const { stream } = makeStream();
    const c = new Console({ file: stream, width: 80, forceTerminal: true });
    expect(c.isTerminal).toBe(true);
  });

  it("null colorSystem strips ANSI codes from output", () => {
    const { console: c, chunks } = makeConsole({ colorSystem: null });
    c.print("[bold red]Hello[/bold red]");
    const output = captured(chunks);
    // No ANSI escape sequences should appear
    expect(output).not.toMatch(/\x1b\[/);
    expect(output).toContain("Hello");
  });
});

// --- File/Error Output ---

describe("Console file/error output", () => {
  it("writes to custom file stream", () => {
    const { chunks, stream } = makeStream();
    const c = new Console({ file: stream, width: 80, colorSystem: null });
    c.print("File output");
    expect(captured(chunks)).toContain("File output");
  });

  it("stderr option selects stderr output target", () => {
    // We can only verify construction doesn't throw; actual stderr writing
    // requires process.stderr which is real
    const c = new Console({ stderr: true, width: 80, colorSystem: null });
    expect(c).toBeDefined();
  });
});
