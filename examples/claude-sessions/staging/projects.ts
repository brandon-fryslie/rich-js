/**
 * The `~/.claude/projects/` the card browses: real sessions from five
 * projects, one module each, written by scripts/stage-claude-sessions.ts.
 */
import type { MemoryTree } from "../../_capabilities/memory-file-system.js";
import * as ccHands from "./cc-hands.js";
import * as linksIssueTracker from "./links-issue-tracker.js";
import * as lowTalker from "./low-talker.js";
import * as richJs from "./rich-js.js";
import * as vhid from "./vhid.js";

export const STAGED_HOME: MemoryTree = {
  home: "/home/demo",
  root: {
    kind: "directory",
    children: {
      ".claude": {
        kind: "directory",
        children: {
          projects: {
            kind: "directory",
            children: Object.fromEntries([ccHands, linksIssueTracker, lowTalker, richJs, vhid].map((p) => [p.PROJECT, p.SESSIONS])),
          },
        },
      },
    },
  },
};
