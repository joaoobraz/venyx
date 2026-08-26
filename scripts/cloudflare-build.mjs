import { spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import { fileURLToPath } from "node:url";

const viteBin = fileURLToPath(new URL("../node_modules/vite/bin/vite.js", import.meta.url));
const result = spawnSync(
  process.execPath,
  // O carregador nativo evita que o esbuild percorra a raiz do Windows e
  // continua permitindo o import dinâmico do plugin da Cloudflare.
  [viteBin, "build", "--configLoader", "native"],
  {
    env: {
      ...process.env,
      CLOUDFLARE_BUILD: "true",
      // O artefato é a fonte de verdade do CI; logs locais do Wrangler não
      // devem tornar o build dependente de uma pasta global gravável.
      WRANGLER_WRITE_LOGS: "false",
    },
    stdio: "inherit",
  },
);

if (result.error) {
  console.error("Não foi possível iniciar o build da Cloudflare:", result.error.message);
  process.exit(1);
}

const status = result.status ?? 1;
if (status === 0) {
  // O plugin da Cloudflare pode gerar `.dev.vars` a partir do ambiente local.
  // Esse arquivo serve apenas ao desenvolvimento e não deve permanecer no
  // artefato que será arquivado ou entregue para publicação.
  for (const relativePath of ["../dist/server/.dev.vars", "../.output/server/.dev.vars"]) {
    const secretArtifact = fileURLToPath(new URL(relativePath, import.meta.url));
    if (existsSync(secretArtifact)) rmSync(secretArtifact, { force: true });
  }
}

process.exit(status);
