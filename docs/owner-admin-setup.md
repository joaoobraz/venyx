# Administrador principal da Fanlira

O administrador principal configurado para a plataforma é:

`joaobraz.ofc@gmail.com`

A migration `20260826120000_platform_owner_admin.sql` faz duas coisas:

1. Promove a conta existente desse e-mail para o papel `admin`.
2. Promove automaticamente novos cadastros com esse mesmo e-mail.

## Aplicação no Supabase

No Supabase, abra **SQL Editor**, cole o conteúdo da migration e clique em **Run**.
Depois, saia e entre novamente na Fanlira para o papel ser recarregado.

Não é necessário colocar senha ou chave no código. A senha continua sendo gerenciada pelo Supabase Auth.

## Verificação

Após entrar com `joaobraz.ofc@gmail.com`, abra `/admin`.
Se a rota carregar o painel administrativo, a promoção foi aplicada.

