import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createCipheriv, createHash, randomBytes } from "node:crypto";
import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

const read = (path: string) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("legal documents cover the adult-platform launch rules", () => {
  const terms = read("src/routes/terms.tsx");
  const privacy = read("src/routes/privacy.tsx");
  const content = read("src/routes/content-policy.tsx");
  const normalizedTerms = terms.replace(/\s+/gu, " ");

  for (const requiredText of [
    "A simples autodeclaração não libera material adulto",
    "deepfake sexual",
    "Direitos obrigatórios do consumidor sempre prevalecem",
    "O primeiro saque da criadora em cada dia civil é gratuito",
    "R$ 30,00",
  ]) {
    assert.ok(normalizedTerms.includes(requiredText), `missing legal clause: ${requiredText}`);
  }
  assert.match(content, /possível vítima é protegida/u);
  assert.match(content, /Todo upload adulto pode ficar pendente e invisível/u);
  assert.match(privacy, /Resolução CD\/ANPD nº 19\/2024/u);
  assert.match(privacy, /três dias\s+úteis/u);
});

test("production release rejects missing legal operator identity", () => {
  const checker = read("scripts/check-production-env.mjs");
  assert.match(checker, /a identificação da operadora é obrigatória antes da abertura pública/u);
  assert.doesNotMatch(checker, /completar os dados empresariais na V1\.1/u);
});

test("production backup is encrypted and has a verified recovery path", () => {
  const backup = read("scripts/backup-production.mjs");
  const restore = read("scripts/decrypt-backup.mjs");
  assert.match(backup, /aes-256-gcm/u);
  assert.match(backup, /FANLIRA1/u);
  assert.match(backup, /\.plain/u);
  assert.match(restore, /decipher\.setAuthTag/u);
  assert.match(restore, /Hash inválido/u);
});

test("encrypted backup fixture decrypts and validates its manifest", () => {
  const root = mkdtempSync(join(tmpdir(), "fanlira-backup-test-"));
  try {
    const encryptedRoot = join(root, "encrypted");
    const outputRoot = join(root, "restored");
    const keyPath = join(root, "backup.key");
    const key = randomBytes(32);
    const schema = Buffer.from("select 'fanlira backup ok';\n");
    const manifest = Buffer.from(
      `${JSON.stringify({
        databaseFiles: [
          {
            filename: "schema.sql",
            bytes: schema.byteLength,
            sha256: createHash("sha256").update(schema).digest("hex"),
          },
        ],
        storageObjects: [],
      })}\n`,
    );

    mkdirSync(encryptedRoot, { recursive: true });
    writeFileSync(keyPath, `${key.toString("hex")}\n`);
    const encrypt = (value: Buffer) => {
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", key, iv);
      const ciphertext = Buffer.concat([cipher.update(value), cipher.final()]);
      return Buffer.concat([Buffer.from("FANLIRA1"), iv, cipher.getAuthTag(), ciphertext]);
    };
    writeFileSync(join(encryptedRoot, "schema.sql.enc"), encrypt(schema));
    writeFileSync(join(encryptedRoot, "manifest.json.enc"), encrypt(manifest));

    const result = spawnSync(
      process.execPath,
      [
        new URL("../scripts/decrypt-backup.mjs", import.meta.url).pathname.slice(1),
        `--input=${encryptedRoot}`,
        `--key-file=${keyPath}`,
        `--output=${outputRoot}`,
      ],
      { encoding: "utf8" },
    );
    assert.equal(result.status, 0, result.stderr || result.stdout);
    assert.equal(readFileSync(join(outputRoot, "schema.sql"), "utf8"), schema.toString("utf8"));
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
