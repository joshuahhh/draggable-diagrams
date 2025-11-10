import qrcode from "qrcode-terminal";
import type { Plugin, ViteDevServer } from "vite";

export function qrcodePlugin(): Plugin {
  return {
    name: "vite-plugin-qrcode",
    configureServer(server: ViteDevServer) {
      server.httpServer?.once("listening", () => {
        setTimeout(() => {
          const info = server.resolvedUrls;
          if (!info?.network?.[0]) return;

          const networkUrl = info.network[0];

          console.log("\n");
          console.log("  Network access QR code:");
          qrcode.generate(networkUrl, { small: true }, (qr) => {
            console.log(qr);
          });
          console.log(networkUrl);
        }, 0);
      });
    },
  };
}
