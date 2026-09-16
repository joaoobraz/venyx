# Postagens: texto, foto, vídeo, PPV e fixação

**Data do ajuste:** 06/08/2026

## Onde conferir

- Criar e gerenciar publicações: http://localhost:8080/creator/posts
- Conferir o resultado no perfil: http://localhost:8080/profile/aline

## O que foi ajustado

- A criadora escolhe claramente entre publicação de texto, foto ou vídeo.
- Os acessos “Novo post” e “Conteúdo → Publicações” do menu da modelo abrem diretamente o novo editor.
- Foto e vídeo podem receber uma legenda opcional.
- A publicação pode ser pública, exclusiva para assinantes, PPV ou vinculada a uma meta.
- Ao selecionar PPV, a criadora define o preço antes de publicar.
- A criadora pode marcar o novo conteúdo para ficar fixado no topo do perfil.
- Apenas uma publicação pode ficar fixada por vez; ao fixar outra, a anterior é substituída automaticamente.
- A área “Publicações do perfil” permite fixar ou desafixar conteúdos já publicados.
- Publicações fixadas aparecem primeiro no perfil e recebem a identificação “Fixado”.
- Publicações somente de texto não exibem mais uma imagem quadrada indevida.
- A lógica funciona na demonstração local e está preparada no banco para o ambiente real.

## Validação realizada

- Interface conferida nos endereços acima.
- Navegação validada clicando nos dois caminhos do menu da modelo.
- 77 testes automatizados aprovados.
- Build de produção concluído com sucesso.
- Verificação de integridade das alterações concluída sem erros.

## Observação para produção

A migração `20260806100000_creator_post_pinning.sql` deve ser aplicada no Supabase para habilitar a fixação no banco de produção.
