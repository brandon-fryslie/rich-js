/**
 * rich-markup-plugins — node bootstrap.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();
try {
  runDemo(host);
} finally {
  host.stop();
}
