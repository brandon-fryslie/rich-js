import type { Page } from "@playwright/test";

/**
 * Every error `page` raises from here on, each with its stack: a race that
 * fails one run in hundreds has to say where it threw the one time it does
 * (rich-demos-k78j.4rx went unfixed for want of one).
 */
export function pageErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.stack ?? error.message));
  return errors;
}
