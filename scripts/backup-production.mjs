import { spawnSync } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { basename, dirname, relative, resolve, sep } from "node:path";
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
const keyFile = process.argv.find((argument) => argument.startsWith("--key-file="))?.slice(11);
if (!outputRoot) {
  console.error("Informe um destino seguro e criptografado com --output=CAMINHO.");
  process.exit(2);
}
if (!keyFile) {
  console.error("Informe a chave local de 32 bytes com --key-file=CAMINHO. Gere com npm run backup:key.");
  process.exit(2);
}
loadEnvFile(envFile);

function readEncryptionKey(pathname) {
  const absolutePath = resolve(pathname);
  if (!existsSync(absolutePath)) throw new Error(`Arquivo de chave não encontrado: ${absolutePath}`);
  const value = readFileSync(absolutePath, "utf8").trim();
  if (!/^[a-f0-9]{64}$/iu.test(value)) {
    throw new Error("A chave precisa conter exatamente 64 caracteres hexadecimais (32 bytes).");
  }
  return Buffer.from(value, "hex");
}

const encryptionKey = readEncryptionKey(keyFile);

const required = ["SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "SUPABASE_DB_URL"];
for (const name of required) {
  if (!process.env[name]?.trim()) {
    console.error(`Variável obrigatória ausente: ${name}`);
    process.exit(2);
  }
}

const timestamp = new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
const backupName = `fanlira-backup-${timestamp}`;
const finalRoot = resolve(outputRoot, backupName);
const backupRoot = resolve(outputRoot, `.${backupName}.plain`);
if (existsSync(finalRoot) || existsSync(backupRoot)) {
  throw new Error("O destino desse backup já existe.");
}
mkdirSync(backupRoot, { recursive: true });

function isGeneratedPlaintextPath(pathname) {
  const absoluteOutput = resolve(outputRoot);
  const absoluteTarget = resolve(pathname);
  return (
    absoluteTarget.startsWith(`${absoluteOutput}${sep}`) &&
    basename(absoluteTarget) === `.${backupName}.plain`
  );
}

let backupComplete = false;
process.on("exit", () => {
  if (!backupComplete && existsSync(backupRoot) && isGeneratedPlaintextPath(backupRoot)) {
    rmSync(backupRoot, { recursive: true, force: true });
  }
});

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

function walkFiles(directory) {
  return readdirSync(directory).flatMap((name) => {
    const pathname = resolve(directory, name);
    return statSync(pathname).isDirectory() ? walkFiles(pathname) : [pathname];
  });
}

function encryptFile(source, destination) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey, iv);
  const ciphertext = Buffer.concat([cipher.update(readFileSync(source)), cipher.final()]);
  const authTag = cipher.getAuthTag();
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, Buffer.concat([Buffer.from("FANLIRA1"), iv, authTag, ciphertext]));
}

mkdirSync(finalRoot, { recursive: true });
for (const source of walkFiles(backupRoot)) {
  const logicalPath = relative(backupRoot, source);
  encryptFile(source, resolve(finalRoot, `${logicalPath}.enc`));
}
writeFileSync(
  resolve(finalRoot, "backup-info.json"),
  `${JSON.stringify({
    format: "fanlira-aes-256-gcm-v1",
    createdAt: new Date().toISOString(),
    encryptedFiles: walkFiles(backupRoot).length,
    restoreCommand: "npm run backup:decrypt -- --input=PASTA --key-file=CHAVE --output=DESTINO",
  }, null, 2)}\n`,
);

if (!isGeneratedPlaintextPath(backupRoot)) {
  throw new Error("Recusa de limpeza: diretório temporário fora do destino esperado.");
}
rmSync(backupRoot, { recursive: true, force: true });
backupComplete = true;
console.log(`Backup criptografado concluído em ${finalRoot}`);
