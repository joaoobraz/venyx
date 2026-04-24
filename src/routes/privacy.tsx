import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade" },
      { name: "description", content: "Como coletamos, usamos e protegemos seus dados pessoais — em conformidade com a LGPD." },
    ],
  }),
});

function PrivacyPage() {
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <p>
          Esta política descreve como tratamos seus dados pessoais em conformidade com a Lei Geral de Proteção de
          Dados (Lei 13.709/2018 — LGPD).
        </p>

        <h2>1. Controlador</h2>
        <p>
          A plataforma atua como Controladora dos dados pessoais. Encarregado de Dados (DPO):{" "}
          <a href="mailto:dpo@plataforma.com">dpo@plataforma.com</a>.
        </p>

        <h2>2. Dados que coletamos</h2>
        <ul>
          <li><strong>Cadastro:</strong> e-mail, nome de exibição, username, senha (hash).</li>
          <li><strong>Perfil:</strong> avatar, capa, bio, links sociais, idioma e preferências.</li>
          <li><strong>KYC (criadoras):</strong> documento oficial e selfie, armazenados em bucket privado e criptografado, com acesso restrito à equipe de compliance.</li>
          <li><strong>Pagamentos:</strong> registros de transação (valor, data, método). Dados completos de cartão são processados diretamente pelo gateway e <strong>nunca</strong> trafegam ou são armazenados em nossos servidores.</li>
          <li><strong>Conteúdo gerado:</strong> posts, mensagens, stories e mídias enviadas.</li>
          <li><strong>Uso e dispositivo:</strong> IP, user-agent, páginas visitadas, cliques em links — para segurança e prevenção a fraude.</li>
        </ul>

        <h2>3. Bases legais (art. 7º LGPD)</h2>
        <ul>
          <li><strong>Execução de contrato:</strong> operação da conta, processamento de pagamentos.</li>
          <li><strong>Cumprimento de obrigação legal:</strong> retenção fiscal, KYC, atendimento a autoridades.</li>
          <li><strong>Legítimo interesse:</strong> prevenção a fraude, moderação, segurança da plataforma.</li>
          <li><strong>Consentimento:</strong> envio de e-mails de marketing (opt-in), cookies não-essenciais.</li>
        </ul>

        <h2>4. Compartilhamento</h2>
        <p>Não vendemos dados pessoais. Compartilhamos apenas com:</p>
        <ul>
          <li>Processadores de pagamento (Stripe/Paddle);</li>
          <li>Provedores de infraestrutura (cloud, e-mail transacional);</li>
          <li>Serviços de moderação por IA (Lovable AI Gateway), apenas com a mídia necessária para análise;</li>
          <li>Autoridades públicas, mediante ordem judicial ou requisição legal válida.</li>
        </ul>

        <h2>5. Seus direitos (art. 18 LGPD)</h2>
        <ul>
          <li>Confirmação de tratamento e acesso aos seus dados;</li>
          <li>Correção de dados incompletos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>Portabilidade dos dados a outro fornecedor;</li>
          <li>Eliminação dos dados tratados com seu consentimento;</li>
          <li>Revogação do consentimento.</li>
        </ul>
        <p>
          Para exercer qualquer direito, escreva para <a href="mailto:dpo@plataforma.com">dpo@plataforma.com</a>.
          Respondemos em até 15 dias.
        </p>

        <h2>6. Retenção</h2>
        <ul>
          <li>Conta ativa: enquanto durar o vínculo.</li>
          <li>Dados financeiros e fiscais: até 5 anos após o encerramento (obrigação legal).</li>
          <li>Documentos de KYC: até 5 anos após o encerramento da conta.</li>
          <li>Logs de segurança: até 6 meses.</li>
        </ul>

        <h2>7. Segurança</h2>
        <p>
          Aplicamos criptografia em trânsito (HTTPS/TLS) e em repouso, controle de acesso por papéis (RLS),
          autenticação de dois fatores opcional, e monitoramento contínuo. Em caso de incidente, notificaremos a
          ANPD e os titulares afetados conforme o art. 48 da LGPD.
        </p>

        <h2>8. Cookies</h2>
        <p>Usamos cookies essenciais para autenticação e preferências (idioma, tema). Não usamos cookies de rastreamento publicitário de terceiros.</p>

        <h2>9. Transferência internacional</h2>
        <p>Alguns provedores de infraestrutura podem armazenar dados fora do Brasil. Garantimos cláusulas contratuais adequadas conforme o art. 33 da LGPD.</p>

        <h2>10. Alterações</h2>
        <p>Podemos atualizar esta política. Mudanças relevantes serão comunicadas por e-mail ou aviso na plataforma.</p>
      </article>
    </AppShell>
  );
}
