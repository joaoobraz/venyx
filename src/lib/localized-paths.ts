import type { Locale } from "./i18n";

const PATH_PAIRS = [
  ["/signup", "/cadastro"],
  ["/login", "/entrar"],
  ["/reset-password", "/recuperar-senha"],
  ["/feed", "/inicio"],
  ["/explore", "/explorar"],
  ["/notifications", "/notificacoes"],
  ["/search", "/buscar"],
  ["/chat", "/mensagens"],
  ["/wishlist", "/favoritos"],
  ["/loyalty", "/fidelidade"],
  ["/help", "/ajuda"],
  ["/terms", "/termos"],
  ["/privacy", "/privacidade"],
  ["/become-creator", "/seja-criadora"],
  ["/settings/profile", "/configuracoes/perfil"],
  ["/settings/payments", "/configuracoes/pagamentos"],
  ["/settings/security", "/configuracoes/seguranca"],
  ["/settings/privacy", "/configuracoes/privacidade"],
  ["/creator/posts", "/criadora/publicacoes"],
  ["/creator/media-library", "/criadora/acervo"],
  ["/creator/mailing", "/criadora/mensagens-em-massa"],
  ["/creator/subscription-plans", "/criadora/planos"],
  ["/creator/coupons", "/criadora/cupons"],
  ["/creator/gifts", "/criadora/mimos"],
  ["/creator/loyalty", "/criadora/fidelidade"],
  ["/creator/moderation", "/criadora/moderacao"],
  ["/creator/analytics", "/criadora/metricas"],
  ["/creator/wallet", "/criadora/carteira"],
  ["/creator/links", "/criadora/links"],
  ["/creator/affiliate", "/criadora/afiliados"],
  ["/creator/dmca", "/criadora/dmca"],
  ["/creator/onboarding", "/criadora/cadastro"],
  ["/creator/upsells", "/criadora/ofertas-adicionais"],
  ["/admin", "/administracao"],
  ["/admin/users", "/administracao/usuarios"],
  ["/admin/kyc", "/administracao/kyc"],
  ["/admin/moderation", "/administracao/moderacao"],
  ["/admin/operations", "/administracao/operacoes"],
  ["/admin/payouts", "/administracao/saques"],
  ["/admin/reconciliation", "/administracao/conciliacao"],
  ["/admin/reports", "/administracao/relatorios"],
  ["/admin/support", "/administracao/suporte"],
  ["/admin/audit", "/administracao/auditoria"],
  ["/admin/actions-audit", "/administracao/auditoria-acoes"],
  ["/admin/dmca", "/administracao/dmca"],
] as const;

const EN_TO_PT = new Map<string, string>(PATH_PAIRS);
const PT_TO_EN = new Map<string, string>(PATH_PAIRS.map(([en, pt]) => [pt, en]));

function translateDynamicPath(pathname: string, locale: Locale) {
  const pairs = [
    ["/profile/", "/perfil/"],
    ["/gifts/", "/mimos/"],
    ["/saved/", "/salvo/"],
  ] as const;

  for (const [en, pt] of pairs) {
    if (pathname.startsWith(en)) {
      return locale === "en" ? pathname : `${pt}${pathname.slice(en.length)}`;
    }
    if (pathname.startsWith(pt)) {
      return locale === "en" ? `${en}${pathname.slice(pt.length)}` : pathname;
    }
  }

  return pathname;
}

export function localizedPathname(pathname: string, locale: Locale) {
  const canonicalEnglishPath = PT_TO_EN.get(pathname) ?? pathname;
  const staticPath = locale === "en"
    ? canonicalEnglishPath
    : (EN_TO_PT.get(canonicalEnglishPath) ?? canonicalEnglishPath);

  return translateDynamicPath(staticPath, locale);
}
