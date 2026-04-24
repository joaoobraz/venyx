import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade" },
      { name: "description", content: "Como tratamos seus dados pessoais." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString()}</p>

        <h2>1. Dados coletados</h2>
        <ul>
          <li>Cadastro: e-mail, nome, username.</li>
          <li>Perfil: avatar, capa, bio, links.</li>
          <li>KYC (apenas criadoras): documento e selfie, armazenados em bucket privado.</li>
          <li>Pagamentos: registros de transação (sem dados completos de cartão).</li>
          <li>Uso: navegação, cliques em links, IPs (logs).</li>
        </ul>

        <h2>2. Uso dos dados</h2>
        <p>Utilizamos para operar a plataforma, prevenir fraude, atender obrigações legais e melhorar o serviço.</p>

        <h2>3. Compartilhamento</h2>
        <p>Não vendemos dados. Compartilhamos apenas com processadores de pagamento e quando exigido por lei.</p>

        <h2>4. Seus direitos (LGPD)</h2>
        <p>Você pode solicitar acesso, correção e exclusão dos seus dados em qualquer momento via suporte@plataforma.com.</p>

        <h2>5. Retenção</h2>
        <p>Mantemos dados financeiros e de KYC pelo prazo exigido por lei (até 5 anos).</p>

        <h2>6. Cookies</h2>
        <p>Usamos cookies essenciais para autenticação e preferências (idioma, tema).</p>
      </article>
    </AppShell>
  );
}
