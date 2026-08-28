import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { Button } from "@/components/ui/button";
import { openCookieSettings } from "@/lib/cookie-consent";
import { useI18n } from "@/lib/i18n";
import { LEGAL_CONTACTS, formatLegalVersion, legalEntityDescription } from "@/lib/legal-config";
import { CURRENT_PRIVACY_VERSION } from "@/lib/legal-versions";

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

export function PrivacyPage() {
  const { locale } = useI18n();
  const controller = legalEntityDescription();
  if (locale === "en") {
    return (
      <AppShell>
        <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
          <h1>Privacy Policy</h1>
          <p className="text-sm text-muted-foreground">
            Last updated: {formatLegalVersion(CURRENT_PRIVACY_VERSION, "en")}
          </p>
          <p>
            This policy describes how we process personal data in compliance with Brazil's General
            Data Protection Law (Law 13,709/2018 — LGPD).
          </p>
          <h2>1. Data controller</h2>
          <p>
            {controller} is the data controller. Privacy contact:{" "}
            <a href={`mailto:${LEGAL_CONTACTS.privacy}`}>{LEGAL_CONTACTS.privacy}</a>.
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
              <strong>Age and creator verification:</strong> official ID and current selfie stored
              privately with access restricted to authorized compliance reviewers.
            </li>
            <li>
              <strong>Buyer verification:</strong> full name, birth date, CPF, phone number and the
              result and evidence needed to confirm identity and adulthood.
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
            <li>
              <strong>Safety and support:</strong> reports, appeals, consent records, moderation
              decisions, support requests and evidence preserved for investigations.
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
              <strong>Regular exercise of rights and protection of life:</strong> disputes,
              evidence preservation, victim protection and urgent safety response.
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
          <p>
            We do not sell personal data. Access is limited to what is necessary and may involve:
          </p>
          <ul>
            <li>Payment processors;</li>
            <li>Cloud and transactional-email providers;</li>
            <li>
              Authorized internal reviewers, limited to the identity documents and media required
              for age, identity, and content-safety reviews;
            </li>
            <li>
              Creator-configured advertising measurement providers, only after marketing consent;
            </li>
            <li>Public authorities under a valid legal request or court order.</li>
          </ul>
          <p>
            Current key providers include Supabase (database, authentication and private storage),
            Cloudflare (delivery and security), Hostinger (transactional email) and Impulse Pay
            (payments and withdrawals). Their own privacy notices also apply to their processing.
          </p>
          <h2>5. Your LGPD rights</h2>
          <ul>
            <li>Confirmation of processing and access to your data;</li>
            <li>Correction of incomplete or outdated data;</li>
            <li>Anonymization, blocking, or deletion of unnecessary data;</li>
            <li>Data portability and deletion of consent-based data;</li>
            <li>Information about sharing, withdrawal of consent and review of relevant decisions.</li>
          </ul>
          <p>
            Contact <a href={`mailto:${LEGAL_CONTACTS.privacy}`}>{LEGAL_CONTACTS.privacy}</a> to
            exercise these rights. We verify identity before disclosure and respond within the legal
            deadlines; a complete access statement is provided within up to 15 days when applicable.
          </p>
          <h2>6. Retention</h2>
          <ul>
            <li>Active account data: for the duration of the relationship.</li>
            <li>
              Financial and tax records: for the legally required period, generally up to five years
              after closure.
            </li>
            <li>Identity evidence: only for the period needed for age assurance, fraud, disputes and legal duties.</li>
            <li>Security logs: normally up to six months, or longer when linked to an incident or legal hold.</li>
            <li>Reports, consent and moderation evidence: while needed to protect victims, exercise rights or comply with law.</li>
          </ul>
          <h2>7. Security</h2>
          <p>
            We use encryption in transit and at rest, role-based access controls, optional 2FA, and
            security logging. Relevant incidents are assessed and reported to the ANPD and affected
            people within the applicable deadline, currently three business days when the regulation
            requires notice.
          </p>
          <h2>8. Cookies</h2>
          <p>
            We use essential storage for authentication and preferences. On Fanlira Links pages,
            creator-configured measurement tags from Meta, Google, TikTok, Pinterest or Snapchat may
            load only after the visitor expressly accepts marketing cookies. These tags may receive
            page-view, campaign and link-click data, but Fanlira does not send private messages,
            payment details, email or phone data through this integration. Consent can be withdrawn
            at any time.
          </p>
          <Button type="button" variant="outline" onClick={openCookieSettings}>
            Manage cookie preferences
          </Button>
          <h2>9. International transfers</h2>
          <p>
            Some providers may process data outside Brazil. Transfers use a mechanism permitted by
            the LGPD and ANPD Resolution 19/2024, including adequacy decisions or approved
            contractual safeguards when applicable.
          </p>
          <h2>10. Adults only and decisions</h2>
          <p>
            Fanlira is not intended for minors. Suspected minor accounts are blocked and the minimum
            evidence required may be preserved for protection and legal cooperation. Age, fraud and
            moderation signals can support a decision, but the MVP uses authorized human review for
            identity and adult-content approvals. Affected users may request review unless prohibited
            by law or victim-safety requirements.
          </p>
          <h2>11. Changes</h2>
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
          Última atualização: {formatLegalVersion(CURRENT_PRIVACY_VERSION, "pt")}
        </p>

        <p>
          Esta política descreve como tratamos seus dados pessoais em conformidade com a Lei Geral
          de Proteção de Dados (Lei 13.709/2018 — LGPD).
        </p>

        <h2>1. Controlador</h2>
        <p>
          {controller} atua como Controladora dos dados pessoais. Canal de privacidade:{" "}
          <a href={`mailto:${LEGAL_CONTACTS.privacy}`}>{LEGAL_CONTACTS.privacy}</a>.
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
            <strong>Verificação de idade e KYC:</strong> documento oficial e selfie atual,
            armazenados em bucket privado e criptografado, com acesso restrito a revisores de
            compliance autorizados.
          </li>
          <li>
            <strong>Verificação do comprador:</strong> nome completo, nascimento, CPF, telefone e
            resultado ou evidência necessária para confirmar identidade e maioridade.
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
          <li>
            <strong>Segurança e atendimento:</strong> denúncias, recursos, consentimentos, decisões
            de moderação, chamados e evidências preservadas para apuração.
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
            <strong>Exercício regular de direitos e proteção da vida:</strong> disputas, preservação
            de evidência, proteção de vítimas e resposta urgente de segurança.
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
        <p>
          Não vendemos dados pessoais. O acesso é limitado ao necessário e pode envolver:
        </p>
        <ul>
          <li>Processador de pagamento Impulse Pay;</li>
          <li>Provedores de infraestrutura (cloud, e-mail transacional);</li>
          <li>
            Revisores internos autorizados, somente com os documentos e mídias necessários para
            verificação de idade, identidade e segurança do conteúdo;
          </li>
          <li>
            Provedores de mensuração de publicidade configurados pela criadora, somente após o
            consentimento de marketing;
          </li>
          <li>Autoridades públicas, mediante ordem judicial ou requisição legal válida.</li>
        </ul>
        <p>
          Os principais provedores atuais incluem Supabase (banco, autenticação e armazenamento
          privado), Cloudflare (entrega e segurança), Hostinger (e-mail transacional) e Impulse Pay
          (pagamentos e saques). Os avisos de privacidade próprios desses fornecedores também se
          aplicam ao tratamento que realizam.
        </p>

        <h2>5. Seus direitos (art. 18 LGPD)</h2>
        <ul>
          <li>Confirmação de tratamento e acesso aos seus dados;</li>
          <li>Correção de dados incompletos ou desatualizados;</li>
          <li>Anonimização, bloqueio ou eliminação de dados desnecessários;</li>
          <li>Portabilidade dos dados a outro fornecedor;</li>
          <li>Eliminação dos dados tratados com seu consentimento;</li>
          <li>Revogação do consentimento.</li>
          <li>Informação sobre compartilhamento e revisão de decisões relevantes.</li>
        </ul>
        <p>
          Para exercer qualquer direito, escreva para{" "}
          <a href={`mailto:${LEGAL_CONTACTS.privacy}`}>{LEGAL_CONTACTS.privacy}</a>. Confirmamos a
          identidade antes de entregar dados e respondemos nos prazos legais; a declaração completa
          de acesso é fornecida em até 15 dias quando aplicável.
        </p>

        <h2>6. Retenção</h2>
        <ul>
          <li>Conta ativa: enquanto durar o vínculo.</li>
          <li>Dados financeiros e fiscais: pelo prazo legal, em regra até 5 anos após o encerramento.</li>
          <li>Provas de identidade: somente enquanto necessárias para maioridade, fraude, disputas e deveres legais.</li>
          <li>Logs de segurança: em regra até 6 meses, ou mais quando ligados a incidente ou retenção legal.</li>
          <li>Denúncias, consentimentos e moderação: enquanto necessários para proteger vítimas, exercer direitos ou cumprir a lei.</li>
        </ul>

        <h2>7. Segurança</h2>
        <p>
          Aplicamos criptografia em trânsito (HTTPS/TLS) e em repouso, controle de acesso por papéis
          (RLS), autenticação de dois fatores e registros de segurança. Incidentes relevantes são
          avaliados e comunicados à ANPD e aos titulares no prazo aplicável, atualmente de três dias
          úteis quando a regulamentação exigir notificação.
        </p>

        <h2>8. Cookies</h2>
        <p>
          Usamos armazenamento essencial para autenticação e preferências. Nas páginas Fanlira
          Links, tags de medição configuradas pela criadora — Meta, Google, TikTok, Pinterest ou
          Snapchat — podem carregar somente depois que o visitante aceitar expressamente cookies de
          marketing. Essas tags podem receber dados de visualização, campanha e clique nos links,
          mas a Fanlira não envia mensagens privadas, dados de pagamento, e-mail ou telefone por
          essa integração. O consentimento pode ser revogado a qualquer momento.
        </p>
        <Button type="button" variant="outline" onClick={openCookieSettings}>
          Gerenciar preferências de cookies
        </Button>

        <h2>9. Transferência internacional</h2>
        <p>
          Alguns provedores podem tratar dados fora do Brasil. A transferência utiliza mecanismo
          permitido pela LGPD e pela Resolução CD/ANPD nº 19/2024, incluindo decisão de adequação ou
          cláusulas contratuais aprovadas quando aplicável.
        </p>

        <h2>10. Uso adulto e decisões</h2>
        <p>
          A Fanlira não é destinada a menores. Contas suspeitas são bloqueadas e a evidência mínima
          necessária pode ser preservada para proteção e cooperação legal. Sinais de idade, fraude e
          moderação podem apoiar decisões, mas no MVP identidade e conteúdo adulto passam por revisão
          humana autorizada. O afetado pode pedir revisão, salvo impedimento legal ou risco de
          revitimização.
        </p>

        <h2>11. Alterações</h2>
        <p>
          Podemos atualizar esta política. Mudanças relevantes serão comunicadas por e-mail ou aviso
          na plataforma.
        </p>
      </article>
    </AppShell>
  );
}
