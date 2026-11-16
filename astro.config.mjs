import { defineConfig } from "astro/config";
import react from "@astrojs/react";
import sitemap from "@astrojs/sitemap";
import tailwindcss from "@tailwindcss/vite";

// ChatWrapped is a fully static site deployed to GitHub Pages at
// https://singhtanishq.github.io/ChatWrapped/ — hence the `base` path.
export default defineConfig({
  site: "https://singhtanishq.github.io",
  base: "/ChatWrapped",
  output: "static",
  compressHTML: true,
  integrations: [react(), sitemap()],
  vite: {
    plugins: [tailwindcss()],
    worker: {
      format: "es",
    },
    build: {
      assetsInlineLimit: 0,
    },
  },
});
