# Moderação de comentários — 04/08/2026

## Onde conferir

- Painel da modelo: http://localhost:8080/presentation/moderation
- Perfil usado na demonstração: http://localhost:8080/profile/aline

## Ajustes concluídos

- Exclusão de comentário publicado.
- Ocultação e republicação de comentário.
- Fila com aprovação e rejeição de comentários pendentes.
- Denúncia de comentário para análise da Fanlira.
- Bloqueio do autor, impedindo novos comentários.
- Aprovação manual ativável e desativável.
- Aviso de possível redução de interação, desempenho e faturamento enquanto a aprovação manual estiver ativa.
- Filtro configurável de palavras e expressões específicas.
- Sincronização do estado do comentário com o perfil: somente comentários publicados ficam visíveis para o lead.
- Contadores do painel sincronizados com pendências, palavras e usuários bloqueados.

## Regra de funcionamento

Com a aprovação manual desativada, comentários permitidos pelos filtros aparecem imediatamente. Com ela ativada, novos comentários entram como pendentes e só aparecem no perfil após a modelo aprovar. Palavras filtradas e usuários bloqueados são barrados antes da publicação.

## Preparação para produção

A base recebeu uma migração com status `published`, `pending`, `hidden` e `rejected`, políticas de acesso, contagem somente de comentários publicados e notificação apenas após a publicação/aprovação. A migração está preparada localmente e ainda precisa ser aplicada no ambiente Supabase usado em produção.

## Validação

- 63 testes automatizados aprovados.
- TypeScript aprovado sem erros.
- Build de produção concluído.
- Tela local conferida com controles de aprovação, rejeição, ocultação, denúncia, bloqueio e exclusão.
