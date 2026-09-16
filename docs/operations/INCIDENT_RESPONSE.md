# Resposta a incidentes

## Severidades

- **Crítica — 15 minutos:** suspeita de menor de idade, conteúdo não consentido, vazamento de credencial, exposição de dados ou cobrança incorreta em escala.
- **Alta — 1 hora:** moderação indisponível, webhook repetidamente falhando, indisponibilidade ampla ou perda parcial de dados.
- **Normal — 1 dia útil:** falha isolada sem exposição, spam, abuso ou degradação com alternativa segura.

## Fluxo

1. Assumir o alerta no painel e registrar horário e responsável.
2. Conter: bloquear publicação, upload, confirmação financeira ou credencial afetada.
3. Preservar evidências no sistema. Não copiar mídia sensível para ferramentas pessoais.
4. Avaliar alcance, usuários afetados e janela de tempo.
5. Corrigir e validar em ambiente isolado.
6. Resolver o alerta com nota objetiva e criar ações preventivas.
7. Quando houver dados pessoais, acionar responsável jurídico para avaliar comunicação à ANPD e titulares.

Toda exceção temporária deve ter responsável, expiração e plano de reversão. O sistema nunca deve liberar upload quando a moderação estiver indisponível.
