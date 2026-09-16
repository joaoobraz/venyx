# Ajuste — Cupons e ofertas por link

Data: 04/08/2026

## Onde conferir

- Gestão das ofertas: http://localhost:8080/presentation/coupons
- Exemplo “R$ 19,90 para os 10 primeiros”: http://localhost:8080/c/PRIMEIRAS10
- Exemplo de período de teste: http://localhost:8080/c/TESTE7DIAS

## O que foi ajustado

- Criação em uma única tela, com prévia do valor atual e do valor posterior.
- Desconto percentual, desconto em reais, primeiro mês promocional, valor especial e período de teste.
- Público: novos assinantes, antigos assinantes ou ambos.
- Limite por quantidade e por data/hora, com vagas restantes visíveis.
- Aplicação automática pelo link, sem campo para digitar código.
- Um uso por pessoa e reserva atômica de vaga durante o Pix pendente.
- Oferta expirada ou esgotada abre o perfil com o valor normal.
- Período de teste com dias, público, limite, renovação e preço posterior.
- Cupom utilizado registrado junto ao histórico da assinatura.

## Observação sobre renovação do teste

A escolha de renovação fica registrada, mas uma cobrança automática somente poderá ocorrer quando existir uma autorização válida de pagamento recorrente. Um Pix avulso nunca autoriza cobrança automática.

## Validação

- 59 testes automatizados aprovados.
- Verificação de tipos aprovada.
- Verificação de qualidade sem erros; permanecem apenas avisos antigos do projeto.
- Build de produção concluído.
