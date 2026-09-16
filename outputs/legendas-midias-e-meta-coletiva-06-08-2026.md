# Legendas, mídias e meta coletiva

**Data do ajuste:** 06/08/2026

## Onde conferir

- Editor da modelo: http://localhost:8080/creator/posts
- Perfil da Aline: http://localhost:8080/profile/aline
- Prévia visual como cliente: http://localhost:8080/profile/aline?preview=client

## Sugestão de legenda

- A chamada à Edge Function foi removida do editor.
- As sugestões agora são geradas localmente no navegador.
- Não existe custo por geração nem dependência de uma API externa.
- A modelo pode escolher o estilo e aplicar uma das três sugestões.

## Foto e vídeo

- A criação da URL de prévia foi corrigida para não ser invalidada pelo modo de desenvolvimento do React.
- A foto utiliza enquadramento vertical e preserva a imagem completa na prévia.
- O vídeo utiliza o reprodutor do navegador, com controles e capa opcional.
- Formatos incompatíveis exibem uma orientação clara em vez de uma imagem quebrada.
- Na demonstração local, a moderação remota não é chamada porque nenhum arquivo é enviado ao servidor.
- Em produção, a moderação de segurança continua obrigatória antes do upload.

## Meta coletiva

- Meta total e contribuição mínima estão marcadas como obrigatórias.
- A modelo define o valor total e o menor valor aceito.
- No conteúdo bloqueado, o lead vê valores rápidos sobre a própria área da imagem.
- Exemplo atual: R$ 10,00, R$ 20,00, R$ 50,00 e R$ 100,00.
- O lead também pode digitar outro valor.
- O botão de contribuição atualiza imediatamente para o valor escolhido.
- O servidor impede valores abaixo do mínimo e acima do saldo restante da meta.
- O Pix é gerado com o valor realmente escolhido pelo lead.
- Após a confirmação, a contribuição entra no histórico financeiro com identificação de meta.
- A demonstração local também confirma a contribuição com pagamento simulado.

## Validação

- Fluxo da modelo conferido no navegador.
- Valores rápidos e valor livre conferidos na visão de cliente.
- 81 testes automatizados aprovados.
- Verificação de tipos aprovada.
- Build de produção concluído com sucesso.
