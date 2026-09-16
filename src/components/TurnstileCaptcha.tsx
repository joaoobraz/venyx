import { useEffect, useRef, useState } from "react";
import { TURNSTILE_SITE_KEY } from "@/lib/turnstile";

type TurnstileWidgetId = string;

type TurnstileApi = {
  render: (
    container: HTMLElement,
    options: {
      sitekey: string;
      action: string;
      theme: "auto";
      size: "flexible";
      callback: (token: string) => void;
      "expired-callback": () => void;
      "error-callback": () => void;
    },
  ) => TurnstileWidgetId;
  remove: (widgetId: TurnstileWidgetId) => void;
  reset: (widgetId: TurnstileWidgetId) => void;
};

declare global {
  interface Window {
    turnstile?: TurnstileApi;
  }
}

const TURNSTILE_SCRIPT_ID = "fanlira-turnstile-script";
const TURNSTILE_SCRIPT_URL =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit";

let turnstileLoader: Promise<TurnstileApi> | null = null;

function loadTurnstile(): Promise<TurnstileApi> {
  if (window.turnstile) return Promise.resolve(window.turnstile);
  if (turnstileLoader) return turnstileLoader;

  turnstileLoader = new Promise<TurnstileApi>((resolve, reject) => {
    const finish = () => {
      if (window.turnstile) resolve(window.turnstile);
      else reject(new Error("turnstile_api_unavailable"));
    };

    const existingScript = document.getElementById(TURNSTILE_SCRIPT_ID) as HTMLScriptElement | null;
    if (existingScript) {
      existingScript.addEventListener("load", finish, { once: true });
      existingScript.addEventListener(
        "error",
        () => reject(new Error("turnstile_script_failed")),
        { once: true },
      );
      return;
    }

    const script = document.createElement("script");
    script.id = TURNSTILE_SCRIPT_ID;
    script.src = TURNSTILE_SCRIPT_URL;
    script.async = true;
    script.defer = true;
    script.addEventListener("load", finish, { once: true });
    script.addEventListener(
      "error",
      () => reject(new Error("turnstile_script_failed")),
      { once: true },
    );
    document.head.appendChild(script);
  }).catch((error) => {
    turnstileLoader = null;
    throw error;
  });

  return turnstileLoader;
}

type TurnstileCaptchaProps = {
  action: "login" | "signup" | "password_recovery";
  onTokenChange: (token: string | null) => void;
  resetSignal?: number;
};

export function TurnstileCaptcha({
  action,
  onTokenChange,
  resetSignal = 0,
}: TurnstileCaptchaProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const widgetIdRef = useRef<TurnstileWidgetId | null>(null);
  const tokenChangeRef = useRef(onTokenChange);
  const [loadError, setLoadError] = useState(false);

  useEffect(() => {
    tokenChangeRef.current = onTokenChange;
  }, [onTokenChange]);

  useEffect(() => {
    if (!TURNSTILE_SITE_KEY || !containerRef.current) return;

    let disposed = false;
    void loadTurnstile()
      .then((turnstile) => {
        if (disposed || !containerRef.current) return;
        widgetIdRef.current = turnstile.render(containerRef.current, {
          sitekey: TURNSTILE_SITE_KEY,
          action,
          theme: "auto",
          size: "flexible",
          callback: (token) => {
            setLoadError(false);
            tokenChangeRef.current(token);
          },
          "expired-callback": () => tokenChangeRef.current(null),
          "error-callback": () => {
            setLoadError(true);
            tokenChangeRef.current(null);
          },
        });
      })
      .catch(() => {
        if (!disposed) {
          setLoadError(true);
          tokenChangeRef.current(null);
        }
      });

    return () => {
      disposed = true;
      if (widgetIdRef.current && window.turnstile) {
        window.turnstile.remove(widgetIdRef.current);
      }
      widgetIdRef.current = null;
      tokenChangeRef.current(null);
    };
  }, [action]);

  useEffect(() => {
    if (resetSignal > 0 && widgetIdRef.current && window.turnstile) {
      window.turnstile.reset(widgetIdRef.current);
      tokenChangeRef.current(null);
    }
  }, [resetSignal]);

  if (!TURNSTILE_SITE_KEY) return null;

  return (
    <div className="space-y-2" aria-label="Verificação de segurança">
      <div ref={containerRef} className="min-h-16 w-full overflow-hidden rounded-lg" />
      {loadError && (
        <p className="text-xs text-destructive" role="alert">
          Não foi possível carregar a verificação de segurança. Atualize a página e tente novamente.
        </p>
      )}
    </div>
  );
}
