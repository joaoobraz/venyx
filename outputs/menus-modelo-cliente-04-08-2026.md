# Menus da modelo e do cliente

Data do ajuste: 04/08/2026

## Onde conferir

- Menu do cliente: http://localhost:8080/feed
- Menu da modelo: http://localhost:8080/presentation/overview

Para alternar entre os dois, use o seletor **Visualizar como** no topo da plataforma.

## Correções realizadas

- Os ícones de cada categoria agora permanecem fixos e não giram quando o submenu é aberto.
- Somente a seta da direita muda de direção para indicar se a categoria está aberta ou fechada.
- **Notificações** foi removido de Configurações e colocado dentro de Comunicação no menu da modelo.

## Novo menu do cliente

### Mais usados

- Feed
- Explorar
- Mensagens

### Início

- Feed
- Explorar
- Favoritos

### Assinaturas e benefícios

- Pagamentos e assinaturas
- Fidelidade

### Comunicação

- Mensagens
- Notificações

### Perfil

- Perfil do próprio cliente
- Editar perfil

### Configurações

- Segurança
- Privacidade
- Ajuda

## Comportamento validado

- Somente um submenu permanece aberto por vez.
- O grupo correspondente à página atual abre automaticamente.
- Todos os cinco submenus do cliente foram abertos e conferidos.
- Todos os ícones permaneceram na posição correta durante a abertura e o fechamento.
- Notificações aparece uma vez em Comunicação e não aparece em Configurações na versão modelo.
- Verificação de tipos concluída.
- 70 testes automatizados aprovados.
- Lint concluído sem erros; permanecem 112 avisos antigos do projeto.
- Build de produção concluído com sucesso.

## Arquivo alterado

- `src/components/Sidebar.tsx`
