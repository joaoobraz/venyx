import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso" },
      { name: "description", content: "Termos de uso da plataforma para criadoras e assinantes maiores de 18 anos." },
    ],
  }),
});

function TermsPage() {
  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">Última atualização: {new Date().toLocaleDateString("pt-BR")}</p>

        <h2>1. Aceitação dos Termos</h2>
        <p>
          Ao criar uma conta ou acessar a plataforma, você declara ter lido, entendido e concordado integralmente com
          estes Termos de Uso e com a nossa <Link to="/privacy" className="underline">Política de Privacidade</Link>.
          Caso não concorde, não utilize o serviço.
        </p>

        <h2>2. Idade Mínima — 18+</h2>
        <p>
          Esta é uma plataforma destinada <strong>exclusivamente a maiores de 18 anos</strong>. Ao se cadastrar você
          declara, sob as penas da lei, possuir idade mínima de 18 anos. O acesso por menores é estritamente proibido
          e a plataforma poderá solicitar verificação de idade a qualquer momento. Conteúdo adulto só pode ser
          publicado por criadoras com KYC aprovado.
        </p>

        <h2>3. Cadastro e Conta</h2>
        <ul>
          <li>Você é responsável por manter a confidencialidade da sua senha e por todas as atividades na sua conta.</li>
          <li>É proibido criar contas falsas, se passar por terceiros ou compartilhar credenciais.</li>
          <li>Recomendamos ativar autenticação de dois fatores (2FA) em Configurações → Segurança.</li>
        </ul>

        <h2>4. Conteúdo do Usuário</h2>
        <p>Ao publicar conteúdo, você declara e garante que:</p>
        <ul>
          <li>É o titular dos direitos ou tem autorização expressa de todas as pessoas retratadas;</li>
          <li>Todas as pessoas retratadas são maiores de 18 anos e consentiram com a publicação;</li>
          <li>O conteúdo não viola leis, direitos autorais, marcas, privacidade ou direito de imagem de terceiros.</li>
        </ul>
        <p><strong>É terminantemente proibido:</strong></p>
        <ul>
          <li>Conteúdo envolvendo menores de 18 anos em qualquer contexto sexual ou sugestivo;</li>
          <li>Conteúdo não consensual (revenge porn, deepfakes, hidden cam);</li>
          <li>Violência real, zoofilia, necrofilia, incesto, escatologia ou apologia ao crime;</li>
          <li>Tráfico de pessoas, prostituição ou aliciamento;</li>
          <li>Promoção de drogas, armas, ou de qualquer atividade ilegal;</li>
          <li>Discurso de ódio, racismo, xenofobia, homofobia ou assédio.</li>
        </ul>
        <p>
          Você concede à plataforma licença não-exclusiva, mundial e gratuita para hospedar, exibir e distribuir o
          conteúdo conforme necessário para operar o serviço. Você mantém todos os direitos autorais sobre o seu
          conteúdo.
        </p>

        <h2>5. Pagamentos, Assinaturas e PPV</h2>
        <ul>
          <li>Assinaturas, gorjetas e desbloqueios PPV são processados via gateway de pagamento parceiro.</li>
          <li>A plataforma retém uma taxa de serviço sobre cada transação (informada no painel da criadora).</li>
          <li>Saques exigem KYC aprovado e estão sujeitos ao valor mínimo e prazo do gateway.</li>
          <li>Estornos podem resultar em débito do saldo da criadora e suspensão temporária da conta.</li>
        </ul>

        <h2>6. Direito de Arrependimento</h2>
        <p>
          Por se tratar de conteúdo digital de fruição imediata, nos termos do art. 49, parágrafo único do CDC, o
          direito de arrependimento não se aplica após o desbloqueio/visualização do conteúdo. Cancelamentos de
          assinatura interrompem renovações futuras, mantendo o acesso até o fim do período já pago.
        </p>

        <h2>7. Suspensão e Encerramento</h2>
        <p>
          Podemos suspender ou encerrar contas que violem estes Termos, sem aviso prévio, especialmente em casos de
          conteúdo ilegal. Saldos retidos para investigação podem ser bloqueados até a conclusão da apuração.
        </p>

        <h2>8. Limitação de Responsabilidade</h2>
        <p>
          A plataforma é fornecida "como está". Não garantimos disponibilidade ininterrupta nem nos responsabilizamos
          por danos indiretos. Nossa responsabilidade total se limita ao valor pago pelo usuário nos últimos 6 meses.
        </p>

        <h2>9. Propriedade Intelectual e DMCA</h2>
        <p>
          Para reportar conteúdo infrator publicado em sites externos, consulte nossa{" "}
          <Link to="/dmca" className="underline">Política DMCA</Link>.
        </p>

        <h2>10. Foro e Lei Aplicável</h2>
        <p>
          Estes Termos são regidos pelas leis da República Federativa do Brasil. Fica eleito o foro da comarca da
          sede da plataforma para dirimir quaisquer controvérsias.
        </p>

        <h2>11. Contato</h2>
        <p>Dúvidas sobre estes Termos: <a href="mailto:suporte@plataforma.com">suporte@plataforma.com</a></p>
      </article>
    </AppShell>
  );
}
