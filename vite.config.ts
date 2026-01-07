import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  root: ".",           // 👈 força usar a raiz
  plugins: [react()],
  build: {
    outDir: "dist",
    emptyOutDir: true
  }
});
