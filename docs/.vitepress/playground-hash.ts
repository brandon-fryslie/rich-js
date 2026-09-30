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

async function through(bytes: Uint8Array<ArrayBuffer>, stream: CompressionStream | DecompressionStream): Promise<Uint8Array<ArrayBuffer>> {
  return new Uint8Array(await new Response(new Blob([bytes]).stream().pipeThrough(stream)).arrayBuffer());
}

/** The hash, without its `#`, that opens the playground on `source`. */
export async function encodeProgram(source: string): Promise<string> {
  const bytes = await through(new TextEncoder().encode(source), new CompressionStream("deflate"));
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
