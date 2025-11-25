import { defineConfig } from "vite";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, "src/rrweb-injected.js"),
      name: "RRWebInjected",
      formats: ["iife"],
      fileName: () => "rrweb-injected.js",
    },
    outDir: "dist/src",
    emptyOutDir: false,
    sourcemap: false,
  },
});
