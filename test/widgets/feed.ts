/**
 * Bytes into a router the way a `WidgetApp` delivers them: parsed by the
 * app's one `InputParser`, each event handed to the router — every pointer
 * event but the vertical wheel, which `App` offers through `onWheel` instead.
 */

import { InputParser } from "../../src/host/input.js";
import type { EventRouter } from "../../src/widgets/event-router.js";

export function parserFor(router: EventRouter): InputParser {
  return new InputParser({
    key: (press) => router.key(press),
    mouse: (event) => {
      if (event.type !== "scroll_up" && event.type !== "scroll_down") router.mouse(event);
    },
  });
}
