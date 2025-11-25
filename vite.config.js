import { defineConfig } from "vite";
import { resolve } from "path";
import { copyFileSync, mkdirSync, existsSync } from "fs";

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        popup: resolve(__dirname, "popup/popup.html"),
        popupJs: resolve(__dirname, "popup/popup.js"),
        background: resolve(__dirname, "background.js"),
        content: resolve(__dirname, "scripts/content.js"),
      },
      output: {
        entryFileNames: (chunkInfo) => {
          // Keep the original structure
          if (chunkInfo.name === "background") {
            return "background.js";
          }
          if (chunkInfo.name === "content") {
            return "scripts/content.js";
          }
          if (chunkInfo.name === "popupJs") {
            return "popup/popup.js";
          }
          return "[name].js";
        },
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: (assetInfo) => {
          // Keep popup files in popup directory
          if (assetInfo.name && assetInfo.name.includes("popup")) {
            return "popup/[name].[ext]";
          }
          return "[name].[ext]";
        },
      },
    },
    outDir: "dist",
    emptyOutDir: true,
    sourcemap: false,
  },
  plugins: [
    {
      name: "copy-manifest-and-images",
      closeBundle() {
        // Copy manifest.json
        copyFileSync(
          resolve(__dirname, "manifest.json"),
          resolve(__dirname, "dist/manifest.json")
        );

        // Copy images directory
        const imagesDir = resolve(__dirname, "images");
        const distImagesDir = resolve(__dirname, "dist/images");

        if (existsSync(imagesDir)) {
          if (!existsSync(distImagesDir)) {
            mkdirSync(distImagesDir, { recursive: true });
          }

          const fs = require("fs");
          const files = fs.readdirSync(imagesDir);
          files.forEach((file) => {
            copyFileSync(
              resolve(imagesDir, file),
              resolve(distImagesDir, file)
            );
          });
        }
      },
    },
  ],
});
