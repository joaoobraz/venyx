import { createFileRoute } from "@tanstack/react-router";
import { AppShell } from "@/components/AppShell";
import { useI18n } from "@/lib/i18n";
import { LEGAL_CONTACTS, formatLegalVersion } from "@/lib/legal-config";
import { CURRENT_CREATOR_POLICY_VERSION } from "@/lib/legal-versions";

export const Route = createFileRoute("/content-policy")({
  component: ContentPolicyPage,
  head: () => ({
    meta: [
      { title: "Política de Conteúdo e Segurança — Fanlira" },
      {
        name: "description",
        content: "Regras de maioridade, consentimento, moderação e denúncias da Fanlira.",
      },
    ],
  }),
});

export function ContentPolicyPage() {
  const { locale } = useI18n();
  const english = locale === "en";
  const tr = (pt: string, en: string) => (english ? en : pt);

  return (
    <AppShell>
      <article className="prose prose-invert mx-auto max-w-3xl px-4 py-10">
        <h1>{tr("Política de Conteúdo e Segurança", "Content and Safety Policy")}</h1>
        <p className="text-sm text-muted-foreground">
          {tr("Vigência e última atualização", "Effective and last updated")}: {" "}
          {formatLegalVersion(CURRENT_CREATOR_POLICY_VERSION, english ? "en" : "pt")}
        </p>

        <h2>{tr("1. Regra central", "1. Core rule")}</h2>
        <p>
          {tr(
            "A Fanlira aceita apenas conteúdo legal produzido e publicado por adultos verificados, com consentimento livre, específico e informado de todas as pessoas retratadas. Na dúvida, a possível vítima é protegida e o material permanece bloqueado até esclarecimento.",
            "Fanlira accepts only lawful content created and published by verified adults with the free, specific and informed consent of every depicted person. When in doubt, the potential victim is protected and the material remains blocked until resolved.",
          )}
        </p>

        <h2>{tr("2. Proibição absoluta envolvendo menores", "2. Absolute prohibition involving minors")}</h2>
        <ul>
          <li>{tr("Pessoa menor de 18 anos real, aparente, simulada, animada ou gerada por IA em contexto sexual, erótico ou sugestivo.", "Any real, apparent, simulated, animated or AI-generated person under 18 in a sexual, erotic or suggestive context.")}</li>
          <li>{tr("Grooming, aliciamento, sexualização, pedido de material, contato ou encontro com menor.", "Grooming, solicitation, sexualization, requests for material, contact or meetings with a minor.")}</li>
          <li>{tr("Conteúdo antigo de pessoa hoje adulta, caso ela fosse menor na data da produção.", "Older content of a person who is now an adult if they were under 18 when it was made.")}</li>
        </ul>

        <h2>{tr("3. Consentimento e autenticidade", "3. Consent and authenticity")}</h2>
        <ul>
          <li>{tr("É proibido material íntimo não consentido, vazado, roubado, obtido por câmera oculta ou mantido após revogação juridicamente aplicável.", "Non-consensual, leaked, stolen, hidden-camera or unlawfully retained intimate material is prohibited.")}</li>
          <li>{tr("É proibido deepfake sexual, montagem realista ou uso de rosto, voz ou corpo de terceiro sem autorização verificável.", "Sexual deepfakes, realistic composites or use of another person's face, voice or body without verifiable authorization are prohibited.")}</li>
          <li>{tr("Coação, incapacidade de consentir, intoxicação, inconsciência, tráfico, exploração ou violência sexual resultam em remoção imediata e preservação de evidência.", "Coercion, inability to consent, intoxication, unconsciousness, trafficking, exploitation or sexual violence trigger immediate removal and evidence preservation.")}</li>
        </ul>

        <h2>{tr("4. Outras proibições", "4. Other prohibitions")}</h2>
        <ul>
          <li>{tr("Prostituição, intermediação de serviços sexuais, encontros pagos ou tráfico de pessoas.", "Prostitution, brokering sexual services, paid meetings or human trafficking.")}</li>
          <li>{tr("Violência real, tortura, necrofilia, zoofilia, incesto real, incentivo à automutilação ou ato sem condições de segurança.", "Real violence, torture, necrophilia, bestiality, real incest, encouraged self-harm or unsafe acts.")}</li>
          <li>{tr("Ameaça, chantagem, extorsão, perseguição, ódio, fraude, arma ou atividade criminosa.", "Threats, blackmail, extortion, stalking, hate, fraud, weapons or criminal activity.")}</li>
          <li>{tr("Dados pessoais de terceiro, documentos, endereço, telefone ou informação financeira sem base legal.", "Third-party personal data, documents, address, phone or financial information without a lawful basis.")}</li>
          <li>{tr("Violação de direitos autorais, marca, imagem, privacidade ou ordem judicial.", "Copyright, trademark, image, privacy or court-order violations.")}</li>
        </ul>

        <h2>{tr("5. Provas exigidas da criadora", "5. Evidence required from creators")}</h2>
        <p>
          {tr(
            "A criadora deve conservar e apresentar quando solicitada: documento e prova de maioridade de cada participante; consentimento para participar, gravar e distribuir; data de produção; e autorização de direitos de imagem. Essas provas só devem ser enviadas pelo fluxo privado indicado pela Fanlira.",
            "Creators must retain and provide on request: identity and age evidence for every participant; consent to participate, record and distribute; production date; and image-rights authorization. This evidence must only be sent through Fanlira's designated private flow.",
          )}
        </p>

        <h2>{tr("6. Moderação e medidas", "6. Moderation and measures")}</h2>
        <p>
          {tr(
            "Todo upload adulto pode ficar pendente e invisível até revisão. Conforme gravidade e reincidência, a Fanlira pode limitar, remover, preservar, bloquear pagamento, suspender ou encerrar. Decisões registram motivo, revisor e data; o recurso é aceito pelo suporte, salvo impedimento legal ou risco de revitimização.",
            "Adult uploads may remain pending and invisible until review. Depending on severity and recurrence, Fanlira may restrict, remove, preserve, hold payments, suspend or terminate. Decisions record reason, reviewer and date; appeals are accepted through support unless legally prohibited or unsafe for a victim.",
          )}
        </p>

        <h2>{tr("7. Denúncia prioritária", "7. Priority reports")}</h2>
        <p>
          {tr(
            "Para menoridade, conteúdo íntimo não consentido, exploração ou risco imediato, use o botão Denunciar ou escreva para",
            "For suspected minors, non-consensual intimate content, exploitation or imminent harm, use the Report button or write to",
          )}{" "}
          <a href={`mailto:${LEGAL_CONTACTS.abuse}`}>{LEGAL_CONTACTS.abuse}</a>. {" "}
          {tr(
            "Informe URL, perfil, motivo e data, se possível. Não baixe nem redistribua material potencialmente ilegal. Emergências devem ser levadas também às autoridades locais.",
            "Include the URL, profile, reason and date if possible. Do not download or redistribute potentially illegal material. Emergencies should also be reported to local authorities.",
          )}
        </p>

        <h2>{tr("8. Preservação e autoridades", "8. Preservation and authorities")}</h2>
        <p>
          {tr(
            "A Fanlira pode preservar cópia restrita, metadados, consentimentos e registros de acesso para proteger vítimas, apurar fraude, cumprir ordem legal ou cooperar com autoridades. A preservação não significa republicação e segue controles de acesso e retenção aplicáveis.",
            "Fanlira may preserve a restricted copy, metadata, consent and access logs to protect victims, investigate fraud, comply with lawful orders or cooperate with authorities. Preservation is not republication and follows applicable access and retention controls.",
          )}
        </p>
      </article>
    </AppShell>
  );
}
