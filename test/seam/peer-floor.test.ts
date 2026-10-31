/*
 * The peers on disk are the lowest versions their ranges admit, which is what
 * makes `npm run lint` a compile at the floor. `peer-floor.ts` owns the argument
 * and what this cannot see.
 */

import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { PACKAGE_MANIFEST, REPO_ROOT } from "../../scripts/repo-facts.js";
import {
  describePeerFloorViolation,
  peerFloorViolations,
  type InstalledPeer,
} from "./peer-floor.js";

function readManifest<T>(directory: string): T {
  return JSON.parse(readFileSync(path.join(directory, "package.json"), "utf8")) as T;
}

/** The version of `name` that lint compiled. */
function installedVersion(name: string): string {
  return readManifest<{ version: string }>(path.join(REPO_ROOT, "node_modules", name)).version;
}

function peer(range: string, installed: string, pin = installed): InstalledPeer {
  return { name: "engine", range, pin, installed };
}

describe("the peers on disk", () => {
  it("are the lowest versions their ranges admit", () => {
    // Read here and not off PACKAGE_MANIFEST, which omits the field for every rule asking what a consumer gets.
    const pins = readManifest<{ devDependencies: Record<string, string> }>(REPO_ROOT).devDependencies;
    const declared = Object.entries(PACKAGE_MANIFEST.peerDependencies ?? {});
    const peers = declared.map(([name, range]) => ({
      name,
      range,
      pin: pins[name],
      installed: installedVersion(name),
    }));

    expect(peerFloorViolations(peers).map(describePeerFloorViolation).join("\n")).toBe("");
  });
});

describe("peerFloorViolations", () => {
  it("passes a peer pinned and installed at the bottom of its range", () => {
    expect(peerFloorViolations([peer("^0.10.0", "0.10.0")])).toEqual([]);
  });

  it("reports a peer newer than the range's bottom, which is what src/ then outruns", () => {
    expect(peerFloorViolations([peer("^0.10.0", "0.11.0", "0.10.0")])).toEqual([
      { name: "engine", range: "^0.10.0", pin: "0.10.0", installed: "0.11.0", floor: "0.10.0" },
    ]);
  });

  it("reports a newer patch the range still admits", () => {
    expect(peerFloorViolations([peer("^7.0.3", "7.0.4")])).toHaveLength(1);
  });

  it("reports a range whose bottom was never published", () => {
    expect(peerFloorViolations([peer("^7.0.2", "7.0.3")])).toHaveLength(1);
  });

  it("reports a peer older than the range's bottom", () => {
    expect(peerFloorViolations([peer("^7.1.0", "7.0.3")])).toHaveLength(1);
  });

  it.each(["^7.0.3", "file:vendor/engine-7.0.3.tgz"])(
    "reports the right version on disk under the spec %s",
    (pin) => {
      expect(peerFloorViolations([peer("^7.0.3", "7.0.3", pin)])).toHaveLength(1);
    },
  );

  it("reads the floor of a range with alternatives off its lowest arm", () => {
    expect(peerFloorViolations([peer("^0.12.0 || ^0.10.0", "0.10.0")])).toEqual([]);
  });

  it("reads a build tag as the same version", () => {
    expect(peerFloorViolations([peer("^7.0.3", "7.0.3+build.1", "7.0.3")])).toEqual([]);
  });

  it.each([">2 <1", "latest"])("refuses %s, which admits no version, naming the peer", (range) => {
    expect(() => peerFloorViolations([peer(range, "1.0.0")])).toThrow(`engine: ${range}`);
  });
});

describe("describePeerFloorViolation", () => {
  it("names the peer, the range, the pin and both versions", () => {
    const [violation] = peerFloorViolations([peer("^0.10.0", "0.11.0", "^0.11.0")]);

    const line = describePeerFloorViolation(violation!);

    for (const fact of ["engine", "^0.10.0", "^0.11.0", "0.11.0", "0.10.0"]) {
      expect(line).toContain(fact);
    }
  });
});
