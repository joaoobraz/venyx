# Meta coletiva — liberação exclusiva para participantes

Data do ajuste: 06/08/2026

## Regra final

O conteúdo da meta só é liberado quando as duas condições são verdadeiras ao mesmo tempo:

1. o lead contribuiu para a meta; e
2. a meta atingiu 100% do valor definido pela modelo.

| Participou | Meta atingida | Acesso à mídia |
| --- | --- | --- |
| Não | Não | Bloqueado |
| Sim | Não | Bloqueado, aguardando a meta |
| Não | Sim | Bloqueado até contribuir; o apoio continua aberto |
| Sim | Sim | Liberado |

A modelo continua vendo o próprio conteúdo em qualquer estágio.

## Experiência do lead

- O card, o valor arrecadado e o progresso continuam visíveis antes dos 100%.
- Depois da primeira participação, aparece a confirmação de que a contribuição foi registrada.
- O texto deixa claro que a mídia será liberada somente quando a meta chegar a 100%.
- O lead pode contribuir novamente enquanto a meta estiver aberta.
- Ao atingir 100%, a meta continua aberta para apoio adicional.
- Um lead que contribuir depois dos 100% passa a ser participante e recebe o conteúdo.
- O total arrecadado pode ultrapassar o valor original da meta.
- Participantes podem continuar apoiando pelo botão discreto no rodapé do post.

## Segurança

- A mesma regra foi aplicada na interface, na assinatura das URLs privadas de mídia e nas políticas do banco.
- A linha do post e o progresso podem ser consultados para viabilizar a campanha.
- O arquivo privado continua protegido até que participação e meta concluída sejam confirmadas.

## Onde conferir

- Perfil da Aline: http://localhost:8080/profile/aline
- Criação e gestão de posts: http://localhost:8080/creator/posts

## Validação realizada

- 84 testes automatizados aprovados.
- Verificação de tipos aprovada.
- Lint concluído sem erros (somente avisos já existentes no projeto).
- Build de produção aprovado.
- Conferência visual local antes dos 100%: contribuição confirmada com meta em 2% permaneceu bloqueada, como esperado.
- Conferência visual local após os 100%: a meta passou de R$ 500,00 para R$ 510,00, continuou aberta e manteve o botão de apoio adicional.
