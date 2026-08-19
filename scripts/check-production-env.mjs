import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const fileArgument = process.argv.find((argument) => argument.startsWith("--env-file="));
if (fileArgument) {
  const envPath = resolve(fileArgument.slice("--env-file=".length));
  if (!existsSync(envPath)) {
    console.error(`Arquivo de ambiente não encontrado: ${envPath}`);
    process.exit(1);
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
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

const errors = [];
const warnings = [];
const productionHosts = new Set(["fanlira.com.br", "www.fanlira.com.br"]);
const required = [
  "SUPABASE_PROJECT_ID",
  "SUPABASE_URL",
  "SUPABASE_PUBLISHABLE_KEY",
  "VITE_SUPABASE_PROJECT_ID",
  "VITE_SUPABASE_URL",
  "VITE_SUPABASE_PUBLISHABLE_KEY",
  "VITE_TURNSTILE_SITE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "IMPULSEPAY_PUBLIC_KEY",
  "IMPULSEPAY_SECRET_KEY",
  "IMPULSEPAY_WITHDRAWAL_KEY",
  "IMPULSEPAY_WEBHOOK_TOKEN",
  "IMPULSEPAY_WEBHOOK_URL",
  "CRON_SECRET",
  "OPERATIONS_ALERT_WEBHOOK_URL",
  "ALLOWED_ORIGINS",
  "VITE_SUPPORT_EMAIL",
  "VITE_PRIVACY_EMAIL",
  "VITE_ABUSE_EMAIL",
  "VITE_DMCA_EMAIL",
];

const valueOf = (name) => process.env[name]?.trim() ?? "";
const looksPlaceholder = (value) =>
  !value || /YOUR_|SEU_|CHANGE_ME|EXAMPLE|localhost|127\.0\.0\.1/iu.test(value);

for (const name of required) {
  if (looksPlaceholder(valueOf(name))) errors.push(`${name} ausente ou com valor provisório.`);
}

if (valueOf("VITE_APP_ENV") !== "production") {
  errors.push("VITE_APP_ENV deve ser production.");
}
for (const name of [
  "VITE_ENABLE_DEMO_CREATORS",
  "VITE_ENABLE_DEMO_PREVIEW",
  "VITE_ENABLE_LOCAL_PREVIEW_ACCESS",
  "ENABLE_PAYMENT_TEST_ENDPOINTS",
  "ALLOW_INSECURE_AGE_CHECK",
]) {
  if (valueOf(name) !== "false") errors.push(`${name} deve ser false em produção.`);
}

if (valueOf("SUPABASE_URL") !== valueOf("VITE_SUPABASE_URL")) {
  errors.push("SUPABASE_URL e VITE_SUPABASE_URL devem apontar para o mesmo projeto.");
}
if (valueOf("SUPABASE_PROJECT_ID") !== valueOf("VITE_SUPABASE_PROJECT_ID")) {
  errors.push("SUPABASE_PROJECT_ID e VITE_SUPABASE_PROJECT_ID devem coincidir.");
}

try {
  const supabaseUrl = new URL(valueOf("SUPABASE_URL"));
  const projectFromUrl = supabaseUrl.hostname.split(".")[0];
  if (projectFromUrl !== valueOf("SUPABASE_PROJECT_ID")) {
    errors.push("O identificador do projeto não corresponde ao host de SUPABASE_URL.");
  }
} catch {
  errors.push("SUPABASE_URL não é uma URL válida.");
}

try {
  const webhookUrl = new URL(valueOf("IMPULSEPAY_WEBHOOK_URL"));
  if (webhookUrl.protocol !== "https:") errors.push("O webhook da Impulse Pay deve usar HTTPS.");
  if (webhookUrl.hostname !== "fanlira.com.br") {
    errors.push("IMPULSEPAY_WEBHOOK_URL deve usar o domínio oficial fanlira.com.br.");
  }
  if (webhookUrl.pathname !== "/api/public/impulsepay-webhook") {
    errors.push("IMPULSEPAY_WEBHOOK_URL deve terminar em /api/public/impulsepay-webhook.");
  }
  if (webhookUrl.searchParams.has("token")) {
    warnings.push("Remova o token da URL-base; a aplicação o acrescenta de forma segura no servidor.");
  }
} catch {
  errors.push("IMPULSEPAY_WEBHOOK_URL não é uma URL válida.");
}

for (const name of ["IMPULSEPAY_WEBHOOK_TOKEN", "CRON_SECRET"]) {
  if (valueOf(name).length < 32) errors.push(`${name} deve ter pelo menos 32 caracteres aleatórios.`);
}

try {
  const alertWebhook = new URL(valueOf("OPERATIONS_ALERT_WEBHOOK_URL"));
  if (alertWebhook.protocol !== "https:") {
    errors.push("OPERATIONS_ALERT_WEBHOOK_URL deve usar HTTPS.");
  }
} catch {
  errors.push("OPERATIONS_ALERT_WEBHOOK_URL não é uma URL válida.");
}

for (const name of [
  "VITE_SUPPORT_EMAIL",
  "VITE_PRIVACY_EMAIL",
  "VITE_ABUSE_EMAIL",
  "VITE_DMCA_EMAIL",
]) {
  if (!/^[^\s@]+@fanlira\.com\.br$/iu.test(valueOf(name))) {
    errors.push(`${name} deve usar um endereço operacional em @fanlira.com.br.`);
  }
}

for (const name of [
  "VITE_LEGAL_ENTITY_NAME",
  "VITE_LEGAL_ENTITY_DOCUMENT",
  "VITE_LEGAL_ENTITY_ADDRESS",
]) {
  if (looksPlaceholder(valueOf(name))) {
    warnings.push(`${name} não configurada; completar os dados empresariais na V1.1.`);
  }
}

const origins = valueOf("ALLOWED_ORIGINS")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);
if (origins.length === 0 || origins.some((origin) => !origin.startsWith("https://"))) {
  errors.push("ALLOWED_ORIGINS deve conter apenas origens HTTPS de produção.");
}
for (const origin of origins) {
  try {
    if (!productionHosts.has(new URL(origin).hostname)) {
      errors.push(`Origem fora dos domínios oficiais da Fanlira: ${origin}`);
    }
  } catch {
    errors.push(`Origem inválida em ALLOWED_ORIGINS: ${origin}`);
  }
}

for (const name of ["AI_CHAT_COMPLETIONS_URL", "AI_API_KEY", "AI_TEXT_MODEL", "AI_VISION_MODEL"]) {
  if (!valueOf(name)) warnings.push(`${name} não configurada; uploads reais continuarão bloqueados.`);
}

for (const warning of warnings) console.warn(`AVISO: ${warning}`);
if (errors.length > 0) {
  for (const error of errors) console.error(`ERRO: ${error}`);
  console.error(`Configuração de produção reprovada (${errors.length} erro(s)).`);
  process.exit(1);
}

console.log("Configuração de produção aprovada sem exibir nenhum segredo.");
