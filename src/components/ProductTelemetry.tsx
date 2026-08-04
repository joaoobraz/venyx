import { useEffect, useRef } from "react";
import { useLocation } from "@tanstack/react-router";
import { trackClientError, trackProductEvent } from "@/lib/telemetry";
import { visitAttributionMetadata } from "@/lib/visit-attribution";

export function ProductTelemetry() {
  const location = useLocation();
  const previousRoute = useRef<string | null>(null);

  useEffect(() => {
    const referrer = previousRoute.current
      ? new URL(previousRoute.current, window.location.origin).toString()
      : document.referrer;
    trackProductEvent("page_view", {
      path: location.pathname,
      ...visitAttributionMetadata({
        landingUrl: window.location.href,
        referrer,
        siteOrigin: window.location.origin,
      }),
    });
    previousRoute.current = `${location.pathname}${window.location.search}`;
  }, [location.href, location.pathname]);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      trackClientError("client_error", event.error ?? new Error(event.message), {
        source: event.filename ? "script" : "window",
      });
    };
    const onRejection = (event: PromiseRejectionEvent) => {
      trackClientError("client_error", event.reason, { source: "unhandled_promise" });
    };
    window.addEventListener("error", onError);
    window.addEventListener("unhandledrejection", onRejection);
    return () => {
      window.removeEventListener("error", onError);
      window.removeEventListener("unhandledrejection", onRejection);
    };
  }, []);

  return null;
}
