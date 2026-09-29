// An app on the alternate screen that ends the way argv names, for
// test/node/crash-order.test.ts. `traceback` as the second argument installs
// the rich crash reporter first, the way a program's entry point would.
import { App } from "../../../src/host/app.js";
import { NodeTerminalHost } from "../../../src/node/terminal-host.js";
import { installTraceback } from "../../../src/node/traceback.js";
import { RichText } from "../../../src/core/text.js";

const [ending, reporter] = process.argv.slice(2);
if (reporter === "traceback") installTraceback();

const app = new App({
  host: new NodeTerminalHost(),
  surface: "alternate",
  view: () => new RichText("FRAME", { end: "" }),
});
void app.run();

const endings: Record<string, () => void> = {
  throw: () => {
    setTimeout(() => {
      throw new Error("thrown after the first frame");
    });
  },
  reject: () => {
    void Promise.reject(new Error("rejected after the first frame"));
  },
  // Alive until the parent's signal ends it.
  signal: () => {
    setInterval(() => {}, 1000);
  },
  exit: () => process.exit(3),
  stop: () => app.stop(),
  suspend: () => {
    void app.suspend().then(() => app.stop());
  },
};
endings[ending!]!();
