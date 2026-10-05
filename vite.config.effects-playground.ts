/**
 * Dev server for examples/effects-playground: served from the repository
 * root, so the page reaches the docs' code font and `src/` by relative path.
 * It answers on every interface and to any host name, so the playground can be
 * opened from another machine on the network (by its mDNS name, say).
 */

import { defineConfig } from "vite";

export default defineConfig({
  server: { host: "0.0.0.0", port: 5199, allowedHosts: true, open: "/examples/effects-playground/" },
});
