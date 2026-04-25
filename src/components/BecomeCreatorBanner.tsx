import { Link } from "@tanstack/react-router";
import { Crown, Clock } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

interface Props {
  compact?: boolean;
}

export function BecomeCreatorBanner({ compact = false }: Props) {
  const { isCreator, kyc, user } = useAuth();
  const { t } = useI18n();

  if (!user || isCreator) return null;

  // Pending KYC -> show status
  if (kyc?.status === "pending") {
    return (
      <div
        className={`rounded-2xl border border-primary/30 bg-card p-4 ${
          compact ? "" : "shadow-card"
        }`}
      >
        <div className="flex items-center gap-2 text-sm font-medium text-primary">
          <Clock className="h-4 w-4" />
          {t("becomeCreator.banner.pending")}
        </div>
      </div>
    );
  }

  return (
    <Link
      to="/become-creator"
      className={`group block overflow-hidden rounded-2xl bg-gradient-primary p-5 shadow-glow transition-transform hover:-translate-y-0.5 ${
        compact ? "" : "shadow-card"
      }`}
    >
      <div className="flex items-start gap-3 text-primary-foreground">
        <div className="rounded-full bg-black/20 p-2">
          <Sparkles className="h-5 w-5" />
        </div>
        <div className="flex-1">
          <div className="text-base font-bold leading-tight">
            {t("becomeCreator.banner.title")}
          </div>
          {!compact && (
            <p className="mt-1 text-sm opacity-90">{t("becomeCreator.banner.subtitle")}</p>
          )}
          <div className="mt-3 inline-flex items-center gap-1 rounded-full bg-black/25 px-3 py-1 text-xs font-semibold backdrop-blur-sm">
            {t("becomeCreator.banner.cta")} →
          </div>
        </div>
      </div>
    </Link>
  );
}
