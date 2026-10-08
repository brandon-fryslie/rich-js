/**
 * How big a terminal is, in cells: the one thing about a card's terminal that
 * differs from card to card, everything else being `EXAMPLE_TERMINAL`'s
 * (example-terminal.ts). A card's program carries it (example-card.ts), so a
 * playground link opens a demo at the size it is drawn to fit.
 *
 * Dependency-free, unlike example-terminal.ts, whose themes a page should not
 * download before it draws a terminal: the page reads this to open a link.
 */

export interface TerminalSize {
  readonly columns: number;
  readonly rows: number;
}

/**
 * 75 columns is what the docs content column holds in the code font at 1440px
 * wide. Where the column is narrower an output that wide shrinks its font to
 * fit (custom.css, `.rich-example-output`), down to a floor below which it
 * scrolls; it never reflows.
 */
export const EXAMPLE_SIZE: TerminalSize = { columns: 75, rows: 24 };

/**
 * The most cells a terminal is on either side. A link is opened on sight
 * (playground-hash.ts), and a crafted one must not have the page allocate a
 * screen of millions of cells.
 */
export const MAX_TERMINAL_CELLS = 500;

const cells = (value: unknown): value is number => Number.isInteger(value) && (value as number) > 0 && (value as number) <= MAX_TERMINAL_CELLS;

/**
 * [LAW:parse-dont-validate] [LAW:single-enforcer] `value` as a terminal size,
 * or what a size must be: a demo's card.json and a playground link are both
 * read here.
 */
export function terminalSize(value: unknown): TerminalSize {
  const { columns, rows } = typeof value === "object" && value !== null ? (value as { readonly columns?: unknown; readonly rows?: unknown }) : {};
  if (!cells(columns) || !cells(rows)) {
    throw new Error(`a terminal is { "columns": <cells>, "rows": <cells> }, each a whole number from 1 to ${MAX_TERMINAL_CELLS}`);
  }
  return { columns, rows };
}
