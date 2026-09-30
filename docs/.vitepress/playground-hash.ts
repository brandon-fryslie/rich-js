/**
 * The playground's URL hash: the program a link opens, carried in the link.
 *
 * A hash is the program's UTF-8, compressed (`deflate`) and written in
 * base64url, so a link reproduces a program with no backend and survives being
 * pasted anywhere a URL does. Compressing keeps a docs-sized example to a link
 * a chat message does not cut.
 *
 * [LAW:one-source-of-truth] This module is the format. It uses only what a
 * browser and Node both provide (`CompressionStream`, `btoa`), so anything
 * that writes or reads a playground link, on the page or at build time, does
 * it here.
 */

/**
 * The longest program a link carries, in UTF-8 bytes: far past any program a
 * person writes, and far short of what a crafted hash can inflate to. A link
 * is opened on sight, so reading one must not be able to exhaust the tab.
 */
export const MAX_PROGRAM_BYTES = 1 << 20;

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

/** The hash, without its `#`, that opens the playground on `source`. */
export async function encodeProgram(source: string): Promise<string> {
  const program = new TextEncoder().encode(source);
  // A link this wrote is one `decodeProgram` opens.
  if (program.length > MAX_PROGRAM_BYTES) throw tooLong();
  const bytes = await through(program, new CompressionStream("deflate"));
  return btoa(Array.from(bytes, (byte) => String.fromCharCode(byte)).join(""))
    .replaceAll("+", "-")
    .replaceAll("/", "_")
    .replace(/=+$/, "");
}

/**
 * The program `hash` (without its `#`) opens. A hash this did not write, cut
 * short or edited by hand, throws: nothing here guesses at what it meant.
 */
export async function decodeProgram(hash: string): Promise<string> {
  const binary = atob(hash.replaceAll("-", "+").replaceAll("_", "/"));
  const bytes = await through(Uint8Array.from(binary, (char) => char.charCodeAt(0)), new DecompressionStream("deflate"));
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}
