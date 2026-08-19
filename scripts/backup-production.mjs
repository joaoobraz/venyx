import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve, sep } from "node:path";
import { createClient } from "@supabase/supabase-js";

function loadEnvFile(pathname) {
  if (!pathname) return;
  const absolutePath = resolve(pathname);
  if (!existsSync(absolutePath)) throw new Error(`Arquivo de ambiente não encontrado: ${absolutePath}`);
  for (const rawLine of readFileSync(absolutePath, "utf8").split(/\r?\n/u)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const separator = line.indexOf("=");
    if (separator < 1) continue;
    const name = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[name] === undefined) process.env[name] = value;
  }
}

const envFile = process.argv.find((argument) => argument.startsWith("--env-file="))?.slice(11);
const outputRoot = process.argv.find((argument) => argument.startsWith("--output="))?.slice(9);
if (!outputRoot) {
  console.error("Informe um destino seguro e criptografado com --output=CAMINHO.");
  process.exit(2);
}
loadEnvFile(envFile);

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(`Variável obrigatória ausente: ${name}`);
    process.exit(2);
  }
}

const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupRoot = resolve(outputRoot, `fanlira-backup-${timestamp}`);
mkdirSync(backupRoot, { recursive: true });

const packageManager = process.platform === "win32" ? "pnpm.cmd" : "pnpm";
const dbUrl = process.env.SUPABASE_DB_URL;
const dumpCommands = [
  ["roles.sql", ["--role-only"]],
  ["schema.sql", []],
  ["data.sql", ["--data-only", "--use-copy"]],
];

for (const [filename, extraArguments] of dumpCommands) {
  const destination = resolve(backupRoot, filename);
  const result = spawnSync(
    packageManager,
    ["exec", "supabase", "db", "dump", "--db-url", dbUrl, "-f", destination, ...extraArguments],
    { stdio: "inherit", shell: false },
  );
  if (result.status !== 0) {
    console.error("Falha no dump do banco. Instale a Supabase CLI no projeto e tente novamente.");
    process.exit(result.status ?? 1);
  }
}

const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const storageRoot = resolve(backupRoot, "storage");
mkdirSync(storageRoot, { recursive: true });
const objectManifest = [];

function safeDestination(bucketRoot, remotePath) {
  const parts = remotePath.replaceAll("\\", "/").split("/").filter(Boolean);
  if (parts.some((part) => part === "." || part === "..")) throw new Error("Caminho de objeto inseguro.");
  const destination = resolve(bucketRoot, ...parts);
  if (destination !== bucketRoot && !destination.startsWith(`${bucketRoot}${sep}`)) {
    throw new Error("Objeto fora do diretório do backup.");
  }
  return destination;
}

async function exportFolder(bucketId, prefix = "") {
  let offset = 0;
  while (true) {
    const { data, error } = await supabase.storage.from(bucketId).list(prefix, {
      limit: 100,
      offset,
      sortBy: { column: "name", order: "asc" },
    });
    if (error) throw error;
    const entries = data ?? [];
    for (const entry of entries) {
      const remotePath = prefix ? `${prefix}/${entry.name}` : entry.name;
      if (!entry.id) {
        await exportFolder(bucketId, remotePath);
        continue;
      }
      const { data: blob, error: downloadError } = await supabase.storage.from(bucketId).download(remotePath);
      if (downloadError) throw downloadError;
      const bytes = Buffer.from(await blob.arrayBuffer());
      const bucketRoot = resolve(storageRoot, bucketId);
      const destination = safeDestination(bucketRoot, remotePath);
      mkdirSync(dirname(destination), { recursive: true });
      writeFileSync(destination, bytes);
      objectManifest.push({
        bucket: bucketId,
        path: remotePath,
        bytes: bytes.byteLength,
        sha256: createHash("sha256").update(bytes).digest("hex"),
      });
    }
    if (entries.length < 100) break;
    offset += entries.length;
  }
}

const { data: buckets, error: bucketsError } = await supabase.storage.listBuckets();
if (bucketsError) throw bucketsError;
for (const bucket of buckets ?? []) await exportFolder(bucket.id);

const databaseFiles = dumpCommands.map(([filename]) => {
  const bytes = readFileSync(resolve(backupRoot, filename));
  return {
    filename,
    bytes: bytes.byteLength,
    sha256: createHash("sha256").update(bytes).digest("hex"),
  };
});

writeFileSync(
  resolve(backupRoot, "manifest.json"),
  `${JSON.stringify({
    service: "fanlira",
    createdAt: new Date().toISOString(),
    databaseFiles,
    storageObjects: objectManifest,
    warning: "Este backup contém dados e mídia sensíveis. Mantenha-o criptografado e com acesso restrito.",
  }, null, 2)}\n`,
);

console.log(`Backup concluído em ${backupRoot}`);
