const EXEMPT_PATHS = new Set([
  "/terms",
  "/termos",
  "/terminos",
  "/privacy",
  "/privacidade",
  "/privacidad",
  "/dmca",
  "/help",
  "/ajuda",
  "/ayuda",
  "/login",
  "/entrar",
  "/signup",
  "/cadastro",
  "/registro",
  "/reset-password",
  "/recuperar-senha",
  "/recuperar-contrasena",
  "/auth/callback",
]);

export function requiresAgeGate(pathname: string) {
  const normalized = `/${pathname.split("?")[0].split("#")[0].split("/").filter(Boolean).join("/")}`;
  return !EXEMPT_PATHS.has(normalized);
}
