-- 1) Status 'parcial' + valor_pago em contas_pagar
alter table public.contas_pagar drop constraint contas_pagar_status_check;
alter table public.contas_pagar
  add constraint contas_pagar_status_check
  check (status in ('pendente', 'parcial', 'pago'));

alter table public.contas_pagar
  add column valor_pago numeric(12,2) not null default 0;
alter table public.contas_pagar
  add constraint contas_pagar_valor_pago_check
  check (valor_pago >= 0 and valor_pago <= valor);

-- Necessário para a FK composta (isolamento por usuário, mesmo padrão de categorias)
alter table public.contas_pagar
  add constraint contas_pagar_id_user_unique unique (id, user_id);

-- 2) Tabela de pagamentos
create table public.pagamentos_conta (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null,
  user_id uuid not null references auth.users (id) on delete cascade,
  valor numeric(12,2) not null check (valor > 0),
  pago_em date not null default current_date,
  created_at timestamptz not null default now(),
  constraint pagamentos_conta_conta_user_fkey
    foreign key (conta_id, user_id)
    references public.contas_pagar (id, user_id) on delete cascade
);
create index idx_pagamentos_conta_conta on public.pagamentos_conta (conta_id);
create index idx_pagamentos_conta_user on public.pagamentos_conta (user_id);

-- 3) Backfill: contas já pagas viram um pagamento integral
insert into public.pagamentos_conta (conta_id, user_id, valor, pago_em)
select id, user_id, valor, coalesce(data_pagamento, created_at::date)
from public.contas_pagar
where status = 'pago' and valor > 0;

update public.contas_pagar set valor_pago = valor where status = 'pago';

-- 4) Recalcula valor_pago, status e data_pagamento
create or replace function public.recalcular_conta_pagar(p_conta_id uuid)
returns void
language plpgsql
set search_path = public
as $$
declare
  v_valor numeric(12,2);
  v_total numeric(12,2);
  v_ultima date;
begin
  select valor into v_valor
  from contas_pagar where id = p_conta_id
  for update;                      -- serializa pagamentos concorrentes
  if not found then return; end if;

  select coalesce(sum(valor), 0), max(pago_em)
    into v_total, v_ultima
  from pagamentos_conta where conta_id = p_conta_id;

  if v_total > v_valor then
    raise exception 'O pagamento excede o valor restante da conta.';
  end if;

  update contas_pagar set
    valor_pago = v_total,
    status = case
      when v_total <= 0 then 'pendente'
      when v_total >= v_valor then 'pago'
      else 'parcial'
    end,
    data_pagamento = case
      when v_total > 0 and v_total >= v_valor then v_ultima
      else null
    end
  where id = p_conta_id;
end;
$$;

create or replace function public.trg_pagamentos_conta_recalcular()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if tg_op = 'DELETE' then
    perform recalcular_conta_pagar(old.conta_id);
    return old;
  end if;
  perform recalcular_conta_pagar(new.conta_id);
  return new;
end;
$$;

create trigger trg_pagamentos_conta_recalcular
after insert or delete on public.pagamentos_conta
for each row execute function public.trg_pagamentos_conta_recalcular();

-- 5) RLS (sem update: pagamento errado se desfaz com delete)
alter table public.pagamentos_conta enable row level security;

create policy pagamentos_conta_select on public.pagamentos_conta
  for select to authenticated using (user_id = (select auth.uid()));
create policy pagamentos_conta_insert on public.pagamentos_conta
  for insert to authenticated with check (user_id = (select auth.uid()));
create policy pagamentos_conta_delete on public.pagamentos_conta
  for delete to authenticated using (user_id = (select auth.uid()));