# Ajuste do perfil da modelo — 04/08/2026

## Onde conferir

- Perfil correto da modelo: http://localhost:8080/profile/aline
- Controles de exibição e bloqueio por estado: http://localhost:8080/settings/profile
- Painel da modelo: http://localhost:8080/presentation/overview

## O que foi ajustado

- No modo modelo, os links “Perfil” do menu, avatar e menu móvel agora abrem `/profile/aline`, não o perfil de joaobraz.
- Na conta real, o destino do perfil só é montado quando o `user_id` do perfil corresponde exatamente ao usuário autenticado.
- A aprovação de KYC e a concessão do papel de criadora passam a ser sincronizadas automaticamente, inclusive ao voltar o foco para a plataforma.
- Foram criados controles individuais para idade, localização, redes sociais, assinantes, ranking, selos, Lista de Mimos, planos, comentários, tempo de resposta, biografia, categoria, curtidas, posts e status de atividade.
- Cada controle atualiza o perfil público imediatamente.
- Foi adicionado bloqueio por estado brasileiro. A primeira camada usa o estado cadastrado na conta; a proteção também foi aplicada no banco ao perfil e às publicações.
- A própria modelo e administradores continuam podendo acessar o perfil mesmo com um estado bloqueado.

## Validação

- Link “Perfil” confirmado apontando para `/profile/aline`.
- Ocultação da biografia testada no navegador e restaurada depois do teste.
- 67 testes aprovados.
- Verificação de tipos aprovada.
- Build de produção aprovado.
- Lint sem erros; permanecem apenas avisos antigos de organização do projeto.

## Observação sobre localização

O bloqueio atual é baseado no estado informado e validado na conta do lead. Uma camada por IP pode ser adicionada futuramente para aumentar a cobertura, mas não deve substituir o estado cadastrado porque IP pode estar incorreto, usar VPN ou representar outra região.
