/**
 * rich-explore: a file browser — a directory tree beside a preview of the
 * selected file as Markdown, source code, JSON, a directory listing, or its
 * metadata. `c` swaps the preview for a page exercising the library's exports.
 *
 * The entry for the demo's card on the docs site. A page has no file system,
 * so it browses `fixture.ts`'s files; `npm run demo` runs `node.ts`, which
 * browses the real one.
 */
import { NodeTerminalHost } from "@promptctl/rich-js/node/terminal-host";
import { MemoryFileSystem } from "../_capabilities/memory-file-system.js";
import { run } from "./app.js";
import { FIXTURE_TREE } from "./fixture.js";

// The card has no shell to return to, so say the program ended.
const host = new NodeTerminalHost();
const fs = new MemoryFileSystem(FIXTURE_TREE);
await run(host, fs, fs.homeDir()).done;
host.write("rich-explore has quit.\n");
