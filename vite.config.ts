import { defineConfig } from "vite";
import { qrcodePlugin } from "./vite-plugin-qrcode";

export default defineConfig({
  base: "./",
  plugins: [qrcodePlugin()],
  define: {
    "process.env": {},
  },
});
