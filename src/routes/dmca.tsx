import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/dmca")({
  component: DmcaPage,
  head: () => ({
    meta: [
      { title: "Política DMCA" },
      { name: "description", content: "Como reportar conteúdo vazado ou infrator." },
    ],
  }),
});

function DmcaPage() {
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Política DMCA / Reporte de Vazamento</h1>
        <p>
          Levamos a sério a proteção do conteúdo das nossas criadoras. Se você é a titular dos direitos
          e encontrou seu conteúdo publicado em outro site sem autorização, abra um chamado.
        </p>

        <h2>Como reportar</h2>
        <ol>
          <li>Faça login na sua conta de criadora.</li>
          <li>Vá em <Link to="/creator/dmca" className="underline">Painel → DMCA</Link>.</li>
          <li>Informe a URL onde o conteúdo está vazado e anexe evidência (print).</li>
          <li>Nossa equipe analisa e envia a notificação ao site infrator.</li>
        </ol>

        <h2>Não é criadora?</h2>
        <p>Para denúncias de conteúdo ilegal hospedado na nossa plataforma, escreva para abuse@plataforma.com com:</p>
        <ul>
          <li>URL do conteúdo;</li>
          <li>Descrição da infração;</li>
          <li>Sua identificação e contato;</li>
          <li>Declaração de boa-fé.</li>
        </ul>

        <h2>Resposta</h2>
        <p>Respondemos em até 72h úteis. Conteúdo claramente ilegal é removido imediatamente.</p>
      </article>
    </AppShell>
  );
}
