import assert from "node:assert/strict";
import test from "node:test";
import { buildCaptionSuggestions } from "../src/lib/caption-suggestions.ts";

test("gera três legendas locais sem depender de serviço externo", () => {
  const captions = buildCaptionSuggestions({ mood: "flerte" });
  assert.equal(captions.length, 3);
  assert.ok(captions.every((caption) => caption.length > 20));
});

test("usa a ideia escrita pela modelo nas sugestões", () => {
  const captions = buildCaptionSuggestions({
    mood: "misterioso",
    hint: "Bastidores do ensaio de hoje",
  });
  assert.ok(captions.some((caption) => caption.includes("Bastidores do ensaio de hoje")));
});
