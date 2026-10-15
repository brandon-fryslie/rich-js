import type { Page } from "@playwright/test";

/**
 * Every error `page` raises from here on, each with its stack: a race that
 * fails one run in hundreds has to say where it threw the one time it does.
 * Playwright reports a frameless error's stack as "", not undefined, so the
 * fallback is on falsiness.
 */
export function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.stack || `${error.name}: ${error.message}`));
  return errors;
}
