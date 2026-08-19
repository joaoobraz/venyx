import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { ShieldAlert } from "lucide-react";
import { useLocation } from "@tanstack/react-router";
import { requiresAgeGate } from "@/lib/age-gate";

const KEY = "age-gate-confirmed-v1";

export function AgeGateModal() {
  const { t } = useI18n();
  const location = useLocation();
  const shouldGate = requiresAgeGate(location.pathname);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!shouldGate) {
      setOpen(false);
      return;
    }
    if (!localStorage.getItem(KEY)) setOpen(true);
  }, [shouldGate]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-background/95 backdrop-blur-sm p-4">
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-card">
        <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/15">
          <ShieldAlert className="h-6 w-6 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">{t("age.title")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">{t("age.body")}</p>
        <div className="mt-6 flex gap-3">
          <Button
            variant="outline"
            className="flex-1"
            onClick={() => {
              window.location.href = "https://google.com";
            }}
          >
            {t("age.leave")}
          </Button>
          <Button
            className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => {
              localStorage.setItem(KEY, "1");
              setOpen(false);
            }}
          >
            {t("age.confirm")}
          </Button>
        </div>
      </div>
    </div>
  );
}
