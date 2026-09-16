# Entrega para revisão jurídica

Solicitar parecer escrito antes da abertura pública sobre:

- Termos de uso, política de privacidade e bases legais LGPD.
- Verificação de maioridade, KYC e retenção de documentos.
- Conteúdo não consentido, suspeita de menor e preservação de evidências.
- Procedimento de denúncia, remoção, contranotificação e DMCA.
- Regras de assinatura, renovação, cancelamento e conteúdo digital.
- Política comercial sem estorno voluntário, incluindo exceções obrigatórias por lei ou fraude.
- Responsabilidade da criadora pelos direitos do conteúdo e uso de imagem.
- Prazos de exportação/exclusão e hipóteses de retenção obrigatória.
- Identificação da operadora, sede e representante legal no Brasil, inclusive requisitos do Decreto
  12.975/2026 e do comércio eletrônico. Confirmar quais dados devem ficar publicamente acessíveis.
- Adequação ao ECA Digital (Lei 15.211/2025 e Decreto 12.880/2026), especialmente verificação de
  idade de alta confiabilidade antes de qualquer conteúdo, prévia, título ou legenda pornográfica.
- Obrigações sistêmicas de plataforma, notificação, recurso, transparência e canal permanente de
  denúncia dos Decretos 12.975/2026 e 12.976/2026.
- Prazo e procedimento de comunicação de incidente de segurança à ANPD e aos titulares.
- Transferências internacionais conforme Resolução CD/ANPD nº 19/2024.

## Arquivos desta minuta

- `src/routes/terms.tsx` — versão `2026-08-22`.
- `src/routes/privacy.tsx` — versão `2026-08-22`.
- `src/routes/content-policy.tsx` — versão `2026-08-22`.
- `src/routes/dmca.tsx` — política autoral e canal de conteúdo ilegal.

## Decisões comerciais que precisam ser confirmadas

- A taxa da adquirente é absorvida pela Fanlira.
- Primeiro saque da criadora no dia gratuito; do segundo ao quinto, R$ 3,00 por saque.
- Saque mínimo de R$ 30,00 e limite de cinco solicitações por dia.
- Mimo/lista de desejos é apoio financeiro simbólico, sem entrega física, salvo oferta expressa.
- Pix recorrente só será prometido depois da liberação e teste do endpoint da Impulse Pay.

O parecer deve trazer versão/data de cada documento, responsável pela aprovação e lista de alterações. Depois da aprovação, atualizar as versões em `src/lib/legal-versions.ts` para forçar novo aceite quando necessário.
