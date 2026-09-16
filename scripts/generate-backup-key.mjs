import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";

const output = process.argv.find((argument) => argument.startsWith("--output="))?.slice(9);
if (!output) {
  console.error("Uso: npm run backup:key -- --output=C:\\caminho\\fanlira-backup.key");
  process.exit(2);
}

const destination = resolve(output);
if (existsSync(destination)) {
  console.error(`Recusado: o arquivo já existe: ${destination}`);
  process.exit(2);
}

mkdirSync(dirname(destination), { recursive: true });
writeFileSync(destination, `${randomBytes(32).toString("hex")}\n`, { mode: 0o600 });
console.log(`Chave criada em ${destination}`);
console.log("Guarde uma cópia offline. Sem essa chave, o backup não pode ser recuperado.");
