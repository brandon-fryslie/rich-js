/**
 * The values in a card's code a slider can set, for a card whose options turn
 * its sliders on (example-card.ts; theme/CardSliders.ts draws them).
 *
 * [LAW:one-source-of-truth] A slider holds no value of its own: it is a view
 * of one literal in the program's text, found here, and setting it is an edit
 * of that text. The program is the only place a value lives, so the code a
 * card shows is always the code it runs, sliders and all.
 *
 * Pure and dependency-free: the build's tests read it in Node, the card in the page.
 *
 * A tunable is a number given a name the way a constant is in `src/renderables/effects.ts`: a
 * constant spelled in capitals, `const STRIDE = 80;`, or a property of an
 * object literal that one holds, `const DISSOLVE_SHAPE = { depth: 0.4, … }`;
 * and an ease named in such an object, `ease: EASES["ease-in-out"]`. A
 * number worked out from others (`const SLOT = P / 2`) is code, not a value,
 * and has no slider.
 */

/** A value in a program's text: what it is called, where its literal stands, and the literal read. */
export type Tunable =
  | { readonly kind: "number"; readonly name: string; readonly from: number; readonly to: number; readonly value: number }
  | { readonly kind: "ease"; readonly name: string; readonly from: number; readonly to: number; readonly value: string };

const NUMBER = String.raw`-?(?:\d+\.?\d*|\.\d+)(?:e-?\d+)?`;
const CONSTANT = String.raw`\bconst (?<name>[A-Z][A-Z0-9_]*)\s*(?::[^=;{]+)?=\s*`;
const SCALAR = new RegExp(`${CONSTANT}(?<value>${NUMBER})\\s*;`, "dg");
const OBJECT = new RegExp(`${CONSTANT}\\{`, "dg");
const PROPERTY = new RegExp(String.raw`(?<key>\b[A-Za-z_]\w*)\s*:\s*(?:(?<value>${NUMBER})|EASES\["(?<ease>[^"]+)"\])(?=\s*[,}\n])`, "dg");

/** Where the `{` at `open` in `source` is closed. */
function closing(source: string, open: number): number {
  let depth = 0;
  for (let i = open; i < source.length; i++) {
    depth += source[i] === "{" ? 1 : source[i] === "}" ? -1 : 0;
    if (depth === 0) return i;
  }
  return source.length;
}

/** Every tunable in `source`, in the order it stands there. */
export function tunables(source: string): Tunable[] {
  const found: Tunable[] = [];
  for (const m of source.matchAll(SCALAR)) {
    const [from, to] = m.indices!.groups!["value"]!;
    found.push({ kind: "number", name: m.groups!["name"]!, from, to, value: Number(m.groups!["value"]) });
  }
  for (const m of source.matchAll(OBJECT)) {
    const open = m.index + m[0].length - 1;
    const body = source.slice(open, closing(source, open) + 1);
    for (const p of body.matchAll(PROPERTY)) {
      const name = `${m.groups!["name"]}.${p.groups!["key"]}`;
      const ease = p.groups!["ease"];
      const [from, to] = (ease === undefined ? p.indices!.groups!["value"] : p.indices!.groups!["ease"])!;
      found.push(
        ease === undefined
          ? { kind: "number", name, from: open + from, to: open + to, value: Number(p.groups!["value"]) }
          : { kind: "ease", name, from: open + from, to: open + to, value: ease },
      );
    }
  }
  return found.sort((a, b) => a.from - b.from);
}

/** What a slider over `value` spans: a share's 0–1, or out to four times a larger number. */
export function range(value: number): { readonly min: number; readonly max: number; readonly step: number } {
  if (value >= 0 && value <= 1) return { min: 0, max: 1, step: 0.01 };
  const max = 4 * Math.abs(value);
  return Number.isInteger(value) ? { min: value < 0 ? -max : 0, max, step: 1 } : { min: value < 0 ? -max : 0, max, step: max / 400 };
}

/** A number as a program spells it: no more digits than it means. */
export function spelled(value: number): string {
  return String(Number(value.toPrecision(6)));
}
