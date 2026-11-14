create or replace function public.contas_pagar_proteger_pagamento()
returns trigger
language plpgsql
set search_path = public
as $$
declare
  v_ultima date;
begin
  -- Administração (SQL Editor, service role) não é bloqueada
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.status <> 'pendente'
       or new.valor_pago <> 0
       or new.data_pagamento is not null then
      raise exception 'Conta nova deve começar pendente e sem pagamento. Registre o pagamento em pagamentos_conta.';
    end if;
    return new;
  end if;

  -- UPDATE disparado pelo recálculo (trigger de pagamentos_conta) é legítimo
  if pg_trigger_depth() > 1 then
    return new;
  end if;

  -- UPDATE direto do cliente: os campos derivados não podem mudar
  if new.status is distinct from old.status
     or new.valor_pago is distinct from old.valor_pago
     or new.data_pagamento is distinct from old.data_pagamento then
    raise exception 'status, valor_pago e data_pagamento só mudam por pagamentos_conta.';
  end if;

  -- Mudou o valor da conta: reavalia o status com o valor_pago atual
  if new.valor is distinct from old.valor then
    select max(pago_em) into v_ultima
    from pagamentos_conta where conta_id = new.id;

    new.status := case
      when new.valor_pago <= 0 then 'pendente'
      when new.valor_pago >= new.valor then 'pago'
      else 'parcial'
    end;
    new.data_pagamento := case when new.status = 'pago' then v_ultima else null end;
  end if;

  return new;
end;
$$;

create trigger trg_contas_pagar_proteger_pagamento
before insert or update on public.contas_pagar
for each row execute function public.contas_pagar_proteger_pagamento();