import { createFileRoute, Link } from "@tanstack/react-router";
import { Sparkles, MessageCircle, Lock, DollarSign, ShieldCheck, ArrowRight } from "lucide-react";
import { Header } from "@/components/Header";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/")({
  component: Landing,
});

function Landing() {
  const { t } = useI18n();
  return (
    <div className="min-h-screen bg-background">
      <Header />
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-hero">
        <div
          className="pointer-events-none absolute inset-0 opacity-30"
          style={{
            backgroundImage:
              "radial-gradient(600px circle at 20% 20%, oklch(0.72 0.19 47 / 0.35), transparent 50%), radial-gradient(800px circle at 80% 60%, oklch(0.78 0.18 60 / 0.25), transparent 50%)",
          }}
        />
        <div className="relative mx-auto flex max-w-6xl flex-col items-center px-4 py-24 text-center md:py-32">
          <span className="mb-6 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-4 py-1.5 text-xs font-semibold text-primary">
            <ShieldCheck className="h-3.5 w-3.5" />
            {t("landing.hero.badge")}
          </span>
          <h1 className="max-w-3xl text-4xl font-bold leading-tight tracking-tight text-foreground md:text-6xl">
            {t("landing.hero.title")}
          </h1>
          <p className="mt-5 max-w-xl text-base text-muted-foreground md:text-lg">
            {t("landing.hero.subtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row">
            <Link to="/signup">
              <Button
                size="lg"
                className="bg-primary text-primary-foreground shadow-glow hover:bg-primary/90"
              >
                {t("landing.hero.cta")}
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
            <Link to="/login">
              <Button size="lg" variant="outline">
                {t("landing.hero.cta2")}
              </Button>
            </Link>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-20">
        <h2 className="mb-12 text-center text-3xl font-bold tracking-tight text-foreground md:text-4xl">
          {t("landing.features.title")}
        </h2>
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
          {[
            { icon: DollarSign, title: t("landing.features.subscribe.title"), desc: t("landing.features.subscribe.desc") },
            { icon: Lock, title: t("landing.features.ppv.title"), desc: t("landing.features.ppv.desc") },
            { icon: MessageCircle, title: t("landing.features.chat.title"), desc: t("landing.features.chat.desc") },
            { icon: Sparkles, title: t("landing.features.creator.title"), desc: t("landing.features.creator.desc") },
          ].map((f, i) => {
            const Icon = f.icon;
            return (
              <div
                key={i}
                className="rounded-2xl bg-gradient-card p-6 shadow-card transition-transform hover:-translate-y-1"
              >
                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-primary/15">
                  <Icon className="h-5 w-5 text-primary" />
                </div>
                <h3 className="mb-2 text-lg font-bold text-foreground">{f.title}</h3>
                <p className="text-sm text-muted-foreground">{f.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-4xl px-4 pb-24">
        <div className="overflow-hidden rounded-3xl bg-gradient-primary p-10 text-center shadow-glow">
          <h2 className="text-3xl font-bold text-primary-foreground md:text-4xl">
            {t("becomeCreator.title")}
          </h2>
          <Link to="/signup" className="mt-6 inline-block">
            <Button size="lg" className="bg-black/20 text-primary-foreground backdrop-blur-sm hover:bg-black/30">
              {t("landing.hero.cta")}
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </Link>
        </div>
      </section>

      <footer className="border-t border-border py-8 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Venyx — 18+
      </footer>
    </div>
  );
}
