import { readFileSync, statSync } from "node:fs";
import { extname } from "node:path";
import { spawnSync } from "node:child_process";

const git = process.platform === "win32" ? "git.exe" : "git";
const listed = spawnSync(git, ["ls-files", "--cached", "--others", "--exclude-standard", "-z"], {
  encoding: "utf8",
  shell: false,
});
if (listed.status !== 0) {
  console.error("Não foi possível listar os arquivos versionáveis.");
  process.exit(listed.status ?? 1);
}

const allowedExtensions = new Set([
  "", ".cjs", ".css", ".html", ".js", ".json", ".jsonc", ".jsx", ".md", ".mjs",
  ".sql", ".toml", ".ts", ".tsx", ".txt", ".yaml", ".yml",
]);
const rules = [
  ["ImpulsePay secret key", /\bsk_[A-Za-z0-9_-]{20,}\b/u],
  ["ImpulsePay withdrawal key", /\bwk_[A-Za-z0-9_-]{20,}\b/u],
  ["Supabase secret key", /\bsb_secret_[A-Za-z0-9_-]{20,}\b/u],
  ["Private key", /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u],
];
const findings = [];

for (const pathname of listed.stdout.split("\0").filter(Boolean)) {
  try {
    const stats = statSync(pathname);
    if (!stats.isFile() || stats.size > 2_000_000 || !allowedExtensions.has(extname(pathname))) continue;
    const source = readFileSync(pathname, "utf8");
    for (const [label, pattern] of rules) {
      if (pattern.test(source)) findings.push(`${pathname}: ${label}`);
    }
  } catch {
    // Arquivos removidos entre a listagem e a leitura não bloqueiam o scan.
  }
}

if (findings.length > 0) {
  for (const finding of findings) console.error(`ERRO: possível segredo em ${finding}`);
  process.exit(1);
}

console.log("Nenhum padrão de segredo foi encontrado nos arquivos versionáveis.");
