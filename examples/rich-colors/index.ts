import { run } from "./app.js";

const startColor = process.argv[2] ?? "#2b923e";

run(startColor).catch((err) => {
  console.error("Error:", err instanceof Error ? err.message : String(err));
  process.exit(1);
});
