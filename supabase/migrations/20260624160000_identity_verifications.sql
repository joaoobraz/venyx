-- =====================================================================
-- Verificação de identidade/idade do assinante (gate de +18 ao assinar)
-- Navegação é livre; a verificação acontece ao assinar uma criadora.
-- =====================================================================

create table if not exists public.identity_verifications (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null unique references auth.users(id) on delete cascade,
  country     text not null default 'BR',
  cpf         text not null,
  full_name   text not null,
  birth_date  date not null,
  status      text not null default 'verified' check (status in ('verified','pending','rejected')),
  method      text not null default 'cpf_checksum',
  verified_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

-- Um CPF verificado não pode estar em duas contas (anti-abuso).
create unique index if not exists idx_identity_cpf_verified
  on public.identity_verifications (cpf)
  where status = 'verified';

alter table public.identity_verifications enable row level security;

-- Só o dono lê a própria verificação.
drop policy if exists "dono le propria verificacao" on public.identity_verifications;
create policy "dono le propria verificacao"
  on public.identity_verifications for select
  to authenticated
  using (auth.uid() = user_id);

-- Admin lê todas (moderação).
drop policy if exists "admin le verificacoes" on public.identity_verifications;
create policy "admin le verificacoes"
  on public.identity_verifications for select
  to authenticated
  using (public.has_role(auth.uid(), 'admin'));

-- Sem políticas de INSERT/UPDATE/DELETE: a escrita é feita por server function
-- (service role), que valida CPF + idade antes de gravar.

-- Helper: este usuário está verificado (18+)?
create or replace function public.is_age_verified(_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.identity_verifications
    where user_id = _user_id and status = 'verified'
  );
$$;
