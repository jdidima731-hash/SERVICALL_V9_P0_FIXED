import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(__dirname, "shared"),
      "@server": path.resolve(__dirname, "server"),
      "@drizzle": path.resolve(__dirname, "drizzle"),
    },
  },
  test: {
    environment: "node",
    include: ["server/**/*.{test,spec}.ts"],
  },
});
