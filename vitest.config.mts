import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "src/lib/__vazio.ts"),
    },
  },
  test: { include: ["src/**/*.test.ts"], exclude: [...(process.env.TESTE_BANCO ? [] : ["src/**/*.db.test.ts"]), "node_modules/**"] },
});
