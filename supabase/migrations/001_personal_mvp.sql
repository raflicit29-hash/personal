-- MR ALL IN Personal MVP. Jalankan di Supabase SQL Editor.
create table if not exists public.personal_accounts (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 name text not null check (length(trim(name))>0),
 account_type text not null check (account_type in ('cash','bank','savings','ewallet')),
 opening_balance numeric(14,2) not null default 0 check (opening_balance>=0),
 active boolean not null default true,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create table if not exists public.personal_transactions (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null references auth.users(id) on delete cascade,
 account_id uuid not null references public.personal_accounts(id) on delete restrict,
 transaction_date date not null default current_date,
 transaction_type text not null check (transaction_type in ('income','expense')),
 category text not null,
 amount numeric(14,2) not null check (amount>0),
 note text,
 source text not null default 'manual' check (source in ('manual','business_transfer','import')),
 source_transfer_id uuid unique,
 status text not null default 'posted' check (status in ('posted','pending','void')),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now()
);
create index if not exists personal_accounts_user_idx on public.personal_accounts(user_id);
create index if not exists personal_transactions_user_date_idx on public.personal_transactions(user_id,transaction_date desc);
alter table public.personal_accounts enable row level security;
alter table public.personal_transactions enable row level security;
drop policy if exists personal_accounts_owner_all on public.personal_accounts;
create policy personal_accounts_owner_all on public.personal_accounts for all to authenticated using(auth.uid()=user_id) with check(auth.uid()=user_id);
drop policy if exists personal_transactions_owner_all on public.personal_transactions;
create policy personal_transactions_owner_all on public.personal_transactions for all to authenticated using(auth.uid()=user_id and exists(select 1 from public.personal_accounts a where a.id=account_id and a.user_id=auth.uid())) with check(auth.uid()=user_id and exists(select 1 from public.personal_accounts a where a.id=account_id and a.user_id=auth.uid()));
grant select,insert,update,delete on public.personal_accounts to authenticated;
grant select,insert,update,delete on public.personal_transactions to authenticated;
notify pgrst,'reload schema';
