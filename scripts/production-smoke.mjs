const baseUrl = (process.argv.find((argument) => argument.startsWith("--url="))?.slice(6)
  || "https://fanlira.com.br").replace(/\/$/u, "");

const failures = [];

async function request(pathname) {
  const response = await fetch(`${baseUrl}${pathname}`, {
    redirect: "follow",
    signal: AbortSignal.timeout(10_000),
    headers: { "user-agent": "FanliraLaunchMonitor/1.0" },
  });
  const body = await response.text();
  return { response, body };
}

function requireCondition(condition, message) {
  if (!condition) failures.push(message);
}

try {
  const [home, login, health] = await Promise.all([
    request("/"),
    request("/login"),
    request("/api/public/health"),
  ]);

  requireCondition(home.response.ok, `Home respondeu ${home.response.status}.`);
  requireCondition(login.response.ok, `Login respondeu ${login.response.status}.`);
  requireCondition(health.response.ok, `Health respondeu ${health.response.status}.`);
  requireCondition(/fanlira/iu.test(home.body), "Home não contém a marca Fanlira.");
  requireCondition(/google/iu.test(login.body), "Login não apresenta a opção Google.");

  const csp = home.response.headers.get("content-security-policy") ?? "";
  requireCondition(csp.includes("frame-ancestors 'none'"), "CSP sem frame-ancestors 'none'.");
  requireCondition(csp.includes("base-uri 'self'"), "CSP sem base-uri 'self'.");
  requireCondition(
    home.response.headers.get("strict-transport-security")?.includes("includeSubDomains"),
    "HSTS ausente ou sem includeSubDomains.",
  );
  requireCondition(
    home.response.headers.get("x-content-type-options") === "nosniff",
    "X-Content-Type-Options incorreto.",
  );

  try {
    const payload = JSON.parse(health.body);
    requireCondition(payload.status === "ok", `Health status inesperado: ${payload.status}.`);
    requireCondition(payload.service === "fanlira", `Deploy desatualizado: service=${payload.service}.`);
    requireCondition(payload.database === "ok", `Banco indisponível: ${payload.database}.`);
  } catch {
    failures.push("Health não retornou JSON válido.");
  }
} catch (error) {
  failures.push(`Falha de rede: ${error instanceof Error ? error.message : "desconhecida"}.`);
}

if (failures.length > 0) {
  for (const failure of failures) console.error(`ERRO: ${failure}`);
  process.exit(1);
}

console.log(`Smoke test aprovado: ${baseUrl}`);
