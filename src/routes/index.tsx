import { useEffect, useState } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import {
  ArrowRight,
  BadgeCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Crown,
  Gift,
  Heart,
  LockKeyhole,
  MessageCircle,
  ShieldCheck,
  WalletCards,
} from "lucide-react";
import { Header } from "@/components/Header";
import { TopCreators } from "@/components/TopCreators";
import { Button } from "@/components/ui/button";
import { DEMO_CREATORS, DEMO_MODE, type DemoCreator } from "@/lib/demo-creators";
import { useI18n } from "@/lib/i18n";
import { localizedPathname } from "@/lib/localized-paths";

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): { version?: "v1" | "v1.1" | "v2" | "v3" } =>
    search.version === "v1" || search.version === "v1.1" || search.version === "v2" || search.version === "v3"
      ? { version: search.version }
      : {},
  component: Landing,
});

const HERO_CREATORS = DEMO_CREATORS.slice(0, 3);
const FEATURED_CREATORS = DEMO_CREATORS.slice(0, 4);
const V2_CREATORS = DEMO_CREATORS.slice(0, 8);

function formatPrice(cents: number, locale: "pt-BR" | "en" | "es") {
  return new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

function CreatorPortrait({
  creator,
  className,
}: {
  creator: DemoCreator;
  className?: string;
}) {
  return (
    <img
      src={creator.avatar_url}
      alt={`Foto de ${creator.display_name}`}
      className={className}
      loading="eager"
    />
  );
}

function LandingHeroV2() {
  const { locale, tr } = useI18n();
  const routeTo = (pathname: string) => localizedPathname(pathname, locale) as never;
  const [activeIndex, setActiveIndex] = useState(0);
  const visibleCreators = [0, 1, 2].map(
    (offset) => V2_CREATORS[(activeIndex + offset) % V2_CREATORS.length],
  );
  const activeCreator = visibleCreators[0];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % V2_CREATORS.length);
    }, 5500);

    return () => window.clearInterval(timer);
  }, []);

  const selectPrevious = () => {
    setActiveIndex((current) => (current - 1 + V2_CREATORS.length) % V2_CREATORS.length);
  };

  const selectNext = () => {
    setActiveIndex((current) => (current + 1) % V2_CREATORS.length);
  };

  return (
    <section className="relative isolate min-h-[calc(100vh-4rem)] overflow-hidden border-b border-white/10 bg-[#12090e] text-white">
      <div className="absolute inset-y-0 right-0 w-full lg:w-[74%]" aria-hidden="true">
        <div className="grid h-full grid-cols-1 gap-1 sm:grid-cols-[1.45fr_0.8fr] lg:grid-cols-[1.45fr_0.78fr_0.78fr]">
          {visibleCreators.map((creator, index) => (
            <div
              key={`${creator.username}-${activeIndex}-${index}`}
              className={`${index > 0 ? "hidden sm:block" : "block"} ${index === 2 ? "sm:hidden lg:block" : ""} relative min-h-[46rem] overflow-hidden animate-in fade-in duration-700`}
            >
              <CreatorPortrait
                creator={creator}
                className={`h-full w-full object-cover ${index === 0 ? "object-center" : "object-[center_28%]"}`}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-[#12090e]/85 via-transparent to-black/20" />
              {index > 0 && <div className="absolute inset-0 bg-[#12090e]/20" />}
            </div>
          ))}
        </div>
      </div>

      <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(90deg,#12090e_0%,#12090e_27%,rgba(18,9,14,0.92)_39%,rgba(18,9,14,0.42)_61%,rgba(18,9,14,0.08)_100%)]" />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-[#12090e] via-transparent to-[#12090e]/35" />

      <div className="relative z-10 mx-auto flex min-h-[calc(100vh-4rem)] max-w-7xl flex-col justify-center px-5 py-16 sm:px-8 lg:py-20">
        <div className="max-w-2xl landing-rise lg:max-w-[42rem]">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/15 bg-black/20 px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-xl sm:text-xs">
            <Heart className="h-3.5 w-3.5" />
            {tr("Conexões exclusivas começam aqui", "Exclusive connections start here")}
          </div>

          <h1 className="font-display text-[3.4rem] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-7xl lg:text-[4.75rem] 2xl:text-[5.35rem]">
            {tr("Mais perto.", "Closer.")}
            <span className="block text-primary">{tr("Mais exclusivo.", "More exclusive.")}</span>
            <span className="block italic">{tr("Mais Fanlira.", "More Fanlira.")}</span>
          </h1>

          <p className="mt-7 max-w-xl text-base leading-7 text-white/65 sm:text-lg sm:leading-8">
            {tr(
              "Acompanhe, converse e viva experiências únicas com suas criadoras favoritas — cada conexão do seu jeito.",
              "Follow, chat and enjoy unique experiences with your favorite creators — every connection, your way.",
            )}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to={routeTo("/signup")}>
              <Button
                size="lg"
                className="group h-13 w-full rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-[0_18px_55px_-20px_rgba(231,177,181,0.9)] hover:bg-primary/90 sm:w-auto"
              >
                {tr("Criar minha conta", "Create my account")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to={routeTo("/explore")}>
              <Button
                size="lg"
                variant="outline"
                className="h-13 w-full rounded-full border-white/20 bg-black/20 px-7 text-sm text-white backdrop-blur-xl hover:border-primary/50 hover:bg-black/35 hover:text-white sm:w-auto"
              >
                {tr("Explorar criadoras", "Explore creators")}
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/55">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {tr("Perfis verificados", "Verified profiles")}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-white/25 sm:block" />
            <span className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              {tr("Privacidade em primeiro lugar", "Privacy comes first")}
            </span>
            <span className="rounded-full border border-white/15 px-2.5 py-1 text-[10px] font-bold tracking-wider">18+</span>
          </div>
        </div>

        <div className="mt-12 flex max-w-2xl items-center gap-3 lg:mt-14">
          <button
            type="button"
            onClick={selectPrevious}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur-xl transition-colors hover:border-primary/50 hover:bg-black/45"
            aria-label={tr("Criadora anterior", "Previous creator")}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>

          <div className="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
            {V2_CREATORS.map((creator, index) => (
              <button
                key={creator.username}
                type="button"
                onClick={() => setActiveIndex(index)}
                className={`relative h-11 w-11 shrink-0 overflow-hidden rounded-full border-2 transition-all duration-300 sm:h-12 sm:w-12 ${
                  index === activeIndex
                    ? "scale-105 border-primary shadow-[0_0_0_4px_rgba(222,170,175,0.16)]"
                    : "border-white/20 opacity-55 hover:opacity-100"
                }`}
                aria-label={`${tr("Mostrar", "Show")} ${creator.display_name}`}
                aria-pressed={index === activeIndex}
              >
                <CreatorPortrait creator={creator} className="h-full w-full object-cover" />
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={selectNext}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border border-white/15 bg-black/25 text-white backdrop-blur-xl transition-colors hover:border-primary/50 hover:bg-black/45"
            aria-label={tr("Próxima criadora", "Next creator")}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex items-center gap-3" aria-live="polite">
          <div>
            <p className="flex items-center gap-1.5 font-display text-xl font-semibold">
              {activeCreator.display_name}
              <BadgeCheck className="h-4 w-4 fill-primary text-[#12090e]" />
            </p>
            <p className="mt-0.5 text-xs text-white/50">
              @{activeCreator.username} · {locale === "en" ? activeCreator.category_en : activeCreator.category} · {formatPrice(activeCreator.subscription_price_cents, locale)}/{tr("mês", "mo")}
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingHeroV3() {
  const { locale, tr } = useI18n();
  const routeTo = (pathname: string) => localizedPathname(pathname, locale) as never;
  const [activeIndex, setActiveIndex] = useState(0);
  const activeCreator = V2_CREATORS[activeIndex];
  const previousCreator =
    V2_CREATORS[(activeIndex - 1 + V2_CREATORS.length) % V2_CREATORS.length];
  const nextCreator = V2_CREATORS[(activeIndex + 1) % V2_CREATORS.length];

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveIndex((current) => (current + 1) % V2_CREATORS.length);
    }, 6500);

    return () => window.clearInterval(timer);
  }, []);

  const selectPrevious = () => {
    setActiveIndex((current) => (current - 1 + V2_CREATORS.length) % V2_CREATORS.length);
  };

  const selectNext = () => {
    setActiveIndex((current) => (current + 1) % V2_CREATORS.length);
  };

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#160d12] text-white">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[44%] border-l border-white/[0.04] bg-[#1b1016] lg:block" />
      <div className="pointer-events-none absolute bottom-8 right-8 hidden font-display text-[9rem] font-semibold italic leading-none text-white/[0.018] lg:block">
        Fanlira
      </div>

      <div className="relative mx-auto grid min-h-[42rem] max-w-7xl items-center gap-10 px-5 py-14 sm:px-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-6 lg:py-12">
        <div className="relative z-10 max-w-2xl landing-rise">
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/[0.035] px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.2em] text-primary sm:text-[11px]">
            <Heart className="h-3.5 w-3.5" />
            {tr("Escolha quem você quer por perto", "Choose who you want closer")}
          </div>

          <h1 className="font-display text-[3.25rem] font-semibold leading-[0.97] tracking-[-0.05em] sm:text-7xl lg:text-[4.45rem]">
            {tr("Mais perto.", "Closer.")}
            <span className="block text-primary">{tr("Mais exclusivo.", "More exclusive.")}</span>
            <span className="block italic">{tr("Mais Fanlira.", "More Fanlira.")}</span>
          </h1>

          <p className="mt-6 max-w-xl text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
            {tr(
              "Descubra criadoras, acompanhe conteúdos exclusivos e construa conexões no seu ritmo.",
              "Discover creators, follow exclusive content and build connections at your own pace.",
            )}
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row">
            <Link to={routeTo("/signup")}>
              <Button
                size="lg"
                className="group h-13 w-full rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto"
              >
                {tr("Criar minha conta", "Create my account")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to={routeTo("/explore")}>
              <Button
                size="lg"
                variant="outline"
                className="h-13 w-full rounded-full border-white/15 bg-transparent px-7 text-sm text-white hover:border-primary/40 hover:bg-white/[0.04] hover:text-white sm:w-auto"
              >
                {tr("Explorar criadoras", "Explore creators")}
              </Button>
            </Link>
          </div>

          <div className="mt-8 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-white/45">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-4 w-4 text-primary" />
              {tr("Perfis verificados", "Verified profiles")}
            </span>
            <span className="hidden h-1 w-1 rounded-full bg-white/20 sm:block" />
            <span className="flex items-center gap-2">
              <LockKeyhole className="h-4 w-4 text-primary" />
              {tr("Privacidade em primeiro lugar", "Privacy comes first")}
            </span>
            <span className="rounded-full border border-white/12 px-2.5 py-1 text-[10px] font-bold tracking-wider">18+</span>
          </div>
        </div>

        <div className="relative mx-auto h-[29rem] w-full max-w-[31rem] sm:h-[33rem] landing-rise-delayed">
          <button
            type="button"
            onClick={selectPrevious}
            className="group absolute left-0 top-[12%] z-0 h-[70%] w-[43%] -rotate-3 overflow-hidden rounded-[1.75rem] border border-white/10 opacity-40 transition-all duration-500 hover:opacity-65"
            aria-label={`${tr("Mostrar", "Show")} ${previousCreator.display_name}`}
          >
            <CreatorPortrait
              creator={previousCreator}
              className="h-full w-full object-cover grayscale-[25%] transition-transform duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-[#160d12]/20" />
          </button>

          <button
            type="button"
            onClick={selectNext}
            className="group absolute right-0 top-[12%] z-0 h-[70%] w-[43%] rotate-3 overflow-hidden rounded-[1.75rem] border border-white/10 opacity-40 transition-all duration-500 hover:opacity-65"
            aria-label={`${tr("Mostrar", "Show")} ${nextCreator.display_name}`}
          >
            <CreatorPortrait
              creator={nextCreator}
              className="h-full w-full object-cover grayscale-[25%] transition-transform duration-700 group-hover:scale-105"
            />
            <span className="absolute inset-0 bg-[#160d12]/20" />
          </button>

          <div
            key={`${activeCreator.username}-${activeIndex}`}
            className="absolute left-1/2 top-0 z-10 h-[86%] w-[58%] -translate-x-1/2 overflow-hidden rounded-[2rem] border border-white/15 bg-[#211218] shadow-[0_28px_80px_-32px_rgba(0,0,0,0.9)] animate-in fade-in duration-500"
          >
            <CreatorPortrait creator={activeCreator} className="h-full w-full object-cover" />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12090e] via-transparent to-black/15" />
            <div className="absolute left-4 right-4 top-4 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.12em] backdrop-blur-lg">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                {activeCreator.status === "online" ? tr("Online", "Online") : tr("Ativa hoje", "Active today")}
              </span>
              <span className="text-[10px] font-semibold text-white/55">
                {String(activeIndex + 1).padStart(2, "0")} / {String(V2_CREATORS.length).padStart(2, "0")}
              </span>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-5">
              <p className="flex items-center gap-1.5 font-display text-2xl font-semibold">
                {activeCreator.display_name}
                <BadgeCheck className="h-4 w-4 fill-primary text-[#12090e]" />
              </p>
              <div className="mt-1.5 flex items-center justify-between gap-2 text-[10px] text-white/55">
                <span>@{activeCreator.username} · {locale === "en" ? activeCreator.category_en : activeCreator.category}</span>
                <span>{formatPrice(activeCreator.subscription_price_cents, locale)}/{tr("mês", "mo")}</span>
              </div>
            </div>
          </div>

          <div className="absolute bottom-[5%] left-1/2 z-20 flex -translate-x-1/2 items-center gap-3 rounded-full border border-white/10 bg-[#160d12]/90 px-3 py-2 shadow-xl backdrop-blur-xl">
            <button
              type="button"
              onClick={selectPrevious}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label={tr("Criadora anterior", "Previous creator")}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <div className="flex gap-1.5">
              {V2_CREATORS.map((creator, index) => (
                <button
                  key={creator.username}
                  type="button"
                  onClick={() => setActiveIndex(index)}
                  className={`h-1.5 rounded-full transition-all duration-300 ${
                    index === activeIndex ? "w-5 bg-primary" : "w-1.5 bg-white/25 hover:bg-white/50"
                  }`}
                  aria-label={`${tr("Mostrar", "Show")} ${creator.display_name}`}
                  aria-pressed={index === activeIndex}
                />
              ))}
            </div>
            <button
              type="button"
              onClick={selectNext}
              className="flex h-8 w-8 items-center justify-center rounded-full text-white/65 transition-colors hover:bg-white/[0.06] hover:text-white"
              aria-label={tr("Próxima criadora", "Next creator")}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}

function LandingHeroV11() {
  const { locale, tr } = useI18n();
  const routeTo = (pathname: string) => localizedPathname(pathname, locale) as never;
  const creator = HERO_CREATORS[0];

  return (
    <section className="relative isolate overflow-hidden border-b border-white/10 bg-[#140c10] text-white">
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[34%] bg-[#1a0f14] lg:block" />
      <div className="pointer-events-none absolute inset-y-0 right-[34%] hidden w-px bg-white/[0.045] lg:block" />

      <div className="relative mx-auto grid min-h-[37rem] max-w-7xl items-center gap-12 px-5 py-14 sm:px-8 lg:grid-cols-[1.08fr_0.92fr] lg:gap-10 lg:py-12">
        <div className="relative z-10 max-w-2xl landing-rise">
          <div className="mb-7 flex items-center gap-4">
            <span className="h-px w-10 bg-primary/70" />
            <p className="text-[10px] font-bold uppercase tracking-[0.24em] text-primary sm:text-[11px]">
              {tr("Experiências escolhidas por você", "Experiences chosen by you")}
            </p>
          </div>

          <h1 className="font-display text-[3.25rem] font-semibold leading-[0.96] tracking-[-0.05em] sm:text-7xl lg:text-[4.6rem]">
            {tr("Mais perto.", "Closer.")}
            <span className="block text-primary">{tr("Mais exclusivo.", "More exclusive.")}</span>
            <span className="block italic">{tr("Mais Fanlira.", "More Fanlira.")}</span>
          </h1>

          <p className="mt-7 max-w-[35rem] text-base leading-7 text-white/58 sm:text-lg sm:leading-8">
            {tr(
              "Conteúdos, conversas e experiências exclusivas com quem você escolhe acompanhar de verdade.",
              "Exclusive content, conversations and experiences with the creators you truly choose to follow.",
            )}
          </p>

          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link to={routeTo("/signup")}>
              <Button
                size="lg"
                className="group h-13 w-full rounded-xl bg-primary px-7 text-sm font-bold text-primary-foreground transition-transform hover:-translate-y-0.5 hover:bg-primary/90 sm:w-auto"
              >
                {tr("Criar minha conta", "Create my account")}
                <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Button>
            </Link>
            <Link to={routeTo("/explore")}>
              <Button
                size="lg"
                variant="outline"
                className="h-13 w-full rounded-xl border-white/15 bg-transparent px-7 text-sm text-white hover:border-primary/45 hover:bg-white/[0.035] hover:text-white sm:w-auto"
              >
                {tr("Conhecer criadoras", "Discover creators")}
              </Button>
            </Link>
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-x-6 gap-y-3 text-[11px] text-white/43">
            <span className="flex items-center gap-2">
              <ShieldCheck className="h-3.5 w-3.5 text-primary" />
              {tr("Perfis verificados", "Verified profiles")}
            </span>
            <span className="flex items-center gap-2">
              <LockKeyhole className="h-3.5 w-3.5 text-primary" />
              {tr("Privacidade e controle", "Privacy and control")}
            </span>
            <span className="font-bold tracking-[0.16em] text-white/55">18+</span>
          </div>
        </div>

        <div className="relative mx-auto h-[31rem] w-full max-w-[31rem] landing-rise-delayed sm:h-[34rem]">
          <div className="absolute left-[5%] top-[5%] h-[86%] w-[76%] -rotate-3 rounded-[2.25rem] border border-primary/18 bg-primary/[0.045]" />
          <div className="absolute bottom-[1%] right-[1%] h-[78%] w-[72%] rotate-[4deg] rounded-[2.25rem] border border-white/[0.09] bg-white/[0.018]" />

          <div className="absolute inset-x-[8%] inset-y-[2%] overflow-hidden rounded-[2rem] border border-white/12 bg-[#211319] shadow-[0_36px_90px_-38px_rgba(0,0,0,0.95)]">
            <CreatorPortrait
              creator={creator}
              className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.02]"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#12090e] via-[#12090e]/5 to-black/5" />

            <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/25 px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.14em] backdrop-blur-md">
                <span className={`h-1.5 w-1.5 rounded-full ${DEMO_MODE ? "bg-emerald-400" : "bg-primary"}`} />
                {DEMO_MODE ? tr("Online agora", "Online now") : tr("Prévia ilustrativa", "Illustrative preview")}
              </span>
              <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/15 bg-black/20 backdrop-blur-md">
                <Heart className="h-4 w-4" />
              </span>
            </div>

            <div className="absolute bottom-0 left-0 right-0 p-6">
              <div className="flex items-center gap-2">
                <h2 className="font-display text-3xl font-semibold">{creator.display_name}</h2>
                <BadgeCheck className="h-4 w-4 fill-primary text-[#12090e]" />
              </div>
              <p className="mt-1 text-[11px] text-white/55">
                @{creator.username} · {locale === "en" ? creator.category_en : creator.category}
              </p>
              <div className="mt-4 flex items-center justify-between border-t border-white/15 pt-3">
                <div>
                  <p className="text-[9px] uppercase tracking-[0.18em] text-white/38">{tr("Assinatura", "Subscription")}</p>
                  <p className="mt-1 text-sm font-bold">
                    {formatPrice(creator.subscription_price_cents, locale)}
                    <span className="font-normal text-white/45">/{tr("mês", "month")}</span>
                  </p>
                </div>
                <Link
                  to={DEMO_MODE ? routeTo("/profile/$username") : routeTo("/explore")}
                  params={DEMO_MODE ? ({ username: creator.username } as never) : undefined}
                  className="rounded-full bg-primary px-4 py-2 text-[10px] font-bold text-primary-foreground transition-colors hover:bg-primary/90"
                >
                  {DEMO_MODE ? tr("Ver perfil", "View profile") : tr("Ver criadoras", "See creators")}
                </Link>
              </div>
            </div>
          </div>

          <div className="landing-float absolute -left-1 top-[18%] z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#211217]/95 p-3 pr-5 shadow-2xl backdrop-blur-xl sm:-left-5">
            <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
              <Gift className="h-4 w-4" />
            </span>
            <div>
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/38">{tr("Mimo enviado", "Gift sent")}</p>
              <p className="mt-1 text-[11px] font-bold">{tr("Uma conexão especial", "A special connection")}</p>
            </div>
          </div>

          <div className="landing-float-slow absolute -right-1 bottom-[18%] z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#211217]/95 p-3 pr-4 shadow-2xl backdrop-blur-xl sm:-right-5">
            <div className="relative">
              <CreatorPortrait creator={HERO_CREATORS[1]} className="h-10 w-10 rounded-xl object-cover" />
              <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                <LockKeyhole className="h-2.5 w-2.5" />
              </span>
            </div>
            <div>
              <p className="text-[9px] uppercase tracking-[0.12em] text-white/38">PPV</p>
              <p className="mt-1 text-[11px] font-bold">{tr("Conteúdo desbloqueado", "Content unlocked")}</p>
            </div>
          </div>

          <div className="absolute -bottom-1 left-[9%] z-20 flex items-center rounded-full border border-white/10 bg-[#160d12]/95 px-3 py-2 shadow-xl backdrop-blur-xl">
            <div className="flex -space-x-2">
              {HERO_CREATORS.map((showcaseCreator) => (
                <CreatorPortrait
                  key={showcaseCreator.username}
                  creator={showcaseCreator}
                  className="h-7 w-7 rounded-full border-2 border-[#160d12] object-cover"
                />
              ))}
            </div>
            <p className="ml-3 pr-1 text-[9px] font-semibold text-white/60">{tr("Experiências únicas", "Unique experiences")}</p>
          </div>
        </div>
      </div>

      <div className="relative mx-auto max-w-7xl border-t border-white/[0.07] px-5 sm:px-8">
        <div className="grid py-5 sm:grid-cols-3 sm:py-0">
          {[
            ["01", tr("Assine quem você escolher", "Subscribe to who you choose")],
            ["02", tr("Converse com privacidade", "Chat with privacy")],
            ["03", tr("Desbloqueie no seu ritmo", "Unlock at your pace")],
          ].map(([number, label], index) => (
            <div
              key={number}
              className={`flex items-center gap-4 py-3 sm:px-6 sm:py-5 ${index > 0 ? "border-t border-white/[0.07] sm:border-l sm:border-t-0" : "sm:pl-0"}`}
            >
              <span className="font-display text-lg italic text-primary/70">{number}</span>
              <span className="text-[11px] font-semibold uppercase tracking-[0.12em] text-white/48">{label}</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Landing() {
  const { locale, t, tr } = useI18n();
  const routeTo = (pathname: string) => localizedPathname(pathname, locale) as never;
  const { version } = Route.useSearch();
  const activeVersion = version === "v2" || version === "v3" ? version : "v1.1";

  const experiences = [
    {
      icon: Heart,
      eyebrow: tr("01 · Descubra", "01 · Discover"),
      title: tr("Encontre quem combina com você", "Find creators who match your vibe"),
      description: tr(
        "Explore perfis verificados, acompanhe novidades e assine somente quem você realmente quer ver de perto.",
        "Explore verified profiles, follow updates and subscribe only to the creators you truly want closer.",
      ),
    },
    {
      icon: MessageCircle,
      eyebrow: tr("02 · Conecte-se", "02 · Connect"),
      title: tr("Uma conversa que é só de vocês", "A conversation that belongs to you"),
      description: tr(
        "Chat privado, mimos e conteúdo PPV em uma experiência direta, discreta e feita para aproximar.",
        "Private chat, gifts and PPV content in a direct, discreet experience designed to bring you closer.",
      ),
    },
    {
      icon: Crown,
      eyebrow: tr("03 · Viva a experiência", "03 · Enjoy the experience"),
      title: tr("Exclusividade que reconhece você", "Exclusivity that recognizes you"),
      description: tr(
        "Evolua na fidelidade, desbloqueie benefícios e tenha acesso ao que não aparece em nenhum outro lugar.",
        "Level up your loyalty, unlock benefits and access what does not appear anywhere else.",
      ),
    },
  ];

  return (
    <div className="min-h-screen overflow-hidden bg-background text-foreground">
      <Header />

      <main>
        {activeVersion === "v2" ? (
          <LandingHeroV2 />
        ) : activeVersion === "v3" ? (
          <LandingHeroV3 />
        ) : activeVersion === "v1.1" ? (
          <LandingHeroV11 />
        ) : (
          <section className="relative isolate border-b border-border/40">
          <div className="landing-grid pointer-events-none absolute inset-0 opacity-40" />
          <div className="pointer-events-none absolute -left-32 top-10 h-[32rem] w-[32rem] rounded-full bg-primary/15 blur-[110px]" />
          <div className="pointer-events-none absolute -right-40 bottom-0 h-[36rem] w-[36rem] rounded-full bg-accent/10 blur-[120px]" />

          <div className="relative mx-auto grid min-h-[calc(100vh-4rem)] max-w-7xl items-center gap-14 px-5 py-14 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-8 lg:py-16">
            <div className="relative z-10 max-w-2xl landing-rise">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-primary/25 bg-primary/[0.08] px-4 py-2 text-[11px] font-semibold uppercase tracking-[0.18em] text-primary backdrop-blur-xl sm:text-xs">
                <Heart className="h-3.5 w-3.5" />
                {tr("Conexões exclusivas começam aqui", "Exclusive connections start here")}
              </div>

              <h1 className="font-display text-[3.4rem] font-semibold leading-[0.96] tracking-[-0.055em] sm:text-7xl lg:text-[4.55rem] 2xl:text-[5.25rem]">
                {tr("Mais perto.", "Closer.")}
                <span className="block text-primary">{tr("Mais exclusivo.", "More exclusive.")}</span>
                <span className="block italic">{tr("Mais Fanlira.", "More Fanlira.")}</span>
              </h1>

              <p className="mt-7 max-w-xl text-base leading-7 text-muted-foreground sm:text-lg sm:leading-8">
                {tr(
                  "Um espaço para acompanhar, conversar e viver experiências únicas com suas criadoras favoritas — do seu jeito e no seu tempo.",
                  "A space to follow, chat and enjoy unique experiences with your favorite creators — your way, at your pace.",
                )}
              </p>

              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link to={routeTo("/signup")}>
                  <Button
                    size="lg"
                    className="group h-13 w-full rounded-full bg-primary px-7 text-sm font-bold text-primary-foreground shadow-[0_16px_50px_-18px_color-mix(in_oklab,var(--primary)_70%,transparent)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-primary/90 sm:w-auto"
                  >
                    {tr("Criar minha conta", "Create my account")}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
                <Link to={routeTo("/explore")}>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-13 w-full rounded-full border-border/80 bg-card/30 px-7 text-sm backdrop-blur-xl hover:border-primary/40 hover:bg-card/70 sm:w-auto"
                  >
                    {tr("Explorar criadoras", "Explore creators")}
                  </Button>
                </Link>
              </div>

              <div className="mt-9 flex flex-wrap items-center gap-x-5 gap-y-3 text-xs text-muted-foreground">
                <span className="flex items-center gap-2">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  {tr("Perfis verificados", "Verified profiles")}
                </span>
                <span className="hidden h-1 w-1 rounded-full bg-border sm:block" />
                <span className="flex items-center gap-2">
                  <LockKeyhole className="h-4 w-4 text-primary" />
                  {tr("Privacidade em primeiro lugar", "Privacy comes first")}
                </span>
                <span className="rounded-full border border-border/70 px-2.5 py-1 text-[10px] font-bold tracking-wider">
                  18+
                </span>
              </div>
            </div>

            <div className="relative mx-auto h-[31rem] w-full max-w-[34rem] sm:h-[39rem] lg:ml-auto landing-rise-delayed">
              <div className="absolute left-[5%] top-[5%] h-[86%] w-[76%] rotate-[-3deg] rounded-[2.5rem] border border-primary/15 bg-primary/[0.07]" />
              <div className="absolute bottom-[2%] right-[1%] h-[78%] w-[70%] rotate-[5deg] rounded-[2.5rem] border border-border/60 bg-card/30 backdrop-blur-sm" />

              <div className="absolute inset-x-[8%] inset-y-[3%] overflow-hidden rounded-[2.25rem] border border-white/10 bg-card shadow-[0_40px_100px_-36px_rgba(0,0,0,0.75)]">
                <CreatorPortrait
                  creator={HERO_CREATORS[0]}
                  className="h-full w-full object-cover transition-transform duration-700 hover:scale-[1.025]"
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#160b10] via-[#160b10]/10 to-transparent" />
                <div className="absolute left-5 right-5 top-5 flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-black/25 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-white backdrop-blur-lg">
                    <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_10px_rgba(52,211,153,0.9)]" />
                    {tr("Online agora", "Online now")}
                  </span>
                  <span className="flex h-9 w-9 items-center justify-center rounded-full border border-white/20 bg-black/25 text-white backdrop-blur-lg">
                    <Heart className="h-4 w-4" />
                  </span>
                </div>
                <div className="absolute bottom-0 left-0 right-0 p-6 text-white sm:p-8">
                  <div className="mb-2 flex items-center gap-2">
                    <h2 className="font-display text-3xl font-semibold">{HERO_CREATORS[0].display_name}</h2>
                    <BadgeCheck className="h-5 w-5 fill-primary text-[#231117]" />
                  </div>
                  <p className="text-sm text-white/65">@{HERO_CREATORS[0].username} · {HERO_CREATORS[0].category}</p>
                  <div className="mt-5 flex items-center justify-between border-t border-white/15 pt-4">
                    <div>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/50">
                        {tr("Assinatura", "Subscription")}
                      </p>
                      <p className="mt-1 text-sm font-bold">
                        {formatPrice(HERO_CREATORS[0].subscription_price_cents, locale)}
                        <span className="font-normal text-white/55">/{tr("mês", "month")}</span>
                      </p>
                    </div>
                    <span className="rounded-full bg-primary px-4 py-2 text-xs font-bold text-primary-foreground">
                      {tr("Ver perfil", "View profile")}
                    </span>
                  </div>
                </div>
              </div>

              <div className="landing-float absolute -left-2 top-[18%] z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#211217]/90 p-3 pr-4 text-white shadow-2xl backdrop-blur-xl sm:-left-8">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground">
                  <Gift className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/45">{tr("Mimo enviado", "Gift sent")}</p>
                  <p className="mt-0.5 text-xs font-bold">{tr("Uma conexão especial", "A special connection")}</p>
                </div>
              </div>

              <div className="landing-float-slow absolute -right-2 bottom-[17%] z-20 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#211217]/90 p-3 pr-4 text-white shadow-2xl backdrop-blur-xl sm:-right-7">
                <div className="relative">
                  <CreatorPortrait creator={HERO_CREATORS[1]} className="h-11 w-11 rounded-xl object-cover" />
                  <span className="absolute -bottom-1 -right-1 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <LockKeyhole className="h-2.5 w-2.5" />
                  </span>
                </div>
                <div>
                  <p className="text-[10px] uppercase tracking-wider text-white/45">PPV</p>
                  <p className="mt-0.5 text-xs font-bold">{tr("Conteúdo desbloqueado", "Content unlocked")}</p>
                </div>
              </div>

              <div className="absolute -bottom-1 left-[8%] z-20 flex items-center rounded-full border border-border/70 bg-background/90 px-3 py-2 shadow-xl backdrop-blur-xl">
                <div className="flex -space-x-2">
                  {HERO_CREATORS.map((creator) => (
                    <CreatorPortrait
                      key={creator.username}
                      creator={creator}
                      className="h-8 w-8 rounded-full border-2 border-background object-cover"
                    />
                  ))}
                </div>
                <p className="ml-3 pr-1 text-[10px] font-semibold text-foreground">{tr("Experiências únicas", "Unique experiences")}</p>
              </div>
            </div>
          </div>

          <div className="relative mx-auto max-w-7xl px-5 pb-8 sm:px-8">
            <div className="grid overflow-hidden rounded-2xl border border-border/50 bg-card/35 backdrop-blur-xl sm:grid-cols-3">
              {[
                [ShieldCheck, tr("Ambiente protegido", "Protected environment"), tr("Privacidade e segurança para todos", "Privacy and safety for everyone")],
                [MessageCircle, tr("Conexão direta", "Direct connection"), tr("Chat, PPV e experiências em um só lugar", "Chat, PPV and experiences in one place")],
                [WalletCards, tr("Pagamento simples", "Simple payments"), tr("Uma jornada clara, do acesso à renovação", "A clear journey from access to renewal")],
              ].map(([Icon, title, description], index) => {
                const FeatureIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={title as string} className={`flex items-center gap-4 p-5 ${index > 0 ? "border-t border-border/50 sm:border-l sm:border-t-0" : ""}`}>
                    <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                      <FeatureIcon className="h-4 w-4" />
                    </span>
                    <div>
                      <p className="text-sm font-bold">{title as string}</p>
                      <p className="mt-1 text-xs leading-5 text-muted-foreground">{description as string}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
          </section>
        )}

        <section id="experiencia" className="relative mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="mb-14 max-w-2xl">
            <p className="mb-4 text-xs font-bold uppercase tracking-[0.22em] text-primary">
              {tr("Feito para aproximar", "Designed to bring people closer")}
            </p>
            <h2 className="font-display text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">
              {tr("Não é só conteúdo.", "It is more than content.")}
              <span className="block italic text-muted-foreground">{tr("É sentir que você faz parte.", "It is feeling like you belong.")}</span>
            </h2>
          </div>

          <div className="grid gap-5 lg:grid-cols-3">
            {experiences.map((experience, index) => {
              const Icon = experience.icon;
              return (
                <article
                  key={experience.eyebrow}
                  className="group relative min-h-[22rem] overflow-hidden rounded-[2rem] border border-border/60 bg-card/50 p-7 transition-all duration-500 hover:-translate-y-1 hover:border-primary/30 hover:shadow-elegant sm:p-8"
                >
                  {activeVersion !== "v1.1" && (
                    <div className="pointer-events-none absolute -right-20 -top-20 h-48 w-48 rounded-full bg-primary/[0.07] blur-2xl transition-transform duration-700 group-hover:scale-150" />
                  )}
                  <div className="flex items-start justify-between">
                    <span className="flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/15 bg-primary/10 text-primary">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-5xl text-primary/10">0{index + 1}</span>
                  </div>
                  <p className="mt-12 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{experience.eyebrow}</p>
                  <h3 className="mt-3 font-display text-2xl font-semibold leading-snug">{experience.title}</h3>
                  <p className="mt-4 text-sm leading-6 text-muted-foreground">{experience.description}</p>
                </article>
              );
            })}
          </div>
        </section>

        <section className="border-y border-border/50 bg-card/20 py-24 lg:py-28">
          <div className="mx-auto max-w-7xl px-5 sm:px-8">
            <div className="mb-10 flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
              <div>
                <p className="mb-3 text-xs font-bold uppercase tracking-[0.22em] text-primary">{tr("Descubra", "Discover")}</p>
                <h2 className="font-display text-4xl font-semibold sm:text-5xl">{tr("Criadoras para conhecer", "Creators to discover")}</h2>
              </div>
              <Link to={routeTo("/explore")} className="group inline-flex items-center gap-2 text-sm font-bold text-primary">
                {tr("Ver todas as criadoras", "See all creators")}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </div>

            {DEMO_MODE ? (
              <div className="grid grid-cols-2 gap-3 sm:gap-5 lg:grid-cols-4">
                {FEATURED_CREATORS.map((creator, index) => (
                  <Link
                    key={creator.username}
                    to={routeTo("/profile/$username")}
                    params={{ username: creator.username } as never}
                    className={`group relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-card ${index % 2 === 1 ? "sm:translate-y-8" : ""}`}
                  >
                    <div className="aspect-[3/4] overflow-hidden">
                      <CreatorPortrait
                        creator={creator}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                    </div>
                    <div className="absolute inset-0 bg-gradient-to-t from-[#140a0f] via-transparent to-transparent" />
                    <div className="absolute bottom-0 left-0 right-0 p-4 text-white sm:p-5">
                      <div className="flex items-center gap-1.5">
                        <h3 className="font-display text-xl font-semibold sm:text-2xl">{creator.display_name}</h3>
                        <BadgeCheck className="h-4 w-4 fill-primary text-[#241218]" />
                      </div>
                      <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-white/60 sm:text-xs">
                        <span>{locale === "en" ? creator.category_en : creator.category}</span>
                        <span>{formatPrice(creator.subscription_price_cents, locale)}/{tr("mês", "mo")}</span>
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : (
              <TopCreators limit={4} hideHeading />
            )}
          </div>
        </section>

        <section className="mx-auto max-w-7xl px-5 py-24 sm:px-8 lg:py-32">
          <div className="relative overflow-hidden rounded-[2.5rem] border border-primary/20 bg-[#211217] px-6 py-10 text-white shadow-[0_40px_120px_-60px_rgba(218,183,181,0.55)] sm:px-10 lg:px-14 lg:py-14">
            {activeVersion !== "v1.1" && (
              <>
                <div className="pointer-events-none absolute -right-20 -top-40 h-[32rem] w-[32rem] rounded-full bg-primary/20 blur-[110px]" />
                <div className="pointer-events-none absolute bottom-0 left-1/3 h-56 w-56 rounded-full bg-accent/10 blur-[80px]" />
              </>
            )}

            <div className="relative grid items-center gap-12 lg:grid-cols-[0.95fr_1.05fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.06] px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-primary">
                  <Heart className="h-3.5 w-3.5" />
                  {DEMO_MODE
                    ? tr("Sua experiência Fanlira", "Your Fanlira experience")
                    : tr("Prévia da experiência", "Experience preview")}
                </span>
                <h2 className="mt-6 max-w-xl font-display text-4xl font-semibold leading-tight sm:text-5xl">
                  {tr("Suas favoritas.", "Your favorites.")}
                  <span className="block italic text-primary">{tr("Mais perto de você.", "Closer to you.")}</span>
                </h2>
                <p className="mt-5 max-w-xl text-sm leading-7 text-white/60 sm:text-base">
                  {tr(
                    "Acompanhe cada novidade, converse em particular e escolha exatamente quais experiências quer desbloquear — tudo em um ambiente discreto.",
                    "Follow every update, chat privately and choose exactly which experiences you want to unlock — all in a discreet space.",
                  )}
                </p>
                <div className="mt-7 grid gap-3 text-sm text-white/75 sm:grid-cols-2">
                  {[
                    tr("Assine no seu ritmo", "Subscribe at your pace"),
                    tr("Desbloqueie somente o que quiser", "Unlock only what you want"),
                    tr("Converse de forma privada", "Chat privately"),
                    tr("Ganhe benefícios de fidelidade", "Earn loyalty benefits"),
                  ].map((benefit) => (
                    <span key={benefit} className="flex items-center gap-2.5">
                      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-primary">
                        <Check className="h-3 w-3" />
                      </span>
                      {benefit}
                    </span>
                  ))}
                </div>
                <Link to={routeTo("/explore")} className="mt-9 inline-block">
                  <Button className="group h-12 rounded-full bg-primary px-6 font-bold text-primary-foreground hover:bg-primary/90">
                    {tr("Encontrar minhas favoritas", "Find my favorites")}
                    <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                  </Button>
                </Link>
              </div>

              <div className="relative mx-auto w-full max-w-md">
                <div className="rounded-[2rem] border border-white/10 bg-white/[0.055] p-5 shadow-2xl backdrop-blur-xl sm:p-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <CreatorPortrait creator={HERO_CREATORS[0]} className="h-11 w-11 rounded-xl object-cover" />
                        <span className="absolute -bottom-1 -right-1 h-3 w-3 rounded-full border-2 border-[#352029] bg-emerald-400" />
                      </div>
                      <div>
                        <p className="flex items-center gap-1 text-sm font-bold">
                          {HERO_CREATORS[0].display_name}
                          <BadgeCheck className="h-3.5 w-3.5 fill-primary text-[#352029]" />
                        </p>
                        <p className="mt-0.5 text-[10px] text-emerald-400">
                          {DEMO_MODE ? tr("Online agora", "Online now") : tr("Exemplo de conversa", "Conversation example")}
                        </p>
                      </div>
                    </div>
                    <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                      <MessageCircle className="h-4 w-4" />
                    </span>
                  </div>

                  <div className="mt-6 space-y-3">
                    <div className="max-w-[82%] rounded-2xl rounded-tl-md bg-white/[0.07] px-4 py-3">
                      <p className="text-xs leading-5 text-white/80">
                        {tr("Separei uma novidade exclusiva para você 💕", "I saved an exclusive new release for you 💕")}
                      </p>
                      <p className="mt-1.5 text-right text-[9px] text-white/30">18:42</p>
                    </div>

                    <div className="overflow-hidden rounded-2xl border border-primary/20 bg-black/15">
                      <div className="relative h-32 overflow-hidden sm:h-36">
                        <CreatorPortrait creator={HERO_CREATORS[2]} className="h-full w-full object-cover object-[center_30%] blur-[7px] scale-105" />
                        <div className="absolute inset-0 bg-black/45" />
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                          <span className="flex h-10 w-10 items-center justify-center rounded-full border border-white/15 bg-black/30 text-primary backdrop-blur-md">
                            <LockKeyhole className="h-4 w-4" />
                          </span>
                          <p className="mt-2 text-xs font-bold">{tr("Conteúdo exclusivo", "Exclusive content")}</p>
                          <p className="mt-1 text-[10px] text-white/50">{tr("Desbloqueie quando quiser", "Unlock whenever you want")}</p>
                        </div>
                      </div>
                      <div className="flex items-center justify-between gap-3 p-3.5">
                        <div>
                          <p className="text-[9px] uppercase tracking-[0.16em] text-white/35">PPV</p>
                          <p className="mt-0.5 text-sm font-bold">R$ 9,90</p>
                        </div>
                        <span className="rounded-full bg-primary px-4 py-2 text-[10px] font-bold text-primary-foreground">
                          {tr("Desbloquear", "Unlock")}
                        </span>
                      </div>
                    </div>

                    <div className="ml-auto max-w-[72%] rounded-2xl rounded-tr-md bg-primary px-4 py-3 text-primary-foreground">
                      <p className="text-xs">{tr("Amei! Quero ver 💗", "Loved it! I want to see it 💗")}</p>
                      <p className="mt-1.5 text-right text-[9px] opacity-50">18:44 ✓✓</p>
                    </div>
                  </div>
                </div>

                <div className="landing-float-slow absolute -bottom-6 -left-4 flex items-center gap-3 rounded-2xl border border-white/10 bg-[#301a22] p-3 pr-5 shadow-2xl sm:-left-10">
                  <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15 text-primary">
                    <Crown className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="text-[10px] text-white/40">{tr("Fidelidade Fanlira", "Fanlira loyalty")}</p>
                    <p className="mt-0.5 text-xs font-bold">{tr("Você chegou ao nível Ouro", "You reached Gold level")}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="border-y border-border/50 bg-card/20">
          <div className="mx-auto grid max-w-7xl gap-8 px-5 py-16 sm:px-8 md:grid-cols-[0.7fr_1.3fr] md:items-center lg:py-20">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.22em] text-primary">{tr("Confiança Fanlira", "Fanlira trust")}</p>
              <h2 className="mt-3 font-display text-3xl font-semibold sm:text-4xl">{tr("Exclusivo também é seguro.", "Exclusive can also be safe.")}</h2>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [ShieldCheck, tr("Verificação de identidade", "Identity verification")],
                [LockKeyhole, tr("Privacidade e controle", "Privacy and control")],
                [BadgeCheck, tr("Moderação e suporte", "Moderation and support")],
              ].map(([Icon, label]) => {
                const TrustIcon = Icon as typeof ShieldCheck;
                return (
                  <div key={label as string} className="flex items-center gap-3 rounded-2xl border border-border/50 bg-background/40 p-4">
                    <TrustIcon className="h-4 w-4 shrink-0 text-primary" />
                    <span className="text-xs font-semibold sm:text-sm">{label as string}</span>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="relative mx-auto max-w-5xl px-5 py-24 text-center sm:px-8 lg:py-32">
          {activeVersion !== "v1.1" && (
            <div className="pointer-events-none absolute left-1/2 top-1/2 h-72 w-72 -translate-x-1/2 -translate-y-1/2 rounded-full bg-primary/10 blur-[90px]" />
          )}
          <div className="relative">
            <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl border border-primary/20 bg-primary/10 text-primary">
              <Heart className="h-5 w-5" />
            </span>
            <h2 className="mx-auto mt-6 max-w-3xl font-display text-4xl font-semibold leading-tight sm:text-6xl">
              {tr("O lado mais exclusivo da sua conexão começa aqui.", "The most exclusive side of your connection starts here.")}
            </h2>
            <p className="mx-auto mt-5 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              {tr("Crie sua conta, descubra novas criadoras e viva a Fanlira do seu jeito.", "Create your account, discover new creators and enjoy Fanlira your way.")}
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link to={routeTo("/signup")}>
                <Button size="lg" className="group h-13 w-full rounded-full bg-primary px-7 font-bold text-primary-foreground hover:bg-primary/90 sm:w-auto">
                  {t("landing.hero.cta")}
                  <ArrowRight className="ml-2 h-4 w-4 transition-transform group-hover:translate-x-1" />
                </Button>
              </Link>
              <Link to={routeTo("/login")}>
                <Button size="lg" variant="ghost" className="h-13 w-full rounded-full px-7 sm:w-auto">
                  {t("landing.hero.cta2")}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-border/60 bg-card/20">
        <div className="mx-auto flex max-w-7xl flex-col gap-8 px-5 py-10 sm:px-8 md:flex-row md:items-center md:justify-between">
          <Link to="/" className="flex items-center gap-2.5">
            <span className="h-9 w-9 rounded-xl bg-gradient-primary shadow-glow" />
            <span className="font-display text-2xl font-semibold tracking-tight">
              Fan<span className="text-gradient-gold italic">lira</span>
            </span>
          </Link>
          <nav className="flex flex-wrap gap-x-6 gap-y-3 text-xs font-semibold text-muted-foreground">
            <Link to={routeTo("/terms")} className="transition-colors hover:text-primary">{tr("Termos", "Terms")}</Link>
            <Link to={routeTo("/privacy")} className="transition-colors hover:text-primary">{tr("Privacidade", "Privacy")}</Link>
            <Link to={routeTo("/help")} className="transition-colors hover:text-primary">{tr("Ajuda", "Help")}</Link>
          </nav>
          <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
            © {new Date().getFullYear()} Fanlira · 18+
          </p>
        </div>
      </footer>
    </div>
  );
}
