import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  platform: "node",
  target: "node22",
  // O pacote compartilhado é TypeScript puro: entra no bundle.
  noExternal: ["@compasso/shared"],
  sourcemap: true,
  clean: true,
});
