import type { Locale } from "./i18n";

type LocalePathKey = "en" | "pt" | "es";

type LocalizedPath = Record<LocalePathKey, string>;

const LOCALE_TO_PATH_KEY: Record<Locale, LocalePathKey> = {
  "pt-BR": "pt",
  en: "en",
  es: "es",
};

const STATIC_PATHS: LocalizedPath[] = [
  { en: "/signup", pt: "/cadastro", es: "/registro" },
  { en: "/login", pt: "/entrar", es: "/entrar" },
  { en: "/reset-password", pt: "/recuperar-senha", es: "/recuperar-contrasena" },
  { en: "/feed", pt: "/inicio", es: "/inicio" },
  { en: "/explore", pt: "/explorar", es: "/explorar" },
  { en: "/notifications", pt: "/notificacoes", es: "/notificaciones" },
  { en: "/search", pt: "/buscar", es: "/buscar" },
  { en: "/chat", pt: "/mensagens", es: "/mensajes" },
  { en: "/wishlist", pt: "/favoritos", es: "/favoritos" },
  { en: "/loyalty", pt: "/fidelidade", es: "/fidelidad" },
  { en: "/help", pt: "/ajuda", es: "/ayuda" },
  { en: "/terms", pt: "/termos", es: "/terminos" },
  { en: "/privacy", pt: "/privacidade", es: "/privacidad" },
  { en: "/become-creator", pt: "/seja-criadora", es: "/ser-creadora" },
  { en: "/settings/profile", pt: "/configuracoes/perfil", es: "/configuracion/perfil" },
  { en: "/settings/payments", pt: "/configuracoes/pagamentos", es: "/configuracion/pagos" },
  { en: "/settings/security", pt: "/configuracoes/seguranca", es: "/configuracion/seguridad" },
  { en: "/settings/privacy", pt: "/configuracoes/privacidade", es: "/configuracion/privacidad" },
  { en: "/creator/posts", pt: "/criadora/publicacoes", es: "/creadora/publicaciones" },
  { en: "/creator/media-library", pt: "/criadora/acervo", es: "/creadora/biblioteca" },
  { en: "/creator/mailing", pt: "/criadora/mensagens-em-massa", es: "/creadora/mensajes-en-masa" },
  { en: "/creator/subscription-plans", pt: "/criadora/planos", es: "/creadora/planes" },
  { en: "/creator/coupons", pt: "/criadora/cupons", es: "/creadora/cupones" },
  { en: "/creator/gifts", pt: "/criadora/mimos", es: "/creadora/regalos" },
  { en: "/creator/loyalty", pt: "/criadora/fidelidade", es: "/creadora/fidelidad" },
  { en: "/creator/moderation", pt: "/criadora/moderacao", es: "/creadora/moderacion" },
  { en: "/creator/analytics", pt: "/criadora/metricas", es: "/creadora/metricas" },
  { en: "/creator/wallet", pt: "/criadora/carteira", es: "/creadora/cartera" },
  { en: "/creator/links", pt: "/criadora/links", es: "/creadora/enlaces" },
  { en: "/creator/affiliate", pt: "/criadora/afiliados", es: "/creadora/afiliados" },
  { en: "/creator/dmca", pt: "/criadora/dmca", es: "/creadora/dmca" },
  { en: "/creator/onboarding", pt: "/criadora/cadastro", es: "/creadora/registro" },
  { en: "/creator/upsells", pt: "/criadora/ofertas-adicionais", es: "/creadora/ofertas-adicionales" },
  { en: "/admin", pt: "/administracao", es: "/administracion" },
  { en: "/admin/users", pt: "/administracao/usuarios", es: "/administracion/usuarios" },
  { en: "/admin/kyc", pt: "/administracao/kyc", es: "/administracion/kyc" },
  { en: "/admin/moderation", pt: "/administracao/moderacao", es: "/administracion/moderacion" },
  { en: "/admin/operations", pt: "/administracao/operacoes", es: "/administracion/operaciones" },
  { en: "/admin/payouts", pt: "/administracao/saques", es: "/administracion/retiros" },
  { en: "/admin/reconciliation", pt: "/administracao/conciliacao", es: "/administracion/conciliacion" },
  { en: "/admin/reports", pt: "/administracao/relatorios", es: "/administracion/reportes" },
  { en: "/admin/support", pt: "/administracao/suporte", es: "/administracion/soporte" },
  { en: "/admin/audit", pt: "/administracao/auditoria", es: "/administracion/auditoria" },
  { en: "/admin/actions-audit", pt: "/administracao/auditoria-acoes", es: "/administracion/auditoria-acciones" },
  { en: "/admin/dmca", pt: "/administracao/dmca", es: "/administracion/dmca" },
];

const DYNAMIC_PATHS: LocalizedPath[] = [
  { en: "/profile/", pt: "/perfil/", es: "/perfil/" },
  { en: "/gifts/", pt: "/mimos/", es: "/regalos/" },
  { en: "/links/", pt: "/links/", es: "/enlaces/" },
  { en: "/saved/", pt: "/salvo/", es: "/guardado/" },
];

function canonicalStaticPath(pathname: string) {
  return STATIC_PATHS.find((path) => Object.values(path).includes(pathname))?.en ?? pathname;
}

function translateStaticPath(pathname: string, locale: Locale) {
  const canonicalEnglishPath = canonicalStaticPath(pathname);
  const config = STATIC_PATHS.find((path) => path.en === canonicalEnglishPath);
  return config?.[LOCALE_TO_PATH_KEY[locale]] ?? canonicalEnglishPath;
}

function translateDynamicPath(pathname: string, locale: Locale) {
  const targetKey = LOCALE_TO_PATH_KEY[locale];

  for (const path of DYNAMIC_PATHS) {
    for (const sourcePrefix of Object.values(path)) {
      if (pathname.startsWith(sourcePrefix)) {
        return `${path[targetKey]}${pathname.slice(sourcePrefix.length)}`;
      }
    }
  }

  return pathname;
}

export function localeFromPathname(pathname: string): Locale | null {
  for (const path of STATIC_PATHS) {
    const matches = (["en", "pt", "es"] as const).filter((key) => path[key] === pathname);
    if (matches.length === 1) {
      const [key] = matches;
      return key === "es" ? "es" : key === "pt" ? "pt-BR" : "en";
    }
  }

  for (const path of DYNAMIC_PATHS) {
    const matches = (["en", "pt", "es"] as const).filter((key) => pathname.startsWith(path[key]));
    if (matches.length === 1) {
      const [key] = matches;
      return key === "es" ? "es" : key === "pt" ? "pt-BR" : "en";
    }
  }

  return null;
}

export function localizedPathname(pathname: string, locale: Locale) {
  const staticPath = translateStaticPath(pathname, locale);
  return translateDynamicPath(staticPath, locale);
}
