/// <reference types="vitest/config" />
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import gitignore from "parse-gitignore";
import { defineConfig } from "vite";
import { qrcode } from "vite-plugin-qrcode";

const commitHash = execSync("git rev-parse --short HEAD").toString().trim();

const { patterns } = gitignore.parse(readFileSync(".gitignore"));
const gitignoreExclude = patterns.map((p: string) => `**/${p}/**`);

export default defineConfig({
  base: "./",
  build: {
    outDir: "dist-demo",
  },
  plugins: [react(), tailwindcss(), qrcode()],
  test: {
    exclude: gitignoreExclude,
    typecheck: {
      enabled: true,
      tsconfig: "./tsconfig.app.json",
    },
  },
  define: {
    "process.env": {},
    __COMMIT_HASH__: JSON.stringify(commitHash),
  },
});
