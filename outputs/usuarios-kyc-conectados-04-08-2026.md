# Usuários e KYC conectados

Data do ajuste: 04/08/2026

## Onde conferir

- Usuários: http://localhost:8080/presentation/users
- Fila de KYC: http://localhost:8080/presentation/kyc
- No seletor do topo, use **Visualizar como → Administrador**.

## O que foi ajustado

### Usuários

- Lista única com nome, e-mail, tipo de conta, status, data de cadastro, status do KYC, saldo, assinaturas, bloqueios e ações administrativas.
- Filtros por busca, tipo de conta, status da conta e status do KYC.
- Perfil administrativo com as abas **Dados do usuário** e **KYC**.
- Ações para pausar, suspender ou reativar a conta.
- Acesso direto ao KYC da mesma pessoa, sem duplicar o cadastro.

### KYC

- Fila operacional conectada à lista de usuários.
- Estados disponíveis: aguardando análise, em análise, aprovado, reprovado, documento inválido, selfie pendente, nova verificação e dados divergentes.
- Acesso direto da fila para o cadastro administrativo da mesma pessoa.
- Decisões de KYC atualizam o mesmo registro e ficam registradas no histórico de demonstração.

## Como a conexão funciona

- Em **Usuários**, o botão **KYC** abre a aba de verificação daquela mesma pessoa.
- Em **KYC**, o botão **Usuário** abre os dados administrativos daquele mesmo cadastro.
- Não existe uma segunda cópia da pessoa na fila: as duas telas consultam a mesma fonte de dados.

## Validação realizada

- Navegação e filtros conferidos visualmente nas duas páginas.
- Conexão Usuários → KYC e KYC → Usuário conferida.
- 75 testes automatizados aprovados.
- Verificação de tipos aprovada.
- Verificação de qualidade aprovada sem erros.
- Build de produção concluído com sucesso.
