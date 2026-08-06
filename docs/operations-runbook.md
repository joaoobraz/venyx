# Fanlira — rotina operacional de lançamento

## Ambientes e acesso

- O projeto `uzbdzklsufweldmfbvfq` é o staging. Produção só deve ser criada ou alterada após a validação final do responsável pela Fanlira.
- Chaves administrativas nunca entram no repositório, no navegador ou em variáveis com prefixo `VITE_`.
- Cada integração usa uma credencial própria. Credenciais temporárias devem expirar ou ser revogadas ao final da manutenção.
- Dados com `is_demo=true` e perfis identificados como demonstração nunca entram em rankings, pagamentos ou relatórios reais.

## Fila de moderação

1. Risco de possível menor de idade: bloquear imediatamente, não republicar e iniciar revisão humana em até 15 minutos, 24 horas por dia enquanto houver uploads liberados.
2. Conteúdo ilegal, ameaça ou divulgação não consentida: ocultar preventivamente e iniciar revisão em até 1 hora.
3. Assédio, fraude, spam e falsa identidade: iniciar revisão em até 8 horas úteis.
4. Toda decisão deve registrar responsável, horário, motivo e evidência mínima; nunca baixar ou compartilhar material suspeito fora das ferramentas autorizadas.
5. Em dúvida sobre idade, manter bloqueado. A liberação exige revisão humana e prova de identidade válida da pessoa retratada.

## Incidentes

- Pagamentos divergentes: interromper novas confirmações, preservar o webhook e comparar referência, valor e evento no painel NexusPag e no banco.
- Falha de moderação automática: o sistema deve continuar bloqueando novos uploads; não criar exceção manual no código.
- Vazamento de credencial: revogar imediatamente, substituir a chave, revisar logs e sessões, documentar alcance e horário.
- Banco indisponível: suspender o tráfego de escrita e acompanhar `/api/public/health`; restaurar somente após confirmar integridade.

## Monitoramento e backup

- Monitorar `GET /api/public/health` a cada minuto e alertar após duas falhas consecutivas.
- Alertar sobre erros 5xx, falhas de webhook, fila de moderação vencida e aumento anormal de denúncias.
- Manter backups automáticos do Supabase e executar teste de restauração antes do lançamento; backup sem teste de restauração não conta como concluído.
- Revisar semanalmente administradores, chaves, funções publicadas e rotinas agendadas.

## Liberação gradual

1. Validar staging em iPhone, Android, Chrome, Safari e Firefox.
2. Abrir para um grupo pequeno de criadoras verificadas e compradores convidados.
3. Observar por pelo menos 72 horas pagamentos, moderação, chat, denúncias e suporte.
4. Aumentar o tráfego somente se não houver divergência financeira, falha de moderação ou incidente de privacidade.
