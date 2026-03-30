/**
 * Terminal cell width calculation.
 * Handles ASCII, CJK (double-width), and emoji characters.
 */

import stringWidth from "string-width";

// [LAW:one-source-of-truth] string-width is the single authority for cell width
const cellLenCache = new Map<string, number>();
const CACHE_MAX = 4096;

/**
 * Returns the terminal cell width of a string.
 */
export function cellLen(text: string): number {
  if (text.length === 0) return 0;
  // Fast path for pure ASCII
  if (text.length <= 64) {
    const cached = cellLenCache.get(text);
    if (cached !== undefined) return cached;
  }
  const width = stringWidth(text);
  if (text.length <= 64) {
    if (cellLenCache.size >= CACHE_MAX) cellLenCache.clear();
    cellLenCache.set(text, width);
  }
  return width;
}

/**
 * Pads or crops a string to exactly `totalWidth` terminal cells.
 * Invariant: cellLen(setCellSize(text, n)) === n (unless n is 0)
 */
export function setCellSize(text: string, totalWidth: number): string {
  if (totalWidth === 0) return "";
  const currentWidth = cellLen(text);
  if (currentWidth === totalWidth) return text;
  if (currentWidth < totalWidth) {
    return text + " ".repeat(totalWidth - currentWidth);
  }
  // Crop: walk characters, tracking cell width
  return cropToWidth(text, totalWidth);
}

/**
 * Splits text at a cell position. Returns [left, right].
 * When the position falls mid-wide-character, the left side is padded
 * to reach exactly `position` cells. The wide char remains in the right side.
 */
export function splitText(
  text: string,
  position: number,
): [string, string] {
  if (position <= 0) return ["", text];
  const totalWidth = cellLen(text);
  if (position >= totalWidth) return [text, ""];

  // Walk characters tracking cell width and source char index
  let width = 0;
  let charIndex = 0;
  for (const char of text) {
    const charWidth = cellLen(char);
    if (width + charWidth > position) break;
    width += charWidth;
    charIndex += char.length;
  }

  const left = text.slice(0, charIndex);
  const right = text.slice(charIndex);

  // If we stopped short of position (mid-wide-char), pad left with spaces
  if (width < position) {
    return [left + " ".repeat(position - width), right];
  }
  return [left, right];
}

/**
 * Wraps text into lines of at most `maxWidth` cells.
 */
export function chopCells(text: string, maxWidth: number): string[] {
  if (maxWidth <= 0 || text.length === 0) return [text];
  const totalWidth = cellLen(text);
  if (totalWidth <= maxWidth) return [text];

  const lines: string[] = [];
  let remaining = text;
  while (remaining.length > 0) {
    const remainingWidth = cellLen(remaining);
    if (remainingWidth <= maxWidth) {
      lines.push(remaining);
      break;
    }
    const [line, rest] = splitText(remaining, maxWidth);
    lines.push(line);
    remaining = rest;
  }
  return lines;
}

// --- internal ---

function cropToWidth(text: string, targetWidth: number): string {
  let width = 0;
  let i = 0;
  // Use the string's code point iterator to handle surrogate pairs
  for (const char of text) {
    const charWidth = cellLen(char);
    if (width + charWidth > targetWidth) break;
    width += charWidth;
    i += char.length;
  }
  const cropped = text.slice(0, i);
  // Pad if we couldn't hit the exact width (wide char boundary)
  const diff = targetWidth - width;
  return diff > 0 ? cropped + " ".repeat(diff) : cropped;
}
