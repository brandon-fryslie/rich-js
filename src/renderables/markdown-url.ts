/**
 * Markdown link destinations as markdown-it — Rich's parser — normalizes them:
 * `normalizeLink` for the href, `normalizeLinkText` for an autolink's text,
 * `validateLink` for which schemes may be a link at all. Each is a port of
 * markdown-it-py's own, with the two pieces of it they stand on: mdurl's
 * `parse`/`format`/`encode`/`decode`, and Python's punycode codec for a host.
 * A port rather than the platform's `URL`, because that one is WHATWG's and
 * markdown-it's is not: WHATWG folds `http://ÄB.com` to `xn--b-…` where
 * markdown-it keeps the capital, and refuses outright what markdown-it reads.
 */

import { pyStrip } from "./python-space.js";

/** A URL as mdurl's `parse` splits one; an absent part is empty. */
interface Url {
  protocol: string;
  slashes: boolean;
  auth: string;
  hostname: string;
  port: string;
  pathname: string;
  search: string;
  hash: string;
}

/** mdurl's protocol, `[a-z0-9.+-]+:` under Python's IGNORECASE, which also folds İ, ı, ſ and K (Kelvin) into `[a-z]`. */
const PROTOCOL = /^[a-z0-9.+\-\u0130\u0131\u017f\u212a]+:/i;
const PORT = /:[0-9]*$/;
const HOST_ENDING_CHARS = "/?#";
const NON_HOST_CHARS = "%/?;#'{}|\\^`<>\" \r\n\t";
const HOSTNAME_PART = /^[+a-z0-9A-Z_-]{0,63}$/;
const HOSTNAME_PART_START = /^([+a-z0-9A-Z_-]{0,63})(.*)$/s;
const HOSTNAME_MAX_LEN = 255;
/** Protocols whose hostname markdown-it recodes; anything else may not be a host at all, as `skype:name` is not. */
const RECODE_HOSTNAME_FOR = ["http:", "https:", "mailto:"];
const SLASHED_PROTOCOL = ["http:", "https:", "ftp:", "gopher:", "file:"];

/** The first index in `text` of any character of `chars`, or -1. */
function firstOf(text: string, chars: string): number {
  for (let i = 0; i < text.length; i++) if (chars.includes(text[i]!)) return i;
  return -1;
}

/** mdurl's `parse(url, slashes_denote_host=True)`, the one way markdown-it calls it. */
function parse(url: string): Url {
  const result: Url = { protocol: "", slashes: false, auth: "", hostname: "", port: "", pathname: "", search: "", hash: "" };
  let rest = pyStrip(url);
  result.protocol = PROTOCOL.exec(rest)?.[0] ?? "";
  rest = rest.slice(result.protocol.length);
  const hostless = result.protocol === "javascript:";
  const slashes = rest.startsWith("//");
  if (slashes && !hostless) {
    rest = rest.slice(2);
    result.slashes = true;
  }
  if (!hostless && (slashes || (result.protocol !== "" && !SLASHED_PROTOCOL.includes(result.protocol)))) {
    // The last `@` before the host ends is the end of the auth.
    const hostEnding = firstOf(rest, HOST_ENDING_CHARS);
    const at = hostEnding === -1 ? rest.lastIndexOf("@") : rest.lastIndexOf("@", hostEnding);
    if (at !== -1) {
      result.auth = rest.slice(0, at);
      rest = rest.slice(at + 1);
    }
    let hostEnd = firstOf(rest, NON_HOST_CHARS);
    if (hostEnd === -1) hostEnd = rest.length;
    if (hostEnd > 0 && rest[hostEnd - 1] === ":") hostEnd--;
    let host = rest.slice(0, hostEnd);
    rest = rest.slice(hostEnd);
    const port = PORT.exec(host)?.[0];
    if (port !== undefined) {
      if (port !== ":") result.port = port.slice(1);
      host = host.slice(0, -port.length);
    }
    result.hostname = host;
    const ipv6 = host.startsWith("[") && host.endsWith("]");
    if (!ipv6) {
      // A part that is no host label, even with each non-ASCII character
      // standing in for a letter, ends the host there; the rest is path.
      const parts = host.split(".");
      for (const [i, part] of parts.entries()) {
        if (HOSTNAME_PART.test(part) || HOSTNAME_PART.test(part.replace(/[^\0-\x7f]/gu, "x"))) continue;
        const [, valid, notHost] = HOSTNAME_PART_START.exec(part)!;
        rest = [notHost!, ...parts.slice(i + 1)].join(".") + rest;
        result.hostname = [...parts.slice(0, i), valid!].join(".");
        break;
      }
    }
    if ([...result.hostname].length > HOSTNAME_MAX_LEN) result.hostname = "";
    if (ipv6) result.hostname = result.hostname.slice(1, -1);
  }
  const hash = rest.indexOf("#");
  if (hash !== -1) {
    result.hash = rest.slice(hash);
    rest = rest.slice(0, hash);
  }
  const search = rest.indexOf("?");
  if (search !== -1) {
    result.search = rest.slice(search);
    rest = rest.slice(0, search);
  }
  result.pathname = rest;
  return result;
}

/** mdurl's `format`: the parts of `url` written back out. */
function format(url: Url): string {
  return (
    url.protocol +
    (url.slashes ? "//" : "") +
    (url.auth ? `${url.auth}@` : "") +
    (url.hostname.includes(":") ? `[${url.hostname}]` : url.hostname) +
    (url.port ? `:${url.port}` : "") +
    url.pathname +
    url.search +
    url.hash
  );
}

/** What mdurl's `encode` leaves as it is, besides ASCII letters and digits. */
const ENCODE_KEEP = ";/?:@&=+$,-_.!~*'()#";
const ALPHANUMERIC = /[A-Za-z0-9]/;
const HEX_PAIR = /^[0-9a-fA-F]{2}$/;

/** mdurl's `encode`: every character it does not keep percent-encoded as UTF-8, a `%` already starting an escape kept. */
function encode(text: string): string {
  let result = "";
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;
    const code = ch.charCodeAt(0);
    if (ch === "%" && i + 2 < text.length && HEX_PAIR.test(text.slice(i + 1, i + 3))) {
      result += text.slice(i, i + 3);
      i += 2;
    } else if (code < 0x80) {
      result += ALPHANUMERIC.test(ch) || ENCODE_KEEP.includes(ch) ? ch : `%${code.toString(16).toUpperCase().padStart(2, "0")}`;
    } else if (code >= 0xd800 && code <= 0xdfff) {
      const low = text.charCodeAt(i + 1);
      if (code <= 0xdbff && low >= 0xdc00 && low <= 0xdfff) {
        result += encodeURIComponent(text.slice(i, i + 2));
        i++;
      } else {
        // A lone surrogate, as the replacement character.
        result += "%EF%BF%BD";
      }
    } else {
      result += encodeURIComponent(ch);
    }
  }
  return result;
}

/** What `normalizeLinkText` leaves escaped: mdurl's default reserved set, and `%` (markdown-it issue 720). */
const DECODE_KEEP = ";/?:@&=+$,#%";
const ESCAPE_RUN = /(?:%[a-f0-9]{2})+/gi;

/**
 * The code point of the UTF-8 sequence `bytes`, or undefined where Python's
 * strict decoder refuses it: an overlong form, a surrogate, past U+10FFFF.
 */
function utf8(bytes: readonly number[]): string | undefined {
  const [lead, ...rest] = bytes;
  const point = rest.reduce((cp, b) => (cp << 6) | (b & 0x3f), lead! & (0xff >> (bytes.length + 1)));
  const least = [0, 0, 0x80, 0x800, 0x10000][bytes.length]!;
  return point < least || point > 0x10ffff || (point >= 0xd800 && point <= 0xdfff) ? undefined : String.fromCodePoint(point);
}

/**
 * mdurl's `decode` with `DECODE_KEEP` excluded: each run of percent escapes
 * read as UTF-8, a byte that is no part of a well-formed sequence as U+FFFD,
 * and an escape of a kept character left as an escape, its hex uppercased.
 */
function decode(text: string): string {
  return text.replace(ESCAPE_RUN, (run) => {
    const bytes = run.split("%").slice(1).map((hex) => parseInt(hex, 16));
    let result = "";
    for (let i = 0; i < bytes.length; ) {
      const b1 = bytes[i]!;
      if (b1 < 0x80) {
        const ch = String.fromCharCode(b1);
        result += DECODE_KEEP.includes(ch) ? `%${b1.toString(16).toUpperCase().padStart(2, "0")}` : ch;
        i++;
        continue;
      }
      // A lead byte and the continuation bytes it calls for, as many as there are.
      const length = (b1 & 0xe0) === 0xc0 ? 2 : (b1 & 0xf0) === 0xe0 ? 3 : (b1 & 0xf8) === 0xf0 ? 4 : 1;
      const sequence = bytes.slice(i, i + length);
      if (length > 1 && sequence.length === length && sequence.slice(1).every((b) => (b & 0xc0) === 0x80)) {
        result += utf8(sequence) ?? "�".repeat(length);
        i += length;
      } else {
        result += "�";
        i++;
      }
    }
    return result;
  });
}

// --- Punycode, as Python's codec writes it (RFC 3492) ---

const BASE = 36;
const DIGITS = "abcdefghijklmnopqrstuvwxyz0123456789";

/** RFC 3492's threshold for digit `j` of a generalized integer. */
function threshold(j: number, bias: number): number {
  return Math.min(26, Math.max(1, BASE * (j + 1) - bias));
}

/** RFC 3492's bias adaptation. */
function adapt(delta: number, first: boolean, points: number): number {
  delta = Math.floor(delta / (first ? 700 : 2));
  delta += Math.floor(delta / points);
  let divisions = 0;
  for (; delta > 455; divisions += BASE) delta = Math.floor(delta / 35);
  return divisions + Math.floor((BASE * delta) / (delta + 38));
}

/** Python's `codecs.encode(label, "punycode")`. */
function punycodeEncode(label: string): string {
  const points = Array.from(label, (ch) => ch.codePointAt(0)!);
  const base = points.filter((p) => p < 0x80);
  const deltas: number[] = [];
  let oldChar = 0x80;
  let oldIndex = -1;
  for (const char of [...new Set(points.filter((p) => p >= 0x80))].sort((a, b) => a - b)) {
    let delta = (points.filter((p) => p < char).length + 1) * (char - oldChar);
    let index = -1;
    for (const p of points) {
      if (p < char) index++;
      else if (p === char) {
        index++;
        deltas.push(delta + index - oldIndex - 1);
        oldIndex = index;
        delta = 0;
      }
    }
    oldChar = char;
  }
  let extended = "";
  let bias = 72;
  for (const [point, delta] of deltas.entries()) {
    for (let n = delta, j = 0; ; j++) {
      const t = threshold(j, bias);
      if (n < t) {
        extended += DIGITS[n];
        break;
      }
      extended += DIGITS[t + ((n - t) % (BASE - t))];
      n = Math.floor((n - t) / (BASE - t));
    }
    bias = adapt(delta, point === 0, base.length + point + 1);
  }
  return base.length > 0 ? `${String.fromCodePoint(...base)}-${extended}` : extended;
}

/** Python's `codecs.decode(label, "punycode")`, or undefined where it raises. */
function punycodeDecode(label: string): string | undefined {
  if (/[^\0-\x7f]/.test(label)) return undefined;
  const dash = label.lastIndexOf("-");
  const output = Array.from(dash === -1 ? "" : label.slice(0, dash));
  const extended = label.slice(dash + 1).toUpperCase();
  let char = 0x80;
  let pos = -1;
  let bias = 72;
  for (let at = 0; at < extended.length; ) {
    const first = at === 0;
    let delta = 0;
    for (let w = 1, j = 0; ; j++) {
      if (at >= extended.length) return undefined;
      const code = extended.charCodeAt(at++);
      const digit = code >= 0x41 && code <= 0x5a ? code - 0x41 : code >= 0x30 && code <= 0x39 ? code - 22 : undefined;
      if (digit === undefined) return undefined;
      const t = threshold(j, bias);
      delta += digit * w;
      if (digit < t) break;
      w *= BASE - t;
    }
    pos += delta + 1;
    char += Math.floor(pos / (output.length + 1));
    if (char > 0x10ffff) return undefined;
    pos %= output.length + 1;
    output.splice(pos, 0, String.fromCodePoint(char));
    bias = adapt(delta, first, output.length);
  }
  return output.join("");
}

/** A host's labels, split at any of the four full stops IDNA reads as one, and joined back with the ASCII one. */
const LABEL_SEPARATOR = /[.。．｡]/;

/** markdown-it's `to_ascii`: each label carrying a non-ASCII character punycoded. A hostname carries no `@`, so the email half of its `map_domain` never applies. */
function toAscii(hostname: string): string {
  return hostname
    .split(LABEL_SEPARATOR)
    .map((label) => (/[^\0-\x7e]/.test(label) ? `xn--${punycodeEncode(label)}` : label))
    .join(".");
}

/** markdown-it's `to_unicode`: each `xn--` label decoded, or undefined where one does not decode. */
function toUnicode(hostname: string): string | undefined {
  const labels = hostname.split(LABEL_SEPARATOR).map((label) => (label.startsWith("xn--") ? punycodeDecode(label.slice(4).toLowerCase()) : label));
  return labels.every((label) => label !== undefined) ? labels.join(".") : undefined;
}

/** `url` parsed, its hostname recoded by `recode` where markdown-it recodes one, and written back out. */
function recodeHostname(url: string, recode: (hostname: string) => string | undefined): string {
  const parsed = parse(url);
  if (parsed.hostname && (!parsed.protocol || RECODE_HOSTNAME_FOR.includes(parsed.protocol))) {
    parsed.hostname = recode(parsed.hostname) ?? parsed.hostname;
  }
  return format(parsed);
}

const BAD_PROTOCOL = /^(?:vbscript|javascript|file|data):/;
const GOOD_DATA = /^data:image\/(?:gif|png|jpeg|webp);/;

/**
 * The href markdown-it gives a link to `destination`: its host punycoded and
 * the rest percent-encoded, as `normalizeLink` does — or undefined where
 * `validateLink` refuses it, a script, a file, or data that is not an image.
 * markdown-it then draws no link at all.
 */
export function linkHref(destination: string): string | undefined {
  const href = encode(recodeHostname(destination, toAscii));
  const scheme = pyStrip(href).toLowerCase();
  return BAD_PROTOCOL.test(scheme) && !GOOD_DATA.test(scheme) ? undefined : href;
}

/** markdown-it's `normalizeLinkText`: an autolink's text, its host and its escapes decoded for reading. */
export function normalizeLinkText(destination: string): string {
  return decode(recodeHostname(destination, toUnicode));
}
