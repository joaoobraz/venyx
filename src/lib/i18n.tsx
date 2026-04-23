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

    "profile.subscribe": "Assinar por",
    "profile.subscribed": "Assinante",
    "profile.message": "Mensagem",
    "profile.tip": "Enviar mimo",
    "profile.posts": "Posts",
    "profile.media": "Mídia",
    "profile.about": "Sobre",
    "profile.followers": "Seguidores",
    "profile.following": "Seguindo",

    "chat.title": "Mensagens",
    "chat.search": "Buscar conversas",
    "chat.online": "Online",
    "chat.placeholder": "Digite uma mensagem...",
    "chat.send": "Enviar",
    "chat.empty": "Selecione uma conversa",

    "common.cancel": "Cancelar",
    "common.save": "Salvar",
    "common.loading": "Carregando...",
    "common.required": "Campo obrigatório",
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

    "profile.subscribe": "Subscribe for",
    "profile.subscribed": "Subscribed",
    "profile.message": "Message",
    "profile.tip": "Send tip",
    "profile.posts": "Posts",
    "profile.media": "Media",
    "profile.about": "About",
    "profile.followers": "Followers",
    "profile.following": "Following",

    "chat.title": "Messages",
    "chat.search": "Search conversations",
    "chat.online": "Online",
    "chat.placeholder": "Type a message...",
    "chat.send": "Send",
    "chat.empty": "Select a conversation",

    "common.cancel": "Cancel",
    "common.save": "Save",
    "common.loading": "Loading...",
    "common.required": "Required",
  },
};

interface I18nCtx {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string) => string;
}

const Ctx = createContext<I18nCtx | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>("pt-BR");

  useEffect(() => {
    const saved = typeof window !== "undefined" ? localStorage.getItem("locale") : null;
    if (saved === "pt-BR" || saved === "en") setLocaleState(saved);
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    if (typeof window !== "undefined") localStorage.setItem("locale", l);
  };

  const t = (key: string) => dictionaries[locale][key] ?? key;

  return <Ctx.Provider value={{ locale, setLocale, t }}>{children}</Ctx.Provider>;
}

export function useI18n() {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error("useI18n must be used inside I18nProvider");
  return ctx;
}
