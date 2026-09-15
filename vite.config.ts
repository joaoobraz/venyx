import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async () => {
  const isCloudflareBuild = process.env.CLOUDFLARE_BUILD === "true";
  const cloudflarePlugins = isCloudflareBuild
    ? [(await import("@cloudflare/vite-plugin")).cloudflare({ viteEnvironment: { name: "ssr" } })]
    : [];
  return {
    build: {
      reportCompressedSize: false,
    },
    server: {
      host: "127.0.0.1",
      port: 8080,
    },
    plugins: [
      ...cloudflarePlugins,
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        importProtection: {
          behavior: "error",
          client: {
            // Este glob não casa nada neste projeto e não pode ser apertado: a
            // proteção roda ANTES do compilador do Start remover os handlers, e
            // os *.functions.ts importam client.server.ts no topo de propósito.
            // A garantia real de que a service role não vai ao navegador é a
            // checagem pós-build em scripts/cloudflare-build.mjs.
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      viteReact(),
      tailwindcss(),
    ],
  };
});
