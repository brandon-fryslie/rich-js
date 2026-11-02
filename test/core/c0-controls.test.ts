import { describe, expect, it } from "vitest";
import { AnsiDecoder, decodeAnsi } from "../../src/core/ansi.js";
import { Console } from "../../src/core/console.js";
import { labelled } from "../../src/core/orient.js";
import { renderToString } from "../../src/core/render.js";
import type { Renderable } from "../../src/core/protocol.js";
import { Segment } from "../../src/core/segment.js";
import { Style } from "../../src/core/style.js";
import { RichText } from "../../src/core/text.js";
import { Live } from "../../src/renderables/live.js";
import { Syntax } from "../../src/renderables/syntax.js";
import { JSONRenderable } from "../../src/core/json.js";
import { TextInput } from "../../src/widgets/text-input.js";

const picture = (code: number): string => String.fromCodePoint(0x2400 + code);
const DEL_PICTURE = String.fromCodePoint(0x2421);

/** Every code point of C0 and DEL, the use it keeps, and the characters `a<code>b` is written as. */
const C0: readonly (readonly [code: number, use: string, written: string])[] = [
  [0x00, "none in text: a string terminator", `a${picture(0x00)}b`],
  [0x01, "none in text: transmission framing", `a${picture(0x01)}b`],
  [0x02, "none in text: transmission framing", `a${picture(0x02)}b`],
  [0x03, "none in text: transmission framing", `a${picture(0x03)}b`],
  [0x04, "none in text: transmission framing", `a${picture(0x04)}b`],
  [0x05, "none in text: transmission framing", `a${picture(0x05)}b`],
  [0x06, "none in text: transmission framing", `a${picture(0x06)}b`],
  [0x07, "BEL's alert is Console.bell", `a${picture(0x07)}b`],
  [0x08, "BS's overstrike is decodeAnsi", `a${picture(0x08)}b`],
  [0x09, "TAB expands to its stop", "a       b"],
  [0x0a, "LF ends a line", "a\nb"],
  [0x0b, "VT is a mandatory break", "a\nb"],
  [0x0c, "FF is a mandatory break", "a\nb"],
  [0x0d, "CR gives way to CRLF's LF; its overwrite is decodeAnsi", "ab"],
  [0x0e, "none in text: SO switches the charset", `a${picture(0x0e)}b`],
  [0x0f, "none in text: SI switches the charset", `a${picture(0x0f)}b`],
  [0x10, "none in text: transmission control", `a${picture(0x10)}b`],
  [0x11, "none in text: flow control", `a${picture(0x11)}b`],
  [0x12, "none in text: device control", `a${picture(0x12)}b`],
  [0x13, "none in text: flow control", `a${picture(0x13)}b`],
  [0x14, "none in text: device control", `a${picture(0x14)}b`],
  [0x15, "none in text: transmission control", `a${picture(0x15)}b`],
  [0x16, "none in text: transmission control", `a${picture(0x16)}b`],
  [0x17, "none in text: transmission control", `a${picture(0x17)}b`],
  [0x18, "none in text: CAN aborts a sequence", `a${picture(0x18)}b`],
  [0x19, "none in text: end of medium", `a${picture(0x19)}b`],
  [0x1a, "none in text: SUB aborts a sequence", `a${picture(0x1a)}b`],
  [0x1b, "ESC's styling is decodeAnsi", `a${picture(0x1b)}b`],
  [0x1c, "none on a terminal: a data separator", `a${picture(0x1c)}b`],
  [0x1d, "none on a terminal: a data separator", `a${picture(0x1d)}b`],
  [0x1e, "none on a terminal: a data separator", `a${picture(0x1e)}b`],
  [0x1f, "none on a terminal: a data separator", `a${picture(0x1f)}b`],
  [0x7f, "none in text: DEL", `a${DEL_PICTURE}b`],
];

const PLAIN = { width: 40, colorSystem: null, hyperlinks: false } as const;
const written = (renderable: Renderable): string => renderToString(renderable, PLAIN);
const raw = (segment: Segment): Renderable => ({ render: () => [segment] });

// TAB and LF are kept; every other C0, DEL and C1 is a directive to a terminal.
const DIRECTIVE = /[\x00-\x08\x0b-\x1f\x7f-\x9f]/;

const PAYLOADS = [
  "\x1b[2J",
  "\x1b]52;c;aGk=\x07",
  "\x1b]8;;https://evil.example\x1b\\",
  "\x1bPq\x1b\\",
  "\x0e",
  "\x07",
  "\x18",
  "\x9b2J",
  "\r",
  "\x08",
];

const ALPHABET = [
  ...Array.from({ length: 0x20 }, (_, code) => String.fromCharCode(code)),
  ...Array.from({ length: 0x21 }, (_, at) => String.fromCharCode(0x7f + at)),
  ...PAYLOADS,
  "a",
  " ",
];

/** `count` strings off a linear congruential generator, so a failure replays. */
function hostile(count: number): string[] {
  let state = 0x2f6e2b1;
  const next = (bound: number): number => {
    state = (Math.imul(state, 48271) >>> 0) % 0x7fffffff;
    return state % bound;
  };
  return Array.from({ length: count }, () =>
    Array.from({ length: 1 + next(12) }, () => ALPHABET[next(ALPHABET.length)]!).join(""),
  );
}

describe("each C0 control and DEL in content", () => {
  it.each(C0)("U+%s keeps its use: %s", (code, _use, bytes) => {
    expect(written(new RichText(`a${String.fromCharCode(code)}b`, { end: "" }))).toBe(bytes);
  });

  it("has a row for every one", () => {
    expect(C0.map(([code]) => code)).toEqual([...Array.from({ length: 0x20 }, (_, code) => code), 0x7f]);
  });

  it("writes a CRLF as one line break, however it was chunked", () => {
    expect(new RichText("a\r\nb").plain).toBe("a\nb");
    const chunked = new RichText("a\r");
    chunked.append("\nb");
    expect(chunked.plain).toBe("a\nb");
  });

  it("holds one code unit for one, so a span past a control stays on its cells", () => {
    const text = new RichText("\x1b\x07ab");
    text.stylize("bold", 2, 3);
    expect(text.divide([2]).at(-1)!.plain).toBe("ab");
    expect(text.length).toBe(4);
  });
});

describe("what reaches the wire", () => {
  it("holds no directive of a raw segment, whatever it says", () => {
    const leaked = hostile(4000).filter((text) => DIRECTIVE.test(written(raw(new Segment(text)))));
    expect(leaked).toEqual([]);
  });

  it("holds no control in a link, around the library's own frame", () => {
    const frame = /^\x1b\]8;id=[0-9a-f]+;(.*)\x1b\\x\x1b\]8;;\x1b\\$/s;
    const options = { ...PLAIN, hyperlinks: true };
    const urls = hostile(4000).map((url) => frame.exec(renderToString(raw(new Segment("x", new Style({ link: `https://e/${url}` }))), options))?.[1]);
    expect(urls.filter((url) => url === undefined || DIRECTIVE.test(url) || /[\t\n]/.test(url))).toEqual([]);
  });

  const payload = PAYLOADS.join("");

  it("holds none from a label a widget draws", () => {
    expect(labelled("[ ", payload, " ]", undefined, "plain").map((segment) => written(raw(segment))).join("")).not.toMatch(DIRECTIVE);
  });

  it("holds none from a text's end", () => {
    expect(written(new RichText("a", { end: payload }))).not.toMatch(DIRECTIVE);
  });

  it("holds none from a print's end", () => {
    const chunks: string[] = [];
    new Console({ width: 40, colorSystem: null, file: { write: (chunk: string) => void chunks.push(chunk) } }).print("a", { end: payload });
    expect(chunks.join("")).not.toMatch(DIRECTIVE);
  });

  it("holds none from a TextInput's value", () => {
    expect(written(new TextInput({ value: payload }))).not.toMatch(DIRECTIVE);
  });

  it("measures a raw segment as what is written", () => {
    expect(new Segment("a\x1b[2Jb").cellLength).toBe(written(raw(new Segment("a\x1b[2Jb"))).length);
  });
});

describe("JSON", () => {
  it("keeps DEL an escape, so a document parses back to its data", () => {
    expect(written(JSONRenderable.fromData("a\x7fb"))).toBe('"a\\u007fb"\n');
  });
});

describe("Syntax", () => {
  it("shows a form feed as its escape and leaves the lines after it their numbers", () => {
    const rows = written(new Syntax("a\x0cb\nc", "text", { lineNumbers: true })).trimEnd().split("\n");
    expect(rows.map((row) => row.trim().at(0))).toEqual(["1", "2"]);
    expect(rows[0]).toContain("a\\u000cb");
  });

  it("reads a CRLF as one line ending", () => {
    expect(written(new Syntax("a\r\nb", "text")).trimEnd().split("\n").map((row) => row.trimEnd())).toEqual(["a", "b"]);
  });

  it("shows what a compiler reads and the screen would hide", () => {
    expect(written(new Syntax("// note\reval(x)", "javascript"))).toContain("// note\\u000deval(x)");
    expect(written(new Syntax("ad\x85min", "text"))).toContain("ad\\u0085min");
    const override = String.fromCodePoint(0x202e);
    expect(written(new Syntax(`a${override}b`, "text"))).toContain("a\\u202eb");
  });

  it("leaves a joiner, which a Persian comment needs", () => {
    const word = `a${String.fromCodePoint(0x200c)}b`;
    expect(written(new Syntax(word, "text"))).toContain(word);
  });
});

describe("decodeAnsi", () => {
  const spans = (text: RichText): string[] => text.spans.map((span) => `${span.start}-${span.end} ${String(span.style)}`);

  it("reads nroff's overstrike: bold, underline, and both", () => {
    const bold = decodeAnsi("N\x08NA\x08AM\x08ME\x08E");
    expect(bold.plain).toBe("NAME");
    expect(spans(bold)).toEqual(["0-4 bold"]);
    const under = decodeAnsi("_\x08f_\x08i_\x08l_\x08e");
    expect(under.plain).toBe("file");
    expect(spans(under)).toEqual(["0-4 underline"]);
    const both = decodeAnsi("_\x08x\x08x");
    expect(both.plain).toBe("x");
    expect(spans(both)).toEqual(["0-1 bold underline"]);
  });

  it("reads a strike repeated as one", () => {
    const struck = decodeAnsi("x\x08x\x08x");
    expect(struck.plain).toBe("x");
    expect(spans(struck)).toEqual(["0-1 bold"]);
  });

  it("reads a backspace that is no overstrike as the redraw it is", () => {
    const redraw = decodeAnsi("12%\x08\x08\x0813%");
    expect(redraw.plain).toBe("13%");
    expect(redraw.spans).toEqual([]);
    expect(decodeAnsi("\x08a").plain).toBe("a");
  });

  it("moves back a cell, not a code point, so a redraw lands where a terminal puts it", () => {
    expect(decodeAnsi("进度你好\x08\x08\x08\x08再见").plain).toBe("进度再见");
    expect(decodeAnsi("a字\x08\x08字").plain).toBe("a字");
    expect(decodeAnsi("é\x08x").plain).toBe("x");
  });

  it("leaves a blank where a wide character is half overwritten or erased", () => {
    expect(decodeAnsi("字\rX").plain).toBe("X ");
    expect(decodeAnsi("字\x08X").plain).toBe(" X");
    expect(decodeAnsi("字\x08\x1b[K").plain).toBe(" ");
  });

  it("keeps what has no width on the cell it follows, and takes it with that cell", () => {
    const mark = String.fromCodePoint(0x200f);
    expect(decodeAnsi(`${mark}ab`).plain).toBe(`${mark}ab`);
    expect(decodeAnsi(`字${mark}a`).plain).toBe(`字${mark}a`);
    expect(decodeAnsi(`${mark}ab\rX`).plain).toBe("Xb");
    expect(decodeAnsi(`${mark}ab\r\x1b[2Knew`).plain).toBe("new");
    expect(decodeAnsi(`${mark}ab\r${mark}cd\r${mark}ef`).plain).toBe(`${mark}ef`);
  });

  it("moves a tab to the next stop, over what is there", () => {
    expect(decodeAnsi("a\tb").plain).toBe("a\tb");
    expect(decodeAnsi("a\tb\rX").plain).toBe("X\tb");
    expect(decodeAnsi("a\tb\rXY").plain).toBe("XY      b");
    expect(decodeAnsi("\tabc\rX").plain).toBe("X       abc");
    expect(decodeAnsi("abcdefghij\r\tX").plain).toBe("abcdefghXj");
  });

  it("reads overstrike on a wide character as mandoc writes it, one backspace", () => {
    expect(spans(decodeAnsi("字\x08字"))).toEqual(["0-1 bold"]);
    expect(spans(decodeAnsi("_\x08字"))).toEqual(["0-1 underline"]);
  });

  it("leaves a string escape whole when a line break sits in its payload", () => {
    expect(decodeAnsi("a\x1b]0;ti\x0ctle\x07b").plain).toBe("ab");
    const link = decodeAnsi("\x1b]8;;http://a\x0bb\x1b\\x\x1b]8;;\x1b\\");
    expect(link.plain).toBe("x");
  });

  it("drops what a terminal draws nothing for, with no picture in a capture", () => {
    expect(new AnsiDecoder().decodeLine("do\x07ne\x0e\x1b").plain).toBe("done");
  });

  it("gives a C1 control no column", () => {
    expect(decodeAnsi("\x84ab\rX").plain).toBe("Xb");
    expect(decodeAnsi("abc\x84\x08X").plain).toBe("abX");
  });

  it("breaks a capture at every line break content does", () => {
    const ends = ["\x0b", "\x0c", String.fromCodePoint(0x2028), String.fromCodePoint(0x2029)];
    expect(ends.map((end) => decodeAnsi(`a${end}b`).plain)).toEqual(["a\nb", "a\nb", "a\nb", "a\nb"]);
  });

  it("gives one line for one line, whatever line ending it holds", () => {
    const ends = ["\x0b", "\x0c", String.fromCodePoint(0x2028), String.fromCodePoint(0x2029)];
    expect(ends.map((end) => new AnsiDecoder().decodeLine(`a${end}b`).plain)).toEqual(["ab", "ab", "ab", "ab"]);
  });
});

describe("Console.bell", () => {
  const terminal = (options: ConstructorParameters<typeof Console>[0] = {}): { console: Console; chunks: string[] } => {
    const chunks: string[] = [];
    const console = new Console({
      width: 20,
      height: 5,
      colorSystem: null,
      forceTerminal: true,
      hyperlinks: false,
      file: { write: (chunk: string) => void chunks.push(chunk) },
      ...options,
    });
    return { console, chunks };
  };

  it("writes one BEL to a person at a terminal", () => {
    const { console, chunks } = terminal();
    console.bell();
    expect(chunks).toEqual(["\x07"]);
  });

  it("writes nothing to a pipe or a dumb terminal", () => {
    const piped = terminal({ forceTerminal: false });
    piped.console.bell();
    expect(piped.chunks).toEqual([]);
    const dumb = terminal({ environment: { env: { TERM: "dumb" } } });
    dumb.console.bell();
    expect(dumb.chunks).toEqual([]);
  });

  it("answers who is at the terminal, whatever animation policy is forced", () => {
    const animated = terminal({ forceTerminal: false, forceInteractive: true });
    animated.console.bell();
    expect(animated.chunks).toEqual([]);
    const still = terminal({ forceInteractive: false });
    still.console.bell();
    expect(still.chunks).toEqual(["\x07"]);
  });

  it("writes nothing into a capture, and nothing to a recording", () => {
    const { console, chunks } = terminal({ record: true });
    console.beginCapture();
    console.bell();
    expect(console.endCapture()).toBe("");
    expect(chunks).toEqual([]);
    console.bell();
    expect(console.exportText()).toBe("");
  });

  it("leaves a running Live's frame where it is", () => {
    const { console, chunks } = terminal();
    const live = new Live(new RichText("good"), { console, autoRefresh: false });
    live.start();
    chunks.length = 0;
    console.bell();
    expect(chunks).toEqual(["\x07"]);
    live.stop();
  });
});
