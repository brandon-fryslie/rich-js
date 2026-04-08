import { Table } from "../../../src/index.js";
import type { Renderable } from "../../../src/index.js";
import { formatSize, type Entry } from "../fs/walk.js";

export function renderBinary(entry: Entry): Renderable {
  const table = new Table({ box: null, showHeader: false, padding: [0, 1] });
  table.addColumn("key", { style: "bold cyan" });
  table.addColumn("value");
  table.addRow("Name", entry.name);
  table.addRow("Kind", "binary");
  table.addRow("Size", formatSize(entry.size));
  table.addRow(
    "Modified",
    entry.mtime.getTime() === 0 ? "—" : entry.mtime.toISOString(),
  );
  table.addRow("Path", entry.path);
  return table;
}
