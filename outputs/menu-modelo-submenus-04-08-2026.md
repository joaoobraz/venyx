# Menu da modelo organizado em submenus

Data do ajuste: 04/08/2026

## Onde conferir

- Painel da modelo: http://localhost:8080/presentation/overview
- Perfil da modelo: http://localhost:8080/profile/aline
- Pré-visualização como cliente: http://localhost:8080/profile/aline?preview=client

## O que foi ajustado

- A lateral da modelo agora destaca somente três atalhos em **Mais usados**: Visão geral, Novo post e Mensagens.
- O menu completo foi dividido em oito grupos e somente um submenu permanece aberto por vez.
- Ao entrar em uma página, o grupo correspondente é aberto automaticamente e o item atual recebe destaque.
- A lateral tem rolagem própria para não alongar ou deslocar o conteúdo principal.

## Organização aplicada

- **Início:** Visão geral, Métricas e Atividades recentes.
- **Conteúdo:** Publicações, Acervo, PPV e Mensagens em massa.
- **Assinaturas e vendas:** Planos, Cupons, Assinantes, Lista de Mimos e Fidelidade.
- **Comunicação:** Mensagens, Comentários e Moderação de comentários.
- **Crescimento:** Fanlira Links, Origem das visitas, Campanhas e Relatórios.
- **Financeiro:** Saldo, Saques, Histórico financeiro e Pagamentos.
- **Perfil:** Editar perfil, Personalização e Visualizar como cliente.
- **Configurações:** Segurança, Notificações, Privacidade, Conta e Ajuda.

## Funções adicionais preservadas

- **Bumps & Upsells** permanece em Assinaturas e vendas para contas reais de criadora.
- **Afiliados** permanece em Crescimento quando a criadora também é embaixadora.
- **DMCA** permanece em Configurações para contas reais de criadora.
- A configuração inicial da criadora continua acessível por Editar perfil.
- Os menus de cliente e administrador não foram alterados por esta reorganização.

## Validação realizada

- Todos os oito grupos foram abertos e conferidos no navegador.
- Abertura única dos submenus confirmada.
- Link Visualizar como cliente confirmado para `/profile/aline?preview=client`.
- Verificação de tipos concluída.
- 70 testes automatizados aprovados.
- Lint concluído sem erros; permanecem 112 avisos antigos do projeto.
- Build de produção concluído com sucesso.

## Arquivo principal alterado

- `src/components/Sidebar.tsx`
