/**
 * Detecta tentativas de compartilhar contatos externos no chat
 * (telefone, WhatsApp, Telegram, e-mail, redes sociais, etc.) para evitar
 * que criadoras tirem clientes da plataforma.
 *
 * Estratégia: normalizar o texto (remover acentos, separadores comuns como
 * espaços, pontos, hífens, parênteses, e variações tipo "ponto", "arroba",
 * "(at)") e aplicar regex sobre o resultado.
 */

const APP_DOMAINS = [
  "venyx.app",
  "venyx.com",
  "venyx.com.br",
];

/** Substituições para driblar filtros simples. */
function normalize(input: string): string {
  let s = input.toLowerCase();
  // remover acentos
  s = s.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  // ofuscações comuns
  s = s
    .replace(/\s*\(\s*at\s*\)\s*/g, "@")
    .replace(/\s*\[\s*at\s*\]\s*/g, "@")
    .replace(/\s+arroba\s+/g, "@")
    .replace(/\s*\(\s*ponto\s*\)\s*/g, ".")
    .replace(/\s*\[\s*ponto\s*\]\s*/g, ".")
    .replace(/\s+ponto\s+/g, ".")
    .replace(/\s+dot\s+/g, ".");
  // remover separadores entre dígitos: "1 1 9 9 9 9 9 9 9 9 9" -> "11999999999"
  s = s.replace(/(\d)[\s.\-_·•]+(?=\d)/g, "$1");
  return s;
}

const PATTERNS: Array<{ id: string; label: string; re: RegExp }> = [
  // WhatsApp / Telegram / Signal explícitos
  { id: "whatsapp", label: "WhatsApp", re: /\b(whats?app|whatzap|wpp|zap|whats)\b/i },
  { id: "telegram", label: "Telegram", re: /\b(telegram|tele|tg)\b/i },
  { id: "telegram-handle", label: "Telegram (@user)", re: /(?:t\.me\/|telegram\.me\/)[a-z0-9_]{3,}/i },
  { id: "signal", label: "Signal", re: /\bsignal(?:\s*app)?\b/i },
  { id: "discord", label: "Discord", re: /\b(discord|disc)\b/i },
  { id: "snapchat", label: "Snapchat", re: /\b(snap(?:chat)?|snapc)\b/i },
  { id: "kik", label: "Kik", re: /\bkik\b/i },

  // Redes sociais externas
  { id: "instagram", label: "Instagram", re: /\b(instagram|insta|ig|instagran)\b|instagram\.com\/[a-z0-9_.]{2,}/i },
  { id: "tiktok", label: "TikTok", re: /\btiktok\b|tiktok\.com\/@?[a-z0-9_.]{2,}/i },
  { id: "twitter", label: "Twitter/X", re: /\b(twitter|x\.com)\b/i },
  { id: "facebook", label: "Facebook", re: /\b(facebook|face|fb\.com)\b/i },
  { id: "onlyfans", label: "Plataforma concorrente", re: /\b(onlyfans|privacy|fansly|justforfans|fanvue)\b/i },

  // Telefone (BR/internacional) — 10+ dígitos consecutivos após normalização
  { id: "phone", label: "Telefone", re: /(?:\+?\d{1,3})?\d{10,14}/ },

  // E-mail
  { id: "email", label: "E-mail", re: /[a-z0-9._%+\-]+@[a-z0-9.\-]+\.[a-z]{2,}/i },

  // URLs externas (não-app)
  { id: "url", label: "Link externo", re: /\b(?:https?:\/\/|www\.)[a-z0-9.\-]+\.[a-z]{2,}(?:\/[^\s]*)?/i },
];

export interface ContactDetection {
  blocked: boolean;
  matches: Array<{ id: string; label: string; sample: string }>;
}

export function detectExternalContact(text: string): ContactDetection {
  const norm = normalize(text);
  const matches: ContactDetection["matches"] = [];

  for (const p of PATTERNS) {
    const m = norm.match(p.re);
    if (!m) continue;
    const sample = m[0];

    // ignorar URLs do próprio app
    if (p.id === "url" && APP_DOMAINS.some((d) => sample.includes(d))) continue;
    // ignorar handle "@username" curtinho que não é e-mail nem link
    if (p.id === "phone" && sample.replace(/\D/g, "").length < 10) continue;

    matches.push({ id: p.id, label: p.label, sample });
  }

  return { blocked: matches.length > 0, matches };
}

/** Mensagem amigável para exibir ao usuário ao bloquear envio. */
export function contactBlockMessage(d: ContactDetection): string {
  if (!d.blocked) return "";
  const labels = Array.from(new Set(d.matches.map((m) => m.label))).join(", ");
  return `Mensagem bloqueada: detectamos compartilhamento de contato externo (${labels}). Para sua segurança e da plataforma, mantenha as conversas e pagamentos dentro do Venyx.`;
}
