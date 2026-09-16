# Operação manual de KYC e moderação — MVP sem fornecedor pago

Este procedimento permite operar o piloto sem Sumsub, Veriff, Onfido ou serviço pago de
moderação. A economia é financeira, não operacional: todo item pendente exige decisão humana
antes de ser liberado.

## Regras obrigatórias

- Somente administradores autorizados, autenticados com MFA, podem revisar.
- Durante o piloto fechado, o fundador pode atuar como revisor único provisório. Nesse regime,
  cadastros e uploads só devem ser liberados dentro da janela diária em que ele estiver disponível;
  não prometa atendimento 24h e pause novas aprovações quando não houver cobertura.
- O revisor nunca pode aprovar o próprio KYC, conteúdo próprio ou decisão em que tenha interesse.
  Esses casos permanecem bloqueados até revisão independente.
- Documento, selfie e mídia são confidenciais. Não baixe, copie, encaminhe ou registre esses
  arquivos fora do painel.
- Na dúvida sobre idade, identidade, consentimento ou legalidade, rejeite ou mantenha bloqueado.
  Enquanto não houver segunda pessoa, não existe exceção para "aprovar provisoriamente".
- Registre uma justificativa objetiva em toda aprovação ou rejeição. O sistema guarda o revisor,
  a data e a decisão.

## Verificação de idade e identidade

Abra **Administração → KYC** e compare:

1. documento legível, íntegro, válido e com frente/verso quando aplicável;
2. nome completo, CPF e data de nascimento informados com o documento;
3. idade mínima de 18 anos na data da análise;
4. selfie atual compatível com a fotografia do documento;
5. sinais visíveis de adulteração, captura de outra tela ou documento de terceiro.

Aprove somente quando todos os itens forem conclusivos. Rejeite com orientação clara quando a
imagem estiver ilegível ou houver divergência. Suspeita de fraude ou menoridade deve ser escalada
e preservada conforme o procedimento de incidentes.

## Moderação de conteúdo

Abra **Administração → Moderação → Fila de publicação manual**. Posts, stories e mídias do chat
permanecem invisíveis para outras pessoas enquanto estiverem pendentes.

Confirme antes de aprovar:

1. todas as pessoas aparentam ser adultas;
2. a pessoa que publicou declara possuir consentimento e direitos sobre o conteúdo;
3. não há indício de coerção, violência sexual, intoxicação, exploração, tráfico, gravação oculta
   ou conteúdo não consentido;
4. não há dados pessoais expostos, chantagem, ameaça, fraude ou instrução criminosa;
5. o conteúdo atende aos Termos e à política de conteúdo da Fanlira.

Conteúdo com suspeita de menoridade, abuso ou ausência de consentimento não deve ser publicado.
Rejeite, preserve as evidências dentro do sistema e siga o runbook de incidentes. Não confronte o
usuário nem compartilhe o material em canais informais.

## Rotina do piloto

- Conferir as filas no início e no fim de cada período de operação.
- Priorizar suspeita de menoridade ou não consentimento imediatamente.
- Manter tempo de resposta informado aos participantes do piloto; não prometer atendimento 24h
  sem uma escala real.
- Enquanto houver um único revisor, auditar semanalmente todas as decisões usando o log do painel;
  quando a segunda pessoa entrar, ela deve revisar retrospectivamente a amostra do piloto.
- Registrar incidentes e correções sem incluir documento, CPF, selfie ou mídia em planilhas e
  mensageiros externos.

## Limites do revisor único

O revisor único é uma solução temporária para um piloto pequeno, não uma escala definitiva. A
operação deve adicionar uma segunda pessoa treinada antes de volume contínuo, plantão, férias do
fundador ou qualquer cenário em que denúncias urgentes possam ficar sem resposta. Até lá:

1. publicar horário de atendimento realista;
2. revisar KYC e mídia antes de qualquer liberação;
3. bloquear casos inconclusivos;
4. registrar cada decisão e incidente;
5. manter um contato jurídico/de emergência para casos de menoridade, exploração ou ordem legal.

## Quando considerar automação paga

Reavaliar um provedor especializado quando o trabalho manual deixar de caber na escala — como
referência inicial, acima de 20 verificações de identidade por semana ou 50 mídias por dia — ou
quando fraude, prazo de análise ou exigência jurídica tornarem a revisão manual insuficiente. O
fornecedor só deve ser contratado depois de confirmar por escrito suporte a conteúdo adulto legal,
tratamento LGPD, retenção, exclusão, revisão humana e resposta a incidentes.
