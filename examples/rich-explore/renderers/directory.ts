import { Table } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import { listDir, formatSize, type Entry } from "../fs/walk.js";

export function renderDirectory(entry: Entry): Renderable {
  const children = listDir(entry.path);
  const table = new Table({ expand: true, showLines: false });
  table.addColumn("Name", { style: "bold" });
  table.addColumn("Kind", { style: "dim" });
  table.addColumn("Size", { justify: "right" });
  table.addColumn("Modified", { style: "dim" });
  for (const c of children) {
    const mtime = c.mtime.getTime() === 0
      ? "—"
      : c.mtime.toISOString().slice(0, 16).replace("T", " ");
    table.addRow(c.name, c.kind, formatSize(c.size), mtime);
  }
  if (children.length === 0) {
    table.addRow("(empty)", "", "", "");
  }
  return table;
}
