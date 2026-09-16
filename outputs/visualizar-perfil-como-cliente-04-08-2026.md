# Visualizar perfil como cliente — 04/08/2026

## Onde conferir

- Perfil da modelo: http://localhost:8080/profile/aline
- Pré-visualização direta como cliente: http://localhost:8080/profile/aline?preview=client
- Lista de Mimos em pré-visualização: http://localhost:8080/gifts/aline?preview=client

## O que foi implementado

- Botão “Visualizar como cliente” no próprio perfil da modelo.
- Aviso fixo e botão “Sair da visualização” durante a prévia.
- O perfil respeita todas as escolhas de visibilidade configuradas pela modelo.
- Botões, preço, selo, informações e redes aparecem como para um lead.
- Conteúdo público fica visível; conteúdo VIP e PPV fica bloqueado como para um lead sem assinatura.
- Comentários podem ser abertos, mas ficam em modo somente leitura.
- A Lista de Mimos pode ser visitada com os produtos e valores atuais, sem permitir compra.
- O botão “ASSINAR” abre a prévia segura dos planos mensal, trimestral, semestral e anual.
- A etapa final informa que nenhum Pix será criado e bloqueia a cobrança.
- Curtidas, respostas, denúncias, mensagens, mimos, PPV, contribuições e assinaturas não alteram dados durante a prévia.

## Proteções

- A URL de prévia só é aceita quando o `user_id` autenticado corresponde ao perfil da criadora.
- No modo demonstrativo, a modelo só pode pré-visualizar Aline.
- As rotas financeiras do servidor já rejeitam assinatura, mimo, PPV e contribuição para o próprio perfil, mantendo uma segunda camada de segurança.

## Validação

- Perfil normal e entrada na prévia verificados no navegador.
- Conteúdos VIP e PPV bloqueados confirmados.
- Comentários somente leitura confirmados.
- Lista de Mimos e bloqueio de compra confirmados.
- Planos e bloqueio de geração de Pix confirmados.
- 70 testes aprovados.
- Verificação de tipos e build de produção aprovados.
- Lint sem erros; permanecem somente avisos antigos de organização do projeto.
