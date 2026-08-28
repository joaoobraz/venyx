import test from "node:test";
import assert from "node:assert/strict";
import { localeFromBrowserLanguages } from "../src/lib/locale-detection.ts";

test("detects Brazilian Portuguese from the browser language list", () => {
  assert.equal(localeFromBrowserLanguages(["pt-BR", "en-US"]), "pt-BR");
});

test("supports Spanish and English browser languages", () => {
  assert.equal(localeFromBrowserLanguages(["es-ES", "en-US"]), "es");
  assert.equal(localeFromBrowserLanguages(["en-US"]), "en");
});

test("falls back to Portuguese for unknown browser languages", () => {
  assert.equal(localeFromBrowserLanguages(["fr-FR", "de-DE"]), "pt-BR");
});
