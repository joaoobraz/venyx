import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const packageManagerScript = process.env.npm_execpath;
const codeOnly = process.argv.includes("--code-only");
const predeploy = process.argv.includes("--predeploy");
const envArgument = process.argv.find((argument) => argument.startsWith("--env-file="));
const targetUrl = process.argv.find((argument) => argument.startsWith("--url="));
const childEnv = { ...process.env };

if (envArgument) {
  const envPath = resolve(envArgument.slice("--env-file=".length));
  if (!existsSync(envPath)) {
    console.error(`Arquivo de ambiente não encontrado: ${envPath}`);
    process.exit(2);
  }
  for (const rawLine of readFileSync(envPath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (childEnv[name] === undefined) childEnv[name] = value;
  }
}

const checks = [];
if (!codeOnly) {
  if (!envArgument) {
    console.error("Use --env-file=CAMINHO ou --code-only.");
    process.exit(2);
  }
  checks.push(["check:prod-env", ["check:prod-env", "--", envArgument]]);
}

checks.push(
  ["secret-scan", ["check:secrets"]],
  ["typecheck", ["typecheck"]],
  ["tests", ["test"]],
  ["lint", ["lint"]],
  ["cloudflare-build", ["build:cloudflare"]],
);

if (!codeOnly && !predeploy) {
  checks.push([
    "production-smoke",
    ["smoke:production", "--", targetUrl ?? "--url=https://fanlira.com.br"],
  ]);
}

for (const [label, args] of checks) {
  console.log(`\n[Fanlira] ${label}`);
  const result = packageManagerScript
    ? spawnSync(process.execPath, [packageManagerScript, "run", ...args], {
        env: childEnv,
        stdio: "inherit",
        shell: false,
      })
    : spawnSync(process.platform === "win32" ? "pnpm.cmd" : "pnpm", ["run", ...args], {
        env: childEnv,
        stdio: "inherit",
        shell: process.platform === "win32",
      });
  if (result.status !== 0) {
    console.error(`\nRelease bloqueado em: ${label}`);
    process.exit(result.status ?? 1);
  }
}

console.log(
  codeOnly
    ? "\nCódigo aprovado. Ainda execute a validação completa com o arquivo de produção."
    : predeploy
      ? "\nPré-deploy aprovado. Publique e execute o smoke de produção."
      : "\nTodos os gates automatizados de lançamento foram aprovados.",
);
