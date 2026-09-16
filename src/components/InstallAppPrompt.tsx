import { useEffect, useState } from "react";
import { Download, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";
import { useI18n } from "@/lib/i18n";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
};

const DISMISS_KEY = "fanlira:install-prompt-dismissed-at";
const DISMISS_DAYS = 14;

function isStandalone() {
  if (typeof window === "undefined") return true;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function isIos() {
  if (typeof navigator === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function recentlyDismissed() {
  try {
    const raw = localStorage.getItem(DISMISS_KEY);
    if (!raw) return false;
    return Date.now() - Number(raw) < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Convite discreto para instalar a Fanlira como app (PWA). Só aparece para
 * usuário logado, em celular, fora do modo instalado, e some por 14 dias ao
 * ser fechado. Android/desktop: usa o prompt nativo. iOS: explica o caminho
 * (Compartilhar → Adicionar à Tela de Início), já que a Apple não expõe prompt.
 */
export function InstallAppPrompt() {
  const { user } = useAuth();
  const { tr } = useI18n();
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [visible, setVisible] = useState(false);
  const [ios, setIos] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined" || isStandalone() || recentlyDismissed()) return;
    const mobile = window.matchMedia("(max-width: 768px)").matches;
    if (!mobile) return;
    if (isIos()) {
      setIos(true);
      setVisible(true);
      return;
    }
    const onPrompt = (event: Event) => {
      event.preventDefault();
      setDeferred(event as BeforeInstallPromptEvent);
      setVisible(true);
    };
    window.addEventListener("beforeinstallprompt", onPrompt);
    return () => window.removeEventListener("beforeinstallprompt", onPrompt);
  }, []);

  if (!user || !visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()));
    } catch {
      // sem storage: só esconde nesta visita
    }
    setVisible(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    const choice = await deferred.userChoice.catch(() => ({ outcome: "dismissed" as const }));
    if (choice.outcome === "accepted") setVisible(false);
    else dismiss();
  };

  return (
    <div className="fixed inset-x-3 bottom-3 z-40 rounded-2xl border border-border bg-card p-3 shadow-xl md:hidden">
      <div className="flex items-start gap-3">
        <img src="/icons/icon-192.png" alt="" className="h-10 w-10 rounded-xl" />
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">
            {tr("Instale a Fanlira no seu celular", "Install Fanlira on your phone")}
          </p>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {ios
              ? tr(
                  "Toque em Compartilhar e depois em “Adicionar à Tela de Início”.",
                  "Tap Share, then “Add to Home Screen”.",
                )
              : tr(
                  "Abre em tela cheia, como um app, sem passar pelo navegador.",
                  "Opens full screen, like an app, without the browser.",
                )}
          </p>
          <div className="mt-2 flex items-center gap-2">
            {ios ? (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <Share className="h-3.5 w-3.5" /> {tr("Compartilhar → Adicionar à Tela de Início", "Share → Add to Home Screen")}
              </span>
            ) : (
              <Button size="sm" onClick={install} className="bg-primary text-primary-foreground hover:bg-primary/90">
                <Download className="mr-1.5 h-3.5 w-3.5" /> {tr("Instalar", "Install")}
              </Button>
            )}
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {tr("Agora não", "Not now")}
            </Button>
          </div>
        </div>
        <button
          type="button"
          onClick={dismiss}
          aria-label={tr("Fechar", "Close")}
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
