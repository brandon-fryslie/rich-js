/*
 * The optional peers on disk are the lowest versions their ranges admit, which
 * is what makes `npm run lint` a compile at the floor. `peer-floor.ts` owns the
 * argument and what this cannot see.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PACKAGE_MANIFEST, REPO_ROOT } from "../../scripts/repo-facts.js";
import { optionalPeers } from "./optional-peers.js";
import {
  describePeerFloorViolation,
  peerFloorViolations,
  type InstalledPeer,
} from "./peer-floor.js";

/** The version of `name` that lint compiled. */
function installedVersion(name: string): string {
  const manifest = path.join(REPO_ROOT, "node_modules", name, "package.json");
  return (JSON.parse(readFileSync(manifest, "utf8")) as { version: string }).version;
}

function peer(range: string, installed: string): InstalledPeer {
  return { name: "engine", range, installed };
}

describe("the optional peers on disk", () => {
  it("are the lowest versions their ranges admit", () => {
    const peers = [...optionalPeers(PACKAGE_MANIFEST)].map((name) => ({
      name,
      range: PACKAGE_MANIFEST.peerDependencies![name]!,
      installed: installedVersion(name),
    }));

    expect(peerFloorViolations(peers).map(describePeerFloorViolation).join("\n")).toBe("");
  });
});

describe("peerFloorViolations", () => {
  it("passes a peer installed at the bottom of its range", () => {
    expect(peerFloorViolations([peer("^0.10.0", "0.10.0")])).toEqual([]);
  });

  it("reports a peer newer than the range's bottom, which is what src/ then outruns", () => {
    expect(peerFloorViolations([peer("^0.10.0", "0.11.0")])).toEqual([
      { name: "engine", range: "^0.10.0", installed: "0.11.0", floor: "0.10.0" },
    ]);
  });

  it("reports a newer patch the range still admits", () => {
    expect(peerFloorViolations([peer("^7.0.3", "7.0.4")])).toHaveLength(1);
  });

  it("reports a peer older than the range's bottom", () => {
    expect(peerFloorViolations([peer("^7.1.0", "7.0.3")])).toHaveLength(1);
  });

  it("reads the floor of a range with alternatives off its lowest arm", () => {
    expect(peerFloorViolations([peer("^0.12.0 || ^0.10.0", "0.10.0")])).toEqual([]);
  });

  it("refuses a range nothing satisfies, naming the peer", () => {
    expect(() => peerFloorViolations([peer(">2 <1", "1.0.0")])).toThrow(/engine: >2 <1/);
  });
});

describe("describePeerFloorViolation", () => {
  it("names the peer, both versions and the range", () => {
    const [violation] = peerFloorViolations([peer("^0.10.0", "0.11.0")]);

    const line = describePeerFloorViolation(violation!);

    for (const fact of ["engine", "^0.10.0", "0.11.0", "0.10.0"]) expect(line).toContain(fact);
  });
});
