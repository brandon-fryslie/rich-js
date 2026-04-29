/**
 * sysinfo — host name, uptime, load averages, and memory usage.
 *
 * Pure tick: snapshot `node:os` into a state record. Pure render: project the
 * record into a Table. The widget never touches the screen.
 */

import { hostname, loadavg, totalmem, freemem, uptime, platform, arch } from "node:os";
import { RichText, Style, Table, type Renderable } from "../../../src/index.js";
import { defineWidget } from "../runtime/widget.js";

interface SysinfoState {
  host: string;
  platform: string;
  uptimeSec: number;
  load1: number;
  load5: number;
  load15: number;
  memUsedGiB: number;
  memTotalGiB: number;
}

const BYTES_PER_GIB = 1024 ** 3;

function snapshot(): SysinfoState {
  const total = totalmem();
  const free = freemem();
  const load = loadavg();
  return {
    host: hostname(),
    platform: `${platform()}/${arch()}`,
    uptimeSec: Math.floor(uptime()),
    load1: load[0] ?? 0,
    load5: load[1] ?? 0,
    load15: load[2] ?? 0,
    memUsedGiB: (total - free) / BYTES_PER_GIB,
    memTotalGiB: total / BYTES_PER_GIB,
  };
}

function formatUptime(sec: number): string {
  const d = Math.floor(sec / 86400);
  const h = Math.floor((sec % 86400) / 3600);
  const m = Math.floor((sec % 3600) / 60);
  const s = sec % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${s}s`;
  if (m > 0) return `${m}m ${s}s`;
  return `${s}s`;
}

function row(label: string, value: string): [RichText, RichText] {
  return [
    new RichText(label, { style: Style.parse("dim"), end: "" }),
    new RichText(value, { style: Style.parse("bold green"), end: "" }),
  ];
}

function renderState(state: SysinfoState): Renderable {
  const table = Table.grid({ padding: [0, 1] });
  table.addColumn();
  table.addColumn();
  table.addRow(...row("host", state.host));
  table.addRow(...row("platform", state.platform));
  table.addRow(...row("uptime", formatUptime(state.uptimeSec)));
  table.addRow(
    ...row("load", `${state.load1.toFixed(2)}  ${state.load5.toFixed(2)}  ${state.load15.toFixed(2)}`),
  );
  table.addRow(
    ...row("memory", `${state.memUsedGiB.toFixed(1)} / ${state.memTotalGiB.toFixed(1)} GiB`),
  );
  return table;
}

export const sysinfoWidget = defineWidget<SysinfoState>({
  id: "sysinfo",
  title: " sysinfo ",
  borderStyle: "green",
  init: snapshot,
  tick: () => snapshot(),
  render: renderState,
});
