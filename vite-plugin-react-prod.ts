import type { HmrContext, Plugin, UserConfig } from "vite";
import { loadEnv } from "vite";

/**
 * Vite plugin that forces React into production mode during dev.
 * Controlled by VITE_REACT_PROD=true in .env.
 *
 * Usage:
 *   import react from '@vitejs/plugin-react'
 *   import { reactProd } from './vite-plugin-react-prod'
 *
 *   export default defineConfig({
 *     plugins: [react(), reactProd()],
 *   })
 */
export function reactProd(): Plugin[] {
  let enabled = false;

  return [
    {
      name: "react-prod:config",
      config(_, { mode }): UserConfig | undefined {
        const env = loadEnv(mode, process.cwd());
        enabled =
          env.VITE_REACT_PROD === "true" &&
          !process.env.VITEST &&
          mode === "development";
        if (!enabled) return;

        return {
          // Replace process.env.NODE_ENV in source code transforms
          define: {
            "process.env.NODE_ENV": '"production"',
            __VITE_REACT_PROD__: "true",
          },
          // Replace it during dependency pre-bundling so React's CJS entry
          // resolves to react.production.js
          optimizeDeps: {
            rolldownOptions: {
              transform: {
                define: {
                  "process.env.NODE_ENV": "'production'",
                },
              },
            },
          },
          // Use production JSX runtime (jsx/jsxs) instead of dev (jsxDEV),
          // and disable Fast Refresh injection
          oxc: {
            jsx: {
              development: false,
              refresh: false,
            },
          },
        } as UserConfig;
      },
    },
    {
      name: "react-prod:full-reload",
      // Fast Refresh can't work with production React, so force full page
      // reloads for JS/TS changes. CSS HMR still works normally.
      handleHotUpdate({ file, server }: HmrContext) {
        if (!enabled) return;

        if (/\.[jt]sx?$/.test(file)) {
          server.hot.send({ type: "full-reload" });
          return [];
        }
      },
    },
  ];
}
