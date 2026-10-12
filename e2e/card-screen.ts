/**
 * A card's terminal as a user reads it, for every spec that drives one.
 *
 * Scrolled into view on every read: a live terminal off screen is stopped
 * (theme/LiveScreen.ts), its rows blank, and the editor opening above it can
 * push it back off after a first scroll — so a poll scrolls again each time.
 */
import type { Page } from "@playwright/test";

export const card = (page: Page) => page.locator(".rich-example-card");

/** The terminal's rows, top to bottom; xterm draws some spaces as no-break spaces. */
export async function cardRows(page: Page): Promise<string[]> {
  await card(page).locator(".rich-live").scrollIntoViewIfNeeded();
  const rows = await card(page).locator(".rich-live .xterm-rows > div").allTextContents();
  return rows.map((row) => row.replaceAll("\u00a0", " "));
}
