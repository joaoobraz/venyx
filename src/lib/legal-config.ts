const publicEnv = import.meta.env;

const publicValue = (name: string, fallback = "") => {
  const value = publicEnv[name] as string | undefined;
  return value?.trim() || fallback;
};

export const LEGAL_ENTITY = {
  name: publicValue("VITE_LEGAL_ENTITY_NAME", "Fanlira"),
  document: publicValue("VITE_LEGAL_ENTITY_DOCUMENT"),
  address: publicValue("VITE_LEGAL_ENTITY_ADDRESS"),
} as const;

export const LEGAL_CONTACTS = {
  support: publicValue("VITE_SUPPORT_EMAIL", "suporte@fanlira.com.br"),
  privacy: publicValue("VITE_PRIVACY_EMAIL", "privacidade@fanlira.com.br"),
  abuse: publicValue("VITE_ABUSE_EMAIL", "seguranca@fanlira.com.br"),
  dmca: publicValue("VITE_DMCA_EMAIL", "privacidade@fanlira.com.br"),
} as const;

export function legalEntityDescription() {
  return [LEGAL_ENTITY.name, LEGAL_ENTITY.document, LEGAL_ENTITY.address]
    .filter(Boolean)
    .join(" · ");
}

export function formatLegalVersion(version: string, locale: "pt" | "en") {
  const [year, month, day] = version.split("-").map(Number);
  return new Intl.DateTimeFormat(locale === "pt" ? "pt-BR" : "en-US", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(year, month - 1, day)));
}
