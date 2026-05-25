/**
 * rich-strip — node bootstrap. Constructs the node TerminalHost and runs the
 * shared demo body against it.
 *
 * [LAW:one-source-of-truth] The demo logic lives in app.ts. This file owns
 * only the node-side host wiring; the browser bootstrap (wire.ts) is its
 * mirror image.
 */

import { NodeTerminalHost } from "../../src/index.js";
import { runDemo } from "./app.js";

const host = new NodeTerminalHost();
host.start();
runDemo(host);
host.stop();
