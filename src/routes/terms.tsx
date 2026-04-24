import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso" },
      { name: "description", content: "Termos de uso da plataforma." },
    ],
  }),
});

function TermsPage() {
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString()}</p>

        <h2>1. Aceitação</h2>
        <p>Ao acessar a plataforma você concorda com estes termos. Se não concorda, não use o serviço.</p>

        <h2>2. Idade mínima</h2>
        <p>O serviço é destinado exclusivamente a maiores de 18 anos. Conteúdo adulto pode ser publicado por criadoras verificadas.</p>

        <h2>3. Conteúdo do usuário</h2>
        <p>Você é responsável pelo conteúdo que publica. É proibido conteúdo ilegal, violento, envolvendo menores, sem consentimento, ou que viole direitos de terceiros.</p>

        <h2>4. Pagamentos</h2>
        <p>Assinaturas, gorjetas e PPV são processados pela plataforma. Saques exigem KYC aprovado.</p>

        <h2>5. Suspensão</h2>
        <p>Podemos suspender contas que violem estes termos sem aviso prévio.</p>

        <h2>6. Contato</h2>
        <p>Dúvidas: suporte@plataforma.com</p>
      </article>
    </AppShell>
  );
}
