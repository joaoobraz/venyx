import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { LEGAL_CONTACTS } from "@/lib/legal-config";

export const Route = createFileRoute("/dmca")({
  component: DmcaPage,
  head: () => ({
    meta: [
      { title: "Política DMCA" },
      { name: "description", content: "Como reportar conteúdo vazado, infrator ou ilegal hospedado em outros sites ou na nossa plataforma." },
    ],
  }),
});

function DmcaPage() {
  const { locale } = useI18n();
  if (locale === "en") {
    return (
      <AppShell>
        <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
          <h1>DMCA / Notice-and-Takedown Policy</h1>
          <p>
            We take creators' copyright and image rights seriously. This policy explains how to
            request removal of infringing content hosted here or leaked to another site.
          </p>
          <h2>For creators: content leaked to another site</h2>
          <ol>
            <li>Sign in to your creator account.</li>
            <li>Open <Link to="/creator/dmca" className="underline">Dashboard → DMCA</Link>.</li>
            <li>Provide the exact leaked-content URL and attach a screenshot.</li>
            <li>Our team reviews the request and sends a formal takedown notice to the site and its host or CDN.</li>
            <li>You receive status updates: pending → notified → resolved.</li>
          </ol>
          <h2>For third parties: infringing content on our platform</h2>
          <p>
            Copyright owners may email <a href={`mailto:${LEGAL_CONTACTS.dmca}`}>{LEGAL_CONTACTS.dmca}</a> with:
          </p>
          <ol>
            <li>Identification of the protected work;</li>
            <li>The exact URL of the allegedly infringing content;</li>
            <li>Your full contact information;</li>
            <li>A good-faith statement that the use was not authorized;</li>
            <li>A statement, under penalty of perjury, that the information is accurate and you are authorized to act;</li>
            <li>The physical or electronic signature of the owner or authorized representative.</li>
          </ol>
          <h2>Illegal content (non-DMCA)</h2>
          <p>
            Report content involving minors, non-consensual material, real violence, or trafficking
            immediately to <a href={`mailto:${LEGAL_CONTACTS.abuse}`}>{LEGAL_CONTACTS.abuse}</a>. Include the
            URL, a description, and your contact information. Credible reports involving a possible
            minor or non-consensual content are preventively restricted and triaged within 15 minutes.
          </p>
          <h2>Counter-notice</h2>
          <p>
            If your content was removed by mistake, email a counter-notice to{" "}
            <a href={`mailto:${LEGAL_CONTACTS.dmca}`}>{LEGAL_CONTACTS.dmca}</a> with identification, a
            description of the material, and a good-faith statement. Content may be restored in
            10–14 business days if the claimant does not begin legal proceedings.
          </p>
          <h2>Response times</h2>
          <ul>
            <li>Possible minor/non-consensual content: critical triage within 15 minutes.</li>
            <li>Standard DMCA request: up to 72 business hours.</li>
            <li>Counter-notice: 10–14 business days.</li>
          </ul>
          <h2>Repeat infringement</h2>
          <p>Accounts receiving multiple valid notices are permanently suspended under our repeat-infringer policy.</p>
        </article>
      </AppShell>
    );
  }
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Política DMCA / Notice-and-Takedown</h1>
        <p>
          Levamos a sério a proteção dos direitos autorais e da imagem das nossas criadoras. Esta política descreve
          como solicitar a remoção de conteúdo infrator, seja em sites externos (vazamento) ou hospedado na nossa
          plataforma.
        </p>

        <h2>Para criadoras: conteúdo vazado em outros sites</h2>
        <ol>
          <li>Faça login na sua conta de criadora.</li>
          <li>
            Acesse <Link to="/creator/dmca" className="underline">Painel → DMCA</Link>.
          </li>
          <li>Informe a URL exata onde o conteúdo está vazado e anexe evidência (print da página).</li>
          <li>Nossa equipe analisa e envia notificação formal (DMCA Takedown) ao site infrator e ao seu host/CDN.</li>
          <li>Você recebe atualização do status (pendente → notificado → resolvido).</li>
        </ol>

        <h2>Para terceiros: conteúdo infrator na nossa plataforma</h2>
        <p>
          Se você é titular de direitos autorais e acredita que conteúdo hospedado aqui infringe seus direitos, envie
          uma notificação por escrito para <a href={`mailto:${LEGAL_CONTACTS.dmca}`}>{LEGAL_CONTACTS.dmca}</a> contendo:
        </p>
        <ol>
          <li>Identificação da obra protegida (título, registro, link da obra original);</li>
          <li>URL exata do conteúdo infrator na nossa plataforma;</li>
          <li>Suas informações de contato (nome completo, endereço, telefone, e-mail);</li>
          <li>Declaração de boa-fé de que o uso não foi autorizado pelo titular;</li>
          <li>Declaração, sob pena de perjúrio, de que as informações são verdadeiras e que você está autorizado a agir em nome do titular;</li>
          <li>Assinatura física ou eletrônica do titular ou de seu representante legal.</li>
        </ol>

        <h2>Conteúdo ilegal (não-DMCA)</h2>
        <p>
          Para denúncias de conteúdo ilegal — especialmente envolvendo menores, não-consensual (revenge porn,
          deepfake), violência real ou tráfico — escreva imediatamente para{" "}
          <a href={`mailto:${LEGAL_CONTACTS.abuse}`}>{LEGAL_CONTACTS.abuse}</a> com:
        </p>
        <ul>
          <li>URL do conteúdo;</li>
          <li>Descrição da infração;</li>
          <li>Sua identificação e contato.</li>
        </ul>
        <p>
          Denúncias verossímeis envolvendo possível menor ou conteúdo não consentido são restringidas
          preventivamente e entram em triagem crítica em até 15 minutos.
        </p>

        <h2>Contranotificação</h2>
        <p>
          Se você é a criadora cujo conteúdo foi removido por engano, pode enviar uma contranotificação para{" "}
          <a href={`mailto:${LEGAL_CONTACTS.dmca}`}>{LEGAL_CONTACTS.dmca}</a> com identificação, descrição do material e
          declaração de boa-fé. O conteúdo poderá ser restaurado em 10–14 dias úteis se o reclamante original não
          ingressar com ação judicial.
        </p>

        <h2>Prazos de resposta</h2>
        <ul>
          <li>Possível menor/não consentido: triagem crítica em até 15 minutos.</li>
          <li>Solicitação DMCA padrão: até 72h úteis.</li>
          <li>Contranotificação: até 10–14 dias úteis.</li>
        </ul>

        <h2>Reincidência</h2>
        <p>
          Contas que recebem múltiplas notificações DMCA válidas são suspensas permanentemente, conforme nossa
          política de reincidentes (Three-Strikes).
        </p>
      </article>
    </AppShell>
  );
}
