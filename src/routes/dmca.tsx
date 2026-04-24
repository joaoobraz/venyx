import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

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
          uma notificação por escrito para <a href="mailto:dmca@plataforma.com">dmca@plataforma.com</a> contendo:
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
          <a href="mailto:abuse@plataforma.com">abuse@plataforma.com</a> com:
        </p>
        <ul>
          <li>URL do conteúdo;</li>
          <li>Descrição da infração;</li>
          <li>Sua identificação e contato.</li>
        </ul>
        <p>Conteúdo claramente ilegal é removido em até 24h e reportado às autoridades competentes.</p>

        <h2>Contranotificação</h2>
        <p>
          Se você é a criadora cujo conteúdo foi removido por engano, pode enviar uma contranotificação para{" "}
          <a href="mailto:dmca@plataforma.com">dmca@plataforma.com</a> com identificação, descrição do material e
          declaração de boa-fé. O conteúdo poderá ser restaurado em 10–14 dias úteis se o reclamante original não
          ingressar com ação judicial.
        </p>

        <h2>Prazos de resposta</h2>
        <ul>
          <li>Denúncia de conteúdo ilegal: até 24h.</li>
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
