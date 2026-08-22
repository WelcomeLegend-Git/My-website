import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

/**
 * Isolated dev server for the Ludo Arena feature.
 * Serves ONLY the feature preview — the main website stays untouched.
 * Run: npx vite --config apps/web/vite.ludo.config.ts
 */
export default defineConfig({
  root: "src/features/ludo/preview",
  plugins: [react()],
  server: {
    port: 5199,
    strictPort: true,
    open: false,
  },
  preview: {
    port: 5199,
  },
});