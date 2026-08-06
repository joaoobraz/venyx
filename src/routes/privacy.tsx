import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { openCookieSettings } from "@/lib/cookie-consent";
import { useI18n } from "@/lib/i18n";

export const Route = createFileRoute("/privacy")({
  component: PrivacyPage,
  head: () => ({
    meta: [
      { title: "Política de Privacidade" },
      {
        name: "description",
        content:
          "Como coletamos, usamos e protegemos seus dados pessoais — em conformidade com a LGPD.",
      },
    ],
  }),
});

function PrivacyPage() {
  const { locale } = useI18n();
  if (locale === "en") {
    return (
      <AppShell>
        <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
          <h1>Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {new Date().toLocaleDateString("en-US")}
          </p>
          <p>
            This policy describes how we process personal data in compliance with Brazil's General
            Data Protection Law (Law 13,709/2018 — LGPD).
          </p>
          <h2>1. Data controller</h2>
          <p>
            The platform is the data controller. Data Protection Officer:{" "}
            <a href="mailto:dpo@plataforma.com">dpo@plataforma.com</a>.
          </p>
          <h2>2. Data we collect</h2>
          <ul>
            <li>
              <strong>Registration:</strong> email, display name, username, and password hash.
            </li>
            <li>
              <strong>Profile:</strong> avatar, cover, bio, social links, language, and preferences.
            </li>
            <li>
              <strong>Creator verification:</strong> official ID and selfie stored privately with
              restricted compliance access.
            </li>
            <li>
              <strong>Payments:</strong> transaction amount, date, and method. Full card data is
              handled by the payment gateway and is never stored on our servers.
            </li>
            <li>
              <strong>User content:</strong> posts, messages, stories, and uploaded media.
            </li>
            <li>
              <strong>Usage and device:</strong> IP address, user agent, visited pages, and link
              clicks for security and fraud prevention.
            </li>
          </ul>
          <h2>3. Legal bases</h2>
          <ul>
            <li>
              <strong>Contract performance:</strong> account operation and payment processing.
            </li>
            <li>
              <strong>Legal obligation:</strong> tax retention, identity checks, and lawful
              authority requests.
            </li>
            <li>
              <strong>Legitimate interest:</strong> fraud prevention, moderation, and platform
              security.
            </li>
            <li>
              <strong>Consent:</strong> opt-in marketing email and non-essential cookies.
            </li>
          </ul>
          <h2>4. Sharing</h2>
          <p>We do not sell personal data. We only share it with:</p>
          <ul>
            <li>Payment processors;</li>
            <li>Cloud and transactional-email providers;</li>
            <li>AI moderation services, limited to the media required for review;</li>
            <li>
              Creator-configured advertising measurement providers, only after marketing consent;
            </li>
            <li>Public authorities under a valid legal request or court order.</li>
          </ul>
          <h2>5. Your LGPD rights</h2>
          <ul>
            <li>Confirmation of processing and access to your data;</li>
            <li>Correction of incomplete or outdated data;</li>
            <li>Anonymization, blocking, or deletion of unnecessary data;</li>
            <li>Data portability, deletion of consent-based data, and withdrawal of consent.</li>
          </ul>
          <p>
            Contact <a href="mailto:dpo@plataforma.com">dpo@plataforma.com</a> to exercise these
            rights. We respond within 15 days.
          </p>
          <h2>6. Retention</h2>
          <ul>
            <li>Active account data: for the duration of the relationship.</li>
            <li>
              Financial, tax, and identity-verification records: up to five years after closure.
            </li>
            <li>Security logs: up to six months.</li>
          </ul>
          <h2>7. Security</h2>
          <p>
            We use encryption in transit and at rest, role-based access controls, optional 2FA, and
            continuous monitoring. Incidents are reported as required by Article 48 of the LGPD.
          </p>
          <h2>8. Cookies</h2>
          <p>
            We use essential storage for authentication and preferences. On Venyx Links pages,
            creator-configured measurement tags from Meta, Google, TikTok, Pinterest or Snapchat may
            load only after the visitor expressly accepts marketing cookies. These tags may receive
            page-view, campaign and link-click data, but Venyx does not send private messages,
            payment details, email or phone data through this integration. Consent can be withdrawn
            at any time.
          </p>
          <Button type="button" variant="outline" onClick={openCookieSettings}>
            Manage cookie preferences
          </Button>
          <h2>9. International transfers</h2>
          <p>
            Some infrastructure providers may store data outside Brazil under appropriate
            contractual safeguards.
          </p>
          <h2>10. Changes</h2>
          <p>Material updates will be communicated by email or through a platform notice.</p>
        </article>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Política de Privacidade</h1>
        <p className="text-sm text-muted-foreground">
          Última atualização: {new Date().toLocaleDateString("pt-BR")}
        </p>

        <p>
          Esta política descreve como tratamos seus dados pessoais em conformidade com a Lei Geral
          de Proteção de Dados (Lei 13.709/2018 — LGPD).
        </p>

        <h2>1. Controlador</h2>
        <p>
          A plataforma atua como Controladora dos dados pessoais. Encarregado de Dados (DPO):{" "}
          <a href="mailto:dpo@plataforma.com">dpo@plataforma.com</a>.
        </p>

        <h2>2. Dados que coletamos</h2>
        <ul>
          <li>
            <strong>Cadastro:</strong> e-mail, nome de exibição, username, senha (hash).
          </li>
          <li>
            <strong>Perfil:</strong> avatar, capa, bio, links sociais, idioma e preferências.
          </li>
          <li>
            <strong>KYC (criadoras):</strong> documento oficial e selfie, armazenados em bucket
            privado e criptografado, com acesso restrito à equipe de compliance.
          </li>
          <li>
            <strong>Pagamentos:</strong> registros de transação (valor, data, método). Dados
            completos de cartão são processados diretamente pelo gateway e <strong>nunca</strong>{" "}
            trafegam ou são armazenados em nossos servidores.
          </li>
          <li>
            <strong>Conteúdo gerado:</strong> posts, mensagens, stories e mídias enviadas.
          </li>
          <li>
            <strong>Uso e dispositivo:</strong> IP, user-agent, páginas visitadas, cliques em links
            — para segurança e prevenção a fraude.
          </li>
        </ul>

        <h2>3. Bases legais (art. 7º LGPD)</h2>
        <ul>
          <li>
            <strong>Execução de contrato:</strong> operação da conta, processamento de pagamentos.
          </li>
          <li>
            <strong>Cumprimento de obrigação legal:</strong> retenção fiscal, KYC, atendimento a
            autoridades.
          </li>
          <li>
            <strong>Legítimo interesse:</strong> prevenção a fraude, moderação, segurança da
            plataforma.
          </li>
          <li>
            <strong>Consentimento:</strong> envio de e-mails de marketing (opt-in), cookies
            não-essenciais.
          </li>
        </ul>

        <h2>4. Compartilhamento</h2>
        <p>Não vendemos dados pessoais. Compartilhamos apenas com:</p>
        <ul>
          <li>Processadores de pagamento (Stripe/Paddle);</li>
          <li>Provedores de infraestrutura (cloud, e-mail transacional);</li>
          <li>
            Serviços de moderação por IA (Lovable AI Gateway), apenas com a mídia necessária para
            análise;
          </li>
          <li>
            Provedores de mensuração de publicidade configurados pela criadora, somente após o
            consentimento de marketing;
          </li>
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
          Para exercer qualquer direito, escreva para{" "}
          <a href="mailto:dpo@plataforma.com">dpo@plataforma.com</a>. Respondemos em até 15 dias.
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
          Aplicamos criptografia em trânsito (HTTPS/TLS) e em repouso, controle de acesso por papéis
          (RLS), autenticação de dois fatores opcional, e monitoramento contínuo. Em caso de
          incidente, notificaremos a ANPD e os titulares afetados conforme o art. 48 da LGPD.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Usamos armazenamento essencial para autenticação e preferências. Nas páginas Venyx Links,
          tags de medição configuradas pela criadora — Meta, Google, TikTok, Pinterest ou Snapchat —
          podem carregar somente depois que o visitante aceitar expressamente cookies de marketing.
          Essas tags podem receber dados de visualização, campanha e clique nos links, mas a Venyx
          não envia mensagens privadas, dados de pagamento, e-mail ou telefone por essa integração.
          O consentimento pode ser revogado a qualquer momento.
        </p>
        <Button type="button" variant="outline" onClick={openCookieSettings}>
          Gerenciar preferências de cookies
        </Button>

        <h2>9. Transferência internacional</h2>
        <p>
          Alguns provedores de infraestrutura podem armazenar dados fora do Brasil. Garantimos
          cláusulas contratuais adequadas conforme o art. 33 da LGPD.
        </p>

        <h2>10. Alterações</h2>
        <p>
          Podemos atualizar esta política. Mudanças relevantes serão comunicadas por e-mail ou aviso
          na plataforma.
        </p>
      </article>
    </AppShell>
  );
}
