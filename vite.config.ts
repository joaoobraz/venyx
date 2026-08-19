import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import type { Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async () => {
  const isCloudflareBuild = process.env.CLOUDFLARE_BUILD === "true";
  const cloudflarePlugins = isCloudflareBuild
    ? [(await import("@cloudflare/vite-plugin")).cloudflare({ viteEnvironment: { name: "ssr" } })]
    : [];
  const localNoDependencyScan: Plugin = {
    name: "venyx-local-no-dependency-scan",
    configResolved(config) {
      if (!isCloudflareBuild) {
        config.optimizeDeps.noDiscovery = true;
        config.optimizeDeps.include = [];
        config.optimizeDeps.exclude = [];
      }
    },
  };

  return {
    build: {
      reportCompressedSize: false,
    },
    optimizeDeps: {
      // The local Windows sandbox blocks native esbuild from crawling parent
      // directories. Vite can still transform requested modules normally.
      noDiscovery: !isCloudflareBuild,
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
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      viteReact(),
      tailwindcss(),
      localNoDependencyScan,
    ],
  };
});
