/**
 * Shared helpers for block renderers: timestamp formatting, selection
 * border-style helpers, text truncation.
 */

export function shortTime(iso: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso.slice(0, 19);
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  const ss = String(d.getSeconds()).padStart(2, "0");
  return `${hh}:${mm}:${ss}`;
}

export function truncate(text: string, maxLines: number): string {
  const lines = text.split("\n");
  if (lines.length <= maxLines) return text;
  return lines.slice(0, maxLines).join("\n") + `\n… (${lines.length - maxLines} more lines, press 'e' to expand)`;
}

export function borderFor(baseColor: string, isSelected: boolean): string {
  return isSelected ? `bold ${baseColor}` : baseColor;
}
