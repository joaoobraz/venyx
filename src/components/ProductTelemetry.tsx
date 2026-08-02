import { useEffect } from "react";
import { useLocation } from "@tanstack/react-router";
import { trackClientError, trackProductEvent } from "@/lib/telemetry";

export function ProductTelemetry() {
  const location = useLocation();

  useEffect(() => {
    trackProductEvent("page_view", { path: location.pathname });
  }, [location.pathname]);

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
