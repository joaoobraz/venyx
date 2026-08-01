import { createContext, useContext, useEffect, useState, type ReactNode } from "react";

export type Locale = "pt-BR" | "en";

type Dict = Record<string, string>;

const dictionaries: Record<Locale, Dict> = {
  "pt-BR": {
    "nav.home": "Início",
    "nav.feed": "Feed",
    "nav.explore": "Explorar",
    "nav.search": "Buscar",
    "nav.chat": "Mensagens",
    "nav.notifications": "Notificações",
    "nav.profile": "Perfil",
    "nav.settings": "Configurações",
    "nav.wallet": "Carteira",
    "nav.login": "Entrar",
    "nav.signup": "Criar conta",
    "nav.logout": "Sair",
    "nav.mobile": "Navegação principal",
    "nav.menu": "Abrir menu",
    "nav.account": "Minha conta",
    "nav.wishlist": "Favoritos",
    "nav.loyalty": "Fidelidade",
    "nav.creatorArea": "Área da criadora",
    "nav.newPost": "Novo post",
    "nav.plans": "Planos",
    "nav.coupons": "Cupons",
    "nav.mailing": "Mensagens em massa",
    "nav.topFans": "Top fãs",
    "nav.linkTree": "Árvore de links",
    "nav.affiliate": "Afiliado",
    "nav.security": "Segurança",
    "nav.commentModeration": "Moderação de comentários",

    "landing.hero.badge": "Plataforma +18",
    "landing.hero.title": "Conteúdo exclusivo. Direto da criadora pra você.",
    "landing.hero.subtitle": "Assine, troque mensagens e desbloqueie conteúdos PPV das suas criadoras favoritas.",
    "landing.hero.cta": "Começar agora",
    "landing.hero.cta2": "Já tenho conta",

    "landing.features.title": "Tudo o que você precisa",
    "landing.features.subscribe.title": "Assinaturas mensais",
    "landing.features.subscribe.desc": "Acesse todo o conteúdo da sua criadora favorita por uma mensalidade.",
    "landing.features.ppv.title": "Conteúdo PPV",
    "landing.features.ppv.desc": "Compre conteúdos avulsos sem precisar assinar.",
    "landing.features.chat.title": "Chat privado",
    "landing.features.chat.desc": "Converse 1-a-1, envie mimos e desbloqueie mídias exclusivas.",
    "landing.features.creator.title": "Seja criadora",
    "landing.features.creator.desc": "Monetize seu conteúdo com segurança. Saques rápidos, suporte direto.",

    "age.title": "Conteúdo para maiores de 18 anos",
    "age.body": "Este site contém material adulto explícito. Ao continuar, você confirma que tem 18 anos ou mais e que aceita os termos de uso.",
    "age.confirm": "Sim, tenho 18+",
    "age.leave": "Sair",

    "auth.email": "E-mail",
    "auth.password": "Senha",
    "auth.signup.title": "Criar sua conta",
    "auth.signup.subtitle": "Acesse milhares de criadoras +18",
    "auth.signup.button": "Criar conta grátis",
    "auth.signup.haveAccount": "Já tem conta?",
    "auth.login.title": "Entrar",
    "auth.login.subtitle": "Bem-vindo de volta",
    "auth.login.button": "Entrar",
    "auth.login.noAccount": "Ainda não tem conta?",
    "auth.login.forgot": "Esqueci minha senha",
    "auth.google": "Continuar com Google",
    "auth.or": "ou",
    "auth.reset.title": "Recuperar senha",
    "auth.reset.send": "Enviar link",
    "auth.reset.new": "Nova senha",
    "auth.reset.update": "Atualizar senha",

    "becomeCreator.banner.title": "Torne-se Criadora",
    "becomeCreator.banner.subtitle": "Comece a ganhar dinheiro com seu conteúdo. Verificação rápida.",
    "becomeCreator.banner.cta": "Quero ser criadora",
    "becomeCreator.banner.pending": "Verificação em análise",
    "becomeCreator.title": "Vire criadora e monetize seu conteúdo",
    "becomeCreator.benefit1": "Receba mensalidades de assinantes",
    "becomeCreator.benefit2": "Venda conteúdos PPV avulsos",
    "becomeCreator.benefit3": "Receba mimos no chat",
    "becomeCreator.benefit4": "Saques rápidos e suporte humano",
    "becomeCreator.start": "Iniciar verificação",
    "becomeCreator.kyc.title": "Verificação de identidade",
    "becomeCreator.kyc.docType": "Tipo de documento",
    "becomeCreator.kyc.front": "Frente do documento",
    "becomeCreator.kyc.back": "Verso do documento",
    "becomeCreator.kyc.selfie": "Selfie segurando o documento",
    "becomeCreator.kyc.terms": "Confirmo ter 18+ e aceito os termos da plataforma.",
    "becomeCreator.kyc.submit": "Enviar verificação",
    "becomeCreator.kyc.success": "Verificação enviada! Avisaremos quando aprovada.",

    "feed.empty.title": "Seu feed está vazio",
    "feed.empty.cta": "Explorar criadoras",
    "feed.like": "Curtir",
    "feed.comment": "Comentar",
    "feed.tip": "Mimo",
    "feed.unlock": "Desbloquear por",
    "feed.subscribers": "Só para assinantes",

    "explore.trending": "Em alta",
    "explore.new": "Novas criadoras",
    "explore.categories": "Categorias",
    "explore.demoDisclosure": "Perfis fictícios, com imagens de adultas geradas por IA, usados apenas nesta demonstração.",

    "top.title": "Top 15 Criadoras",
    "top.refresh": "Ranking atualizado a cada 6 horas.",
    "top.empty.title": "As primeiras criadoras estão chegando",
    "top.empty.body": "O ranking aparecerá assim que houver perfis verificados e com plano ativo.",

    "profile.subscribe": "ASSINAR",
    "profile.subscribed": "Assinante",
    "profile.message": "Mensagem",
    "profile.tip": "Enviar mimo",
    "profile.posts": "Posts",
    "profile.media": "Mídia",
    "profile.about": "Sobre",
    "profile.followers": "Seguidores",
    "profile.following": "Seguindo",
    "profile.noBio": "Esta criadora ainda não adicionou uma bio.",
    "profile.noMedia": "Nenhuma mídia publicada ainda.",
    "profile.noPosts": "Nenhum post publicado ainda.",

    "chat.title": "Mensagens",
    "chat.search": "Buscar conversas",
    "chat.online": "Online",
    "chat.placeholder": "Digite uma mensagem...",
    "chat.send": "Enviar",
    "chat.empty": "Selecione uma conversa",
    "chat.noConversations": "Nenhuma conversa ainda.",
    "chat.activeSubscriber": "Assinante ativo",

    "safety.actions": "Ações de segurança",
    "safety.report": "Denunciar",
    "safety.block": "Bloquear",
    "safety.unblock": "Desbloquear",
    "safety.mute": "Silenciar",
    "safety.unmute": "Ativar notificações",
    "safety.reportTitle": "Enviar denúncia",
    "safety.reportDescription": "Nossa equipe analisará a denúncia.",
    "safety.reportAbout": "Denunciar",
    "safety.reason": "Motivo",
    "safety.reason.spam": "Spam ou fraude",
    "safety.reason.harassment": "Assédio ou ameaça",
    "safety.reason.impersonation": "Falsa identidade",
    "safety.reason.underage": "Possível menor de idade",
    "safety.reason.illegal": "Conteúdo ilegal",
    "safety.reason.other": "Outro",
    "safety.details": "Conte o que aconteceu (opcional)",
    "safety.submit": "Enviar denúncia",
    "safety.reported": "Denúncia enviada para análise.",
    "safety.blocked": "Perfil bloqueado.",
    "safety.unblocked": "Perfil desbloqueado.",
    "safety.muted": "Perfil silenciado.",
    "safety.unmuted": "Notificações reativadas.",
    "safety.error": "Não foi possível concluir. Tente novamente.",

    "common.cancel": "Cancelar",
    "common.save": "Salvar",
    "common.loading": "Carregando...",
    "common.required": "Campo obrigatório",
    "common.back": "Voltar",
  },
  en: {
    "nav.home": "Home",
    "nav.feed": "Feed",
    "nav.explore": "Explore",
    "nav.search": "Search",
    "nav.chat": "Messages",
    "nav.notifications": "Notifications",
    "nav.profile": "Profile",
    "nav.settings": "Settings",
    "nav.wallet": "Wallet",
    "nav.login": "Sign in",
    "nav.signup": "Sign up",
    "nav.logout": "Sign out",
    "nav.mobile": "Primary navigation",
    "nav.menu": "Open menu",
    "nav.account": "My account",
    "nav.wishlist": "Favorites",
    "nav.loyalty": "Loyalty",
    "nav.creatorArea": "Creator area",
    "nav.newPost": "New post",
    "nav.plans": "Plans",
    "nav.coupons": "Coupons",
    "nav.mailing": "Mass messages",
    "nav.topFans": "Top fans",
    "nav.linkTree": "Link tree",
    "nav.affiliate": "Affiliate",
    "nav.security": "Security",
    "nav.commentModeration": "Comment moderation",

    "landing.hero.badge": "Adult platform",
    "landing.hero.title": "Exclusive content. Straight from the creator.",
    "landing.hero.subtitle": "Subscribe, message and unlock PPV content from your favorite creators.",
    "landing.hero.cta": "Get started",
    "landing.hero.cta2": "I have an account",

    "landing.features.title": "Everything you need",
    "landing.features.subscribe.title": "Monthly subscriptions",
    "landing.features.subscribe.desc": "Access all your favorite creator's content with one monthly fee.",
    "landing.features.ppv.title": "PPV content",
    "landing.features.ppv.desc": "Buy individual posts without subscribing.",
    "landing.features.chat.title": "Private chat",
    "landing.features.chat.desc": "1-on-1 messages, tips and exclusive media unlocks.",
    "landing.features.creator.title": "Become a creator",
    "landing.features.creator.desc": "Monetize your content safely. Fast payouts, real support.",

    "age.title": "Adults only (18+)",
    "age.body": "This site contains explicit adult material. By continuing you confirm you are 18 or older and accept the terms.",
    "age.confirm": "Yes, I'm 18+",
    "age.leave": "Leave",

    "auth.email": "Email",
    "auth.password": "Password",
    "auth.signup.title": "Create your account",
    "auth.signup.subtitle": "Access thousands of 18+ creators",
    "auth.signup.button": "Sign up free",
    "auth.signup.haveAccount": "Already have an account?",
    "auth.login.title": "Sign in",
    "auth.login.subtitle": "Welcome back",
    "auth.login.button": "Sign in",
    "auth.login.noAccount": "No account yet?",
    "auth.login.forgot": "Forgot password",
    "auth.google": "Continue with Google",
    "auth.or": "or",
    "auth.reset.title": "Reset password",
    "auth.reset.send": "Send link",
    "auth.reset.new": "New password",
    "auth.reset.update": "Update password",

    "becomeCreator.banner.title": "Become a Creator",
    "becomeCreator.banner.subtitle": "Start earning from your content. Quick verification.",
    "becomeCreator.banner.cta": "I want to be a creator",
    "becomeCreator.banner.pending": "Verification under review",
    "becomeCreator.title": "Become a creator and monetize your content",
    "becomeCreator.benefit1": "Receive monthly subscriptions",
    "becomeCreator.benefit2": "Sell individual PPV content",
    "becomeCreator.benefit3": "Receive tips in chat",
    "becomeCreator.benefit4": "Fast payouts and human support",
    "becomeCreator.start": "Start verification",
    "becomeCreator.kyc.title": "Identity verification",
    "becomeCreator.kyc.docType": "Document type",
    "becomeCreator.kyc.front": "Document front",
    "becomeCreator.kyc.back": "Document back",
    "becomeCreator.kyc.selfie": "Selfie holding document",
    "becomeCreator.kyc.terms": "I confirm I'm 18+ and accept the platform terms.",
    "becomeCreator.kyc.submit": "Submit verification",
    "becomeCreator.kyc.success": "Verification submitted! We'll notify you when approved.",

    "feed.empty.title": "Your feed is empty",
    "feed.empty.cta": "Explore creators",
    "feed.like": "Like",
    "feed.comment": "Comment",
    "feed.tip": "Tip",
    "feed.unlock": "Unlock for",
    "feed.subscribers": "Subscribers only",

    "explore.trending": "Trending",
    "explore.new": "New creators",
    "explore.categories": "Categories",
    "explore.demoDisclosure": "Fictional profiles with AI-generated adult images, used only in this demo.",

    "top.title": "Top 15 Creators",
    "top.refresh": "Ranking refreshes every 6 hours.",
    "top.empty.title": "The first creators are on their way",
    "top.empty.body": "The ranking will appear once verified creators have active plans.",

    "profile.subscribe": "SUBSCRIBE",
    "profile.subscribed": "Subscribed",
    "profile.message": "Message",
    "profile.tip": "Send tip",
    "profile.posts": "Posts",
    "profile.media": "Media",
    "profile.about": "About",
    "profile.followers": "Followers",
    "profile.following": "Following",
    "profile.noBio": "This creator has not added a bio yet.",
    "profile.noMedia": "No media published yet.",
    "profile.noPosts": "No posts published yet.",

    "chat.title": "Messages",
    "chat.search": "Search conversations",
    "chat.online": "Online",
    "chat.placeholder": "Type a message...",
    "chat.send": "Send",
    "chat.empty": "Select a conversation",
    "chat.noConversations": "No conversations yet.",
    "chat.activeSubscriber": "Active subscriber",

    "safety.actions": "Safety actions",
    "safety.report": "Report",
    "safety.block": "Block",
    "safety.unblock": "Unblock",
    "safety.mute": "Mute",
    "safety.unmute": "Unmute",
    "safety.reportTitle": "Submit a report",
    "safety.reportDescription": "Our team will review this report.",
    "safety.reportAbout": "Report",
    "safety.reason": "Reason",
    "safety.reason.spam": "Spam or scam",
    "safety.reason.harassment": "Harassment or threat",
    "safety.reason.impersonation": "Impersonation",
    "safety.reason.underage": "Possible underage person",
    "safety.reason.illegal": "Illegal content",
    "safety.reason.other": "Other",
    "safety.details": "Tell us what happened (optional)",
    "safety.submit": "Submit report",
    "safety.reported": "Report submitted for review.",
    "safety.blocked": "Profile blocked.",
    "safety.unblocked": "Profile unblocked.",
    "safety.muted": "Profile muted.",
    "safety.unmuted": "Notifications restored.",
    "safety.error": "We couldn't complete that. Please try again.",

    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.loading": "Loading...",
    "common.required": "Required",
    "common.back": "Back",
  },
};

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
  tr: (pt: string, en: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt-BR");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("locale") : null;
    if (saved === "pt-BR" || saved === "en") setLocaleState(saved);
  }, []);

  useEffect(() => {
    if (typeof document !== "undefined") document.documentElement.lang = locale;
  }, [locale]);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("locale", l);
  };

  const t = (key: string) => dictionaries[locale][key] ?? key;
  const tr = (pt: string, en: string) => (locale === "en" ? en : pt);

  return <Ctx.Provider value={{ locale, setLocale, t, tr }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
