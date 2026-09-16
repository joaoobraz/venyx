import { spawnSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

// Marcas que NUNCA podem aparecer no JavaScript entregue ao navegador. O Vite
// só embute variáveis VITE_*, então um segredo de servidor só chegaria ao
// cliente se alguém o colasse no código — é isso que este guarda pega.
// (A importProtection do Vite não serve neste projeto: roda antes do
// compilador do Start remover os handlers. Observação conhecida: o código
// de client.server.ts, que LÊ process.env, aparece no bundle via os
// *.functions.ts; o valor não vai junto porque process.env é {} no navegador.)
const CLIENT_BUNDLE_FORBIDDEN = [
  "sb_secret_W", // prefixo + 1º caractere da service role atual, sem expor o resto
  "IMPULSEPAY_SECRET_KEY",
  "IMPULSEPAY_WEBHOOK_TOKEN",
  "IMPULSEPAY_WITHDRAWAL_KEY",
  "api.impulse-pay.com", // integração é 100% servidor
  "CRON_SECRET",
];

function assertClientBundleClean() {
  const assetsDir = fileURLToPath(new URL("../dist/client/assets", import.meta.url));
  if (!existsSync(assetsDir)) return;
  const offenders = [];
  for (const file of readdirSync(assetsDir)) {
    if (!file.endsWith(".js")) continue;
    const source = readFileSync(join(assetsDir, file), "utf8");
    for (const marker of CLIENT_BUNDLE_FORBIDDEN) {
      if (source.includes(marker)) offenders.push(`${file}: ${marker}`);
    }
  }
  if (offenders.length > 0) {
    console.error("BUILD BLOQUEADO — segredo de servidor no bundle do navegador:");
    for (const line of offenders) console.error("  -", line);
    process.exit(1);
  }
}

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
  assertClientBundleClean();
}

process.exit(status);
