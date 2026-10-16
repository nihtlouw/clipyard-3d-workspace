import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackRouter } from "@tanstack/router-plugin/vite";

// `0.0.0.0:8080` is the live-preview contract — don't change host/port.
export default defineConfig({
  server: {
    host: "0.0.0.0",
    port: 8080,
    strictPort: true,
    // The live preview is reached through a proxied public hostname
    // (e.g. *.e2b.app), so Vite's host allowlist must accept it.
    allowedHosts: true,
  },
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
    },
  },
  plugins: [tanstackRouter({ target: "react" }), tailwindcss(), react()],
});
