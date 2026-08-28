import { createFileRoute, Link } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import {
  LEGAL_CONTACTS,
  formatLegalVersion,
  legalEntityDescription,
} from "@/lib/legal-config";
import { CURRENT_TERMS_VERSION } from "@/lib/legal-versions";

export const Route = createFileRoute("/terms")({
  component: TermsPage,
  head: () => ({
    meta: [
      { title: "Termos de Uso — Fanlira" },
      {
        name: "description",
        content:
          "Regras de uso, maioridade, conteúdo, pagamentos e segurança da plataforma Fanlira.",
      },
    ],
  }),
});

function ContactLinks({ english }: { english: boolean }) {
  return (
    <ul>
      <li>
        {english ? "Support and consumers" : "Atendimento e consumidor"}: {" "}
        <a href={`mailto:${LEGAL_CONTACTS.support}`}>{LEGAL_CONTACTS.support}</a>
      </li>
      <li>
        {english ? "Privacy and data protection" : "Privacidade e proteção de dados"}: {" "}
        <a href={`mailto:${LEGAL_CONTACTS.privacy}`}>{LEGAL_CONTACTS.privacy}</a>
      </li>
      <li>
        {english
          ? "Safety, suspected minors or non-consensual material"
          : "Segurança, suspeita de menoridade ou conteúdo não consentido"}
        : <a href={`mailto:${LEGAL_CONTACTS.abuse}`}>{LEGAL_CONTACTS.abuse}</a>
      </li>
    </ul>
  );
}

export function TermsPage() {
  const { locale } = useI18n();
  const operator = legalEntityDescription();
  const english = locale === "en";

  if (english) {
    return (
      <AppShell>
        <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
          <h1>Terms of Use</h1>
          <p className="text-sm text-muted-foreground">
            Effective and last updated: {formatLegalVersion(CURRENT_TERMS_VERSION, "en")}
          </p>

          <h2>1. Operator, scope and acceptance</h2>
          <p>
            Fanlira is an adult creator platform operated by <strong>{operator}</strong>. These
            Terms govern visitors, subscribers, buyers and creators. By creating an account,
            accepting a checkout or using the service, you agree to these Terms, the {" "}
            <Link to="/privacy" className="underline">Privacy Policy</Link>, the {" "}
            <Link to="/content-policy" className="underline">Content and Safety Policy</Link>, and
            the rules shown at purchase. Mandatory consumer rights always prevail.
          </p>

          <h2>2. Adults only and reliable verification</h2>
          <p>
            The service is exclusively for people aged 18 or older. Self-declaration alone does not
            unlock adult material. Fanlira may require official identification, a current selfie,
            CPF validation or another high-confidence method before showing protected content,
            previews, titles or descriptions, and may repeat the check when risk requires it.
            Suspected minors are blocked and handled under applicable law.
          </p>

          <h2>3. Account and security</h2>
          <ul>
            <li>Provide accurate, current and complete information and keep it updated.</li>
            <li>Do not impersonate anyone, sell an account, share credentials or evade a suspension.</li>
            <li>You are responsible for account activity until you notify Fanlira of a compromise.</li>
            <li>Fanlira may require MFA, reauthentication or additional verification.</li>
          </ul>

          <h2>4. Creator eligibility and depicted persons</h2>
          <p>
            A creator must pass identity, age and payout checks before publishing or withdrawing.
            For every depicted person, the creator must keep verifiable evidence of adulthood,
            identity, informed consent to the act, recording and distribution, and image rights.
            Fanlira may request this evidence and quarantine content while reviewing it.
          </p>

          <h2>5. Content ownership and license</h2>
          <p>
            Users retain their intellectual property. Uploading grants Fanlira a non-exclusive,
            worldwide, royalty-free, sublicensable license limited to hosting, reproducing,
            technically adapting, moderating, protecting, displaying and distributing the content
            to operate and promote the service. It ends after deletion except for lawful retention,
            backups, disputes and previously authorized uses.
          </p>

          <h2>6. Prohibited content and conduct</h2>
          <p>
            The {" "}<Link to="/content-policy" className="underline">Content and Safety Policy</Link>
            is part of these Terms. Prohibited material includes sexual or suggestive content
            involving minors; non-consensual intimate material; sexual deepfakes; hidden-camera
            material; coercion, trafficking, grooming or sexual services; real violence; bestiality;
            exposed personal data; fraud; threats, hate or extortion; intellectual-property
            infringement; and attempts to move prohibited contact or payment off-platform.
          </p>

          <h2>7. Moderation, reporting and appeals</h2>
          <p>
            Uploads may remain unavailable until human review. Fanlira may restrict, remove,
            preserve, suspend or terminate when content, conduct, law or safety risk requires it.
            Except where prohibited or unsafe, the affected user receives a reason and may appeal
            through support. Reports involving minors, non-consensual material or imminent harm take
            priority and may be sent to competent authorities.
          </p>

          <h2>8. Purchases, Pix, subscriptions, PPV and gifts</h2>
          <ul>
            <li>Price, scope, duration and payment method are shown before confirmation.</li>
            <li>Pix charges are processed by the provider identified at checkout.</li>
            <li>Automatic renewal occurs only when expressly displayed and authorized; otherwise a new payment is required.</li>
            <li>PPV grants personal, limited and non-transferable access under the displayed offer.</li>
            <li>Wishlist “gifts” are symbolic monetary support; unless checkout expressly says otherwise, no physical product is shipped and the creator receives the applicable balance.</li>
            <li>Do not pay outside Fanlira for a transaction offered on the platform.</li>
          </ul>

          <h2>9. Cancellation, withdrawal, refunds and disputes</h2>
          <p>
            Future renewals can be canceled at any time; access ordinarily remains until the paid
            period ends. Withdrawal, refunds, duplicate charges, non-delivery, unauthorized payment
            and other disputes are assessed under the Brazilian Consumer Protection Code, including
            mandatory deadlines and remedies. A “no discretionary refunds” rule never removes
            legally non-waivable rights.
          </p>

          <h2>10. Creator balance and withdrawals</h2>
          <p>
            The dashboard shows gross amount, platform share and available balance. The payment
            provider fee is borne by Fanlira under the current commercial policy. The first creator
            withdrawal per calendar day is free; withdrawals 2 through 5 cost R$3.00 each. The
            minimum is R$30.00 and the daily limit is five. Fraud reviews, chargebacks, legal orders
            or identity mismatch may delay or reserve funds. Changes apply only to future operations
            after prior notice.
          </p>

          <h2>11. Taxes and creator independence</h2>
          <p>
            Creators act independently and are responsible for declarations, taxes, permits and
            professional duties. Fanlira does not promise revenue, employment or a minimum audience
            and may make legally required withholdings.
          </p>

          <h2>12. Intellectual property notices</h2>
          <p>
            Notices and counter-notices follow the {" "}
            <Link to="/dmca" className="underline">Copyright and DMCA Policy</Link>. Abuse of the
            process may result in account action and legal liability.
          </p>

          <h2>13. Privacy and evidence preservation</h2>
          <p>
            Personal data is processed under the Privacy Policy. Fanlira may preserve account,
            payment, consent, moderation and access records when necessary for fraud prevention,
            legal compliance, victim protection, disputes or court orders, with restricted access.
          </p>

          <h2>14. Availability and third parties</h2>
          <p>
            Fanlira uses third-party infrastructure and payment services and does not guarantee
            uninterrupted operation. Maintenance, provider failure, security response or force
            majeure may temporarily affect the service. Reasonable restoration and incident
            communication measures will be taken.
          </p>

          <h2>15. Liability</h2>
          <p>
            To the extent permitted by law, Fanlira is not responsible for user misconduct,
            unauthorized redistribution by third parties, indirect losses or events beyond its
            reasonable control. Nothing excludes liability or remedies that mandatory consumer,
            data-protection or other law does not allow to be limited.
          </p>

          <h2>16. Suspension and termination</h2>
          <p>
            Users may request closure through privacy controls. Fanlira may impose proportionate
            preventive or final measures for breach, fraud, safety risk or legal duty. Termination
            does not erase accrued payment, evidence, dispute or cooperation duties.
          </p>

          <h2>17. Changes, governing law and venue</h2>
          <p>
            Material changes are notified before taking effect and may require renewed acceptance.
            Brazilian law governs, preserving mandatory consumer protections and venue.
          </p>

          <h2>18. Contact</h2>
          <ContactLinks english />
        </article>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>Termos de Uso</h1>
        <p className="text-sm text-muted-foreground">
          Vigência e última atualização: {formatLegalVersion(CURRENT_TERMS_VERSION, "pt")}
        </p>

        <h2>1. Operadora, escopo e aceitação</h2>
        <p>
          A Fanlira é uma plataforma digital para criadoras adultas operada por {" "}
          <strong>{operator}</strong>. Estes Termos regem visitantes, assinantes, compradores e
          criadoras. Ao criar conta, aceitar um checkout ou usar o serviço, você concorda com estes
          Termos, a <Link to="/privacy" className="underline">Política de Privacidade</Link>, a {" "}
          <Link to="/content-policy" className="underline">Política de Conteúdo e Segurança</Link> e
          as condições exibidas na compra. Direitos obrigatórios do consumidor sempre prevalecem.
        </p>

        <h2>2. Uso exclusivo por adultos e verificação confiável</h2>
        <p>
          O serviço é exclusivo para pessoas com 18 anos ou mais. A simples autodeclaração não
          libera material adulto. A Fanlira pode exigir documento oficial, selfie atual, validação
          de CPF ou outro método de alta confiabilidade antes de exibir conteúdo protegido,
          inclusive prévias, títulos ou descrições, e repetir a verificação quando houver risco.
          Suspeitas de menoridade resultam em bloqueio e tratamento conforme a lei.
        </p>

        <h2>3. Conta e segurança</h2>
        <ul>
          <li>Forneça informações verdadeiras, completas e atualizadas.</li>
          <li>Não se passe por terceiros, venda contas, compartilhe credenciais ou contorne suspensão.</li>
          <li>Você responde pela atividade da conta até comunicar comprometimento à Fanlira.</li>
          <li>A Fanlira pode exigir MFA, reautenticação ou verificação adicional.</li>
        </ul>

        <h2>4. Elegibilidade da criadora e pessoas retratadas</h2>
        <p>
          A criadora precisa concluir identidade, maioridade e cadastro de recebimento antes de
          publicar ou sacar. Para cada pessoa retratada, deve manter prova verificável de maioridade,
          identidade, consentimento informado para o ato, gravação e distribuição, e direitos de uso
          de imagem. A Fanlira pode solicitar as provas e manter o conteúdo indisponível durante a
          análise.
        </p>

        <h2>5. Titularidade e licença do conteúdo</h2>
        <p>
          O usuário mantém sua propriedade intelectual. Ao enviar conteúdo, concede à Fanlira
          licença não exclusiva, mundial, gratuita e sublicenciável, limitada a hospedar, reproduzir,
          adaptar formatos técnicos, moderar, proteger, exibir e distribuir o material para operar e
          divulgar o serviço. A licença termina após a exclusão, salvo retenção legal, backups,
          disputas e usos já autorizados.
        </p>

        <h2>6. Condutas e conteúdos proibidos</h2>
        <p>
          As proibições da {" "}
          <Link to="/content-policy" className="underline">Política de Conteúdo e Segurança</Link>
          integram estes Termos. Incluem material sexual ou sugestivo envolvendo menor; conteúdo
          íntimo não consentido; deepfake sexual; câmera oculta; coação, tráfico, aliciamento ou
          serviços sexuais; violência real; zoofilia; exposição de dados pessoais; fraude; ódio,
          ameaça ou extorsão; violação autoral; e tentativa de levar contatos ou pagamentos
          proibidos para fora da plataforma.
        </p>

        <h2>7. Moderação, denúncias e recurso</h2>
        <p>
          Envios podem permanecer invisíveis até revisão humana. A Fanlira pode reduzir alcance,
          remover, preservar, suspender ou encerrar quando conteúdo, conduta, lei ou risco de
          segurança exigirem. Salvo impedimento legal ou risco à vítima, o afetado receberá o motivo
          e poderá recorrer pelo suporte. Denúncias de menoridade, conteúdo não consentido ou perigo
          imediato têm prioridade e podem ser comunicadas às autoridades competentes.
        </p>

        <h2>8. Compras, Pix, assinaturas, PPV e mimos</h2>
        <ul>
          <li>Preço, objeto, duração e forma de pagamento são mostrados antes da confirmação.</li>
          <li>As cobranças Pix são processadas pelo parceiro informado no checkout.</li>
          <li>Renovação automática só ocorre quando expressamente exibida e autorizada; nos demais casos, exige novo pagamento.</li>
          <li>PPV concede acesso pessoal, limitado e intransferível nas condições da oferta.</li>
          <li>“Mimos” e itens da lista de desejos representam apoio financeiro simbólico: salvo indicação expressa no checkout, nenhum produto físico será entregue e a criadora recebe o saldo aplicável.</li>
          <li>Não pague fora da Fanlira por transação oferecida na plataforma.</li>
        </ul>

        <h2>9. Cancelamento, arrependimento, reembolso e contestação</h2>
        <p>
          Renovações futuras podem ser canceladas a qualquer momento. Em regra, o acesso permanece
          até o fim do período pago. Pedidos de arrependimento, reembolso, cobrança duplicada, não
          entrega, pagamento não autorizado e demais disputas são analisados conforme o Código de
          Defesa do Consumidor, inclusive seus prazos e remédios obrigatórios. Qualquer regra de “sem
          reembolso por liberalidade” não elimina direitos legalmente irrenunciáveis.
        </p>

        <h2>10. Saldo e saques da criadora</h2>
        <p>
          O painel informa valor bruto, participação da plataforma e saldo disponível. A taxa da
          adquirente é absorvida pela Fanlira na política comercial atual. O primeiro saque da
          criadora em cada dia civil é gratuito; do segundo ao quinto, custa R$ 3,00 por saque. O
          mínimo é R$ 30,00 e o limite diário é de cinco solicitações. Análise de fraude, chargeback,
          ordem legal ou divergência cadastral pode atrasar ou reservar valores. Mudanças de regra
          valem apenas para operações futuras e serão informadas previamente.
        </p>

        <h2>11. Tributos e independência da criadora</h2>
        <p>
          A criadora atua de forma independente e responde por declarações, tributos, licenças e
          obrigações profissionais. A Fanlira não promete renda, emprego ou audiência mínima e fará
          retenções que a lei exigir.
        </p>

        <h2>12. Propriedade intelectual</h2>
        <p>
          Notificações e contranotificações seguem a {" "}
          <Link to="/dmca" className="underline">Política de Direitos Autorais e DMCA</Link>. O uso
          abusivo do mecanismo pode gerar medidas na conta e responsabilidade legal.
        </p>

        <h2>13. Privacidade e preservação de evidências</h2>
        <p>
          Dados pessoais são tratados conforme a Política de Privacidade. A Fanlira pode preservar
          registros de conta, pagamento, consentimento, moderação e acesso quando necessário para
          prevenção a fraude, cumprimento legal, proteção de vítima, disputa ou ordem judicial, com
          acesso restrito.
        </p>

        <h2>14. Disponibilidade e terceiros</h2>
        <p>
          A Fanlira usa infraestrutura e pagamentos de terceiros e não garante funcionamento
          ininterrupto. Manutenção, falha de fornecedor, resposta de segurança ou força maior podem
          afetar temporariamente o serviço. Serão adotadas medidas razoáveis de restauração e
          comunicação de incidentes relevantes.
        </p>

        <h2>15. Responsabilidade</h2>
        <p>
          No limite permitido pela lei, a Fanlira não responde por conduta de usuários,
          redistribuição não autorizada por terceiros, prejuízos indiretos ou eventos fora de seu
          controle razoável. Nada nestes Termos exclui responsabilidade ou remédios que a legislação
          consumerista, de proteção de dados ou outra norma obrigatória não permita limitar.
        </p>

        <h2>16. Suspensão e encerramento</h2>
        <p>
          O usuário pode solicitar o encerramento pelos controles de privacidade. A Fanlira pode
          adotar medida preventiva ou definitiva, proporcional à violação, fraude, risco de segurança
          ou dever legal. O encerramento não apaga obrigações de pagamento, preservação de evidência,
          disputa ou cooperação legal já existentes.
        </p>

        <h2>17. Alterações, lei e foro</h2>
        <p>
          Mudanças relevantes serão comunicadas antes da vigência e poderão exigir novo aceite.
          Aplicam-se as leis da República Federativa do Brasil, preservados o foro e as proteções
          obrigatórias do consumidor.
        </p>

        <h2>18. Contato</h2>
        <ContactLinks english={false} />
      </article>
    </AppShell>
  );
}
