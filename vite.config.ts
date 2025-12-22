import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  root: "client",
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./client/src"),
      "@db": path.resolve(__dirname, "./server/db"),
      "@shared": path.resolve(__dirname, "./shared"),
    },
  },
  build: {
    outDir: "../dist/client",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom"],
          ui: ["@radix-ui/react-dialog", "@radix-ui/react-dropdown-menu"],
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    port: 5000,
    allowedHosts: [
      "rtpi.local",
      "localhost",
      ".local",
    ],
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
      },
      "/ws": {
        target: "ws://localhost:3001",
        ws: true,
      },
    },
  },
});
