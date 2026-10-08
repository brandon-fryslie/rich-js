/**
 * The playground's URL hash: the program a link opens, carried in the link.
 *
 * A hash is a card's program (example-card.ts's `CardProgram`), every file of
 * it with the setup each runs on and the size and contrast of the terminal it
 * runs in, as JSON, compressed (`deflate`) and written in base64url behind the format's
 * name, `program.`. So a link reproduces a
 * program with no backend, survives being pasted anywhere a URL does, and
 * opens with each file as the card held it, a docs block's setup still locked
 * and labelled where it came from. Compressing keeps a docs-sized example to a
 * link a chat message does not cut.
 *
 * A `program.` link written before programs carried a contrast has none, and
 * opens readable, the only contrast a program had then. Links in the formats
 * before it still open, readable and at `EXAMPLE_SIZE`, the only size a
 * program ran at when they were written: `files.`, every file of a program;
 * and as a program of one file, `card.`, a docs block and its setup, and a
 * hash with no `.`, the program's source alone, every line of it the
 * reader's. base64url has no `.`, so no two formats can be mistaken for each
 * other.
 *
 * [LAW:one-source-of-truth] This module is the format. It uses only what a
 * browser and Node both provide (`CompressionStream`, `btoa`), so anything
 * that writes or reads a playground link, on the page or at build time, does
 * it here.
 */
import { CONTRASTS, NO_SETUP, PLAYGROUND_SOURCE, oneFile, type CardFile, type CardProgram, type SetupGroup } from "./example-card.js";
import { EXAMPLE_SIZE, terminalSize } from "./terminal-size.js";

/**
 * The most a link carries, in UTF-8 bytes of what it packs (the program, its
 * setup and their JSON): far past any program a person writes, and far short
 * of what a crafted hash can inflate to. A link is opened on sight, so reading
 * one must not be able to exhaust the tab.
 */
export const MAX_PROGRAM_BYTES = 1 << 20;

/** The name a hash in this format starts with, before its `.`. */
const FORMAT = "program";

/** The name a hash in the format before this one starts with: a program's files, run at `EXAMPLE_SIZE`. */
const FILES_FORMAT = "files";

/** The name a hash in the format before that one starts with: one file, a docs block and its setup. */
const ONE_FILE_FORMAT = "card";

const tooLong = () => new Error(`a playground program is at most ${MAX_PROGRAM_BYTES} bytes`);

/** All of `stream`, refused as soon as it passes `MAX_PROGRAM_BYTES`. */
async function bounded(stream: ReadableStream<Uint8Array<ArrayBuffer>>): Promise<Uint8Array<ArrayBuffer>> {
  const reader = stream.getReader();
  const chunks: Uint8Array<ArrayBuffer>[] = [];
  let size = 0;
  for (let next = await reader.read(); !next.done; next = await reader.read()) {
    size += next.value.length;
    if (size > MAX_PROGRAM_BYTES) {
      // Cancelled, so nothing past the limit is inflated.
      await reader.cancel();
      throw tooLong();
    }
    chunks.push(next.value);
  }
  return new Uint8Array(await new Blob(chunks).arrayBuffer());
}

const through = (bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream) =>
  bounded(new Blob([bytes]).stream().pipeThrough(stream));

/** `text`'s UTF-8, deflated, in base64url. */
async function packed(text: string): Promise<string> {
  const bytes = new TextEncoder().encode(text);
  // A link this wrote is one `decodeProgram` opens.
  if (bytes.length > MAX_PROGRAM_BYTES) throw tooLong();
  const deflated = await through(bytes, new CompressionStream("deflate"));
  return btoa(Array.from(deflated, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/** The text `packed` made `payload` of. */
async function unpacked(payload: string): Promise<string> {
  const binary = atob(payload.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = await through(Uint8Array.from(binary, (char) => char.charCodeAt(0)), new DecompressionStream("deflate"));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

/** The hash, without its `#`, that opens the playground on `program`. */
export async function encodeProgram(program: CardProgram): Promise<string> {
  const files = program.files.map(({ name, setup, code }) => ({ name, setup, code }));
  const { columns, rows } = program.terminal;
  return `${FORMAT}.${await packed(JSON.stringify({ files, terminal: { columns, rows }, contrast: program.contrast }))}`;
}

/** The fields of `value`, each unknown until read: none of them, for a value with no fields. */
const fields = <K extends string>(value: unknown): Partial<Record<K, unknown>> => (typeof value === "object" && value !== null ? value : {});

/**
 * A line, as the editor holds one: no line break in it. The editor turns a
 * `\r` into a line break of its own, so one anywhere would move every offset
 * after it.
 */
const isLine = (value: unknown): value is string => typeof value === "string" && !/[\r\n]/.test(value);

const isLines = (value: unknown): value is string[] => Array.isArray(value) && value.every(isLine);

const isGroup = (value: unknown): value is SetupGroup => {
  const { origin, lines } = fields<"origin" | "lines">(value);
  return typeof origin === "string" && isLines(lines);
};

/**
 * [LAW:parse-dont-validate] What a hash's JSON says of one file, as a
 * `CardFile` named `name`, or the shape it breaks: the editor locks the setup
 * by these lines, so nothing past here may hold one of another shape.
 */
function cardFile(json: unknown, name: unknown): CardFile {
  const { setup, code } = fields<"setup" | "code">(json);
  const { before, after } = fields<"before" | "after">(setup);
  if (typeof code !== "string" || code.includes("\r") || !Array.isArray(before) || !before.every(isGroup) || !isLines(after)) {
    throw new Error("the link's program is not a block and the setup it runs on");
  }
  // A name is a path an import spells, so no line break and nothing empty.
  if (typeof name !== "string" || !/^[^\r\n]+$/.test(name)) throw new Error("the link names a file of its program with no name");
  return { name, setup: { before, after }, code };
}

/** What a hash's JSON says of a program's files: one at least, no two of one name. */
function cardFiles(json: unknown): CardProgram["files"] {
  const { files } = fields<"files">(json);
  if (!Array.isArray(files) || files.length === 0) throw new Error("the link's program has no files");
  const [entry, ...rest] = files.map((file: unknown) => cardFile(file, fields<"name">(file).name));
  const names = [entry!, ...rest].map((file) => file.name);
  if (new Set(names).size !== names.length) throw new Error(`the link's program names a file twice: ${names.join(", ")}`);
  return [entry!, ...rest];
}

/** What a hash in this format says, as a `CardProgram`. */
function cardProgram(json: unknown): CardProgram {
  const { terminal, contrast = "readable" } = fields<"terminal" | "contrast">(json);
  const known = CONTRASTS.find((c) => c === contrast);
  if (known === undefined) throw new Error(`the link's program shows a contrast this playground does not know: ${JSON.stringify(contrast)}`);
  return { files: cardFiles(json), terminal: terminalSize(terminal), contrast: known };
}

/**
 * The program `hash` (without its `#`) opens. A hash this did not write, cut
 * short or edited by hand, throws: nothing here guesses at what it meant.
 */
export async function decodeProgram(hash: string): Promise<CardProgram> {
  const dot = hash.indexOf(".");
  if (dot === -1) return oneFile(NO_SETUP, await unpacked(hash));
  const format = hash.slice(0, dot);
  const json = (): Promise<unknown> => unpacked(hash.slice(dot + 1)).then((text) => JSON.parse(text) as unknown);
  if (format === FORMAT) return cardProgram(await json());
  if (format === FILES_FORMAT) return { files: cardFiles(await json()), terminal: EXAMPLE_SIZE, contrast: "readable" };
  if (format === ONE_FILE_FORMAT) {
    const { setup, code } = cardFile(await json(), PLAYGROUND_SOURCE);
    return oneFile(setup, code);
  }
  throw new Error(`a playground link in a format named "${format}", which this playground does not read`);
}
