import { createDecipheriv, createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, relative, resolve, sep } from "node:path";

function argument(name) {
  return process.argv.find((value) => value.startsWith(`--${name}=`))?.slice(name.length + 3);
}

const input = argument("input");
const output = argument("output");
const keyFile = argument("key-file");
if (!input || !output || !keyFile) {
  console.error("Uso: npm run backup:decrypt -- --input=PASTA --key-file=CHAVE --output=DESTINO");
  process.exit(2);
}

const inputRoot = resolve(input);
const outputRoot = resolve(output);
if (!existsSync(inputRoot)) throw new Error(`Backup não encontrado: ${inputRoot}`);
if (existsSync(outputRoot)) throw new Error(`O destino já existe: ${outputRoot}`);

const keyText = readFileSync(resolve(keyFile), "utf8").trim();
if (!/^[a-f0-9]{64}$/iu.test(keyText)) throw new Error("Chave inválida.");
const key = Buffer.from(keyText, "hex");

function walk(directory) {
  return readdirSync(directory).flatMap((name) => {
    const pathname = resolve(directory, name);
    return statSync(pathname).isDirectory() ? walk(pathname) : [pathname];
  });
}

function safeDestination(logicalPath) {
  const destination = resolve(outputRoot, logicalPath);
  if (destination !== outputRoot && !destination.startsWith(`${outputRoot}${sep}`)) {
    throw new Error("Caminho inseguro no backup.");
  }
  return destination;
}

for (const source of walk(inputRoot).filter((pathname) => pathname.endsWith(".enc"))) {
  const payload = readFileSync(source);
  if (payload.subarray(0, 8).toString("utf8") !== "FANLIRA1") {
    throw new Error(`Formato inválido: ${source}`);
  }
  const iv = payload.subarray(8, 20);
  const authTag = payload.subarray(20, 36);
  const ciphertext = payload.subarray(36);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(authTag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  const logicalPath = relative(inputRoot, source).slice(0, -4);
  const destination = safeDestination(logicalPath);
  mkdirSync(dirname(destination), { recursive: true });
  writeFileSync(destination, plaintext);
}

const manifestPath = resolve(outputRoot, "manifest.json");
if (!existsSync(manifestPath)) throw new Error("Manifesto não encontrado após descriptografia.");
const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
for (const file of manifest.databaseFiles ?? []) {
  const bytes = readFileSync(safeDestination(file.filename));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== file.sha256) throw new Error(`Hash inválido: ${file.filename}`);
}
for (const item of manifest.storageObjects ?? []) {
  const bytes = readFileSync(safeDestination(`storage/${item.bucket}/${item.path}`));
  const hash = createHash("sha256").update(bytes).digest("hex");
  if (hash !== item.sha256) throw new Error(`Hash inválido: ${item.bucket}/${item.path}`);
}

console.log(`Backup descriptografado e hashes verificados em ${outputRoot}`);
