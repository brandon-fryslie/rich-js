/**
 * Bytes into a router the way a `WidgetApp` delivers them: parsed by the
 * app's one `InputParser`, each event handed to the router.
 */

import { InputParser } from "../../src/host/input.js";
import type { EventRouter } from "../../src/widgets/event-router.js";

export function parserFor(router: EventRouter): InputParser {
  return new InputParser({ key: (press) => router.key(press), mouse: (event) => router.mouse(event) });
}
