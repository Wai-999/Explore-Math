import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
export default defineConfig({
  plugins: [react()],
  base: process.env.VITE_BASE_PATH || "/Explore-Math/",
  test: { environment: "node", include: ["src/**/*.test.ts"] },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) =>
          id.includes("/katex/")
            ? "equations"
            : /\/(react|react-dom|scheduler)\//.test(id)
              ? "react"
              : undefined,
      },
    },
  },
});
