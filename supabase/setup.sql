-- Apply once, to a dedicated Supabase project. No existing business tables are altered.
begin;

create or replace function public.finance_valid_state(p_state jsonb)
returns boolean language plpgsql immutable security invoker set search_path = ''
as $$
declare item jsonb; group_name text; seen text[]; identity text; d date;
begin
  if p_state is null or jsonb_typeof(p_state) <> 'object'
     or p_state->'schema' is distinct from '1'::jsonb
     or jsonb_typeof(p_state->'records') is distinct from 'array'
     or jsonb_typeof(p_state->'templates') is distinct from 'array'
     or octet_length(p_state::text) > 4000000 then return false; end if;
  if jsonb_array_length(p_state->'records')>10000 or jsonb_array_length(p_state->'templates')>200 then return false; end if;
  if p_state->'logo' is not null and p_state->'logo'<>'null'::jsonb then
    if jsonb_typeof(p_state->'logo')<>'string' or length(p_state->>'logo')>1400000
       or (p_state->>'logo') !~ '^data:image/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$' then return false; end if;
  end if;
  foreach group_name in array array['records','templates'] loop
    seen := array[]::text[];
    for item in select value from jsonb_array_elements(p_state->group_name) loop
      if jsonb_typeof(item)<>'object'
        or jsonb_typeof(item->'id') is distinct from 'number'
        or (item->>'id') !~ '^[0-9]+$'
        or (item->>'id')::numeric < 1 or (item->>'id')::numeric > 9007199254740991
        or jsonb_typeof(item->'amount') is distinct from 'number'
        or (item->>'amount') !~ '^[0-9]+$'
        or (item->>'amount')::numeric < 1 or (item->>'amount')::numeric > 1000000000
        or jsonb_typeof(item->'type') is distinct from 'string'
        or (item->>'type') not in ('收入','支出')
        or jsonb_typeof(item->'category') is distinct from 'string'
        or length(item->>'category') not between 1 and 500
        or jsonb_typeof(item->'note') is distinct from 'string'
        or length(item->>'note') > 2000 then return false; end if;
      identity := item->>'id';
      if identity = any(seen) then return false; end if;
      seen := array_append(seen, identity);
      if group_name='records' then
        if jsonb_typeof(item->'date') is distinct from 'string' or (item->>'date') !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then return false; end if;
        d := (item->>'date')::date;
        if d < date '1900-01-01' or d > date '9999-12-31' or to_char(d,'YYYY-MM-DD')<>item->>'date' then return false; end if;
      end if;
    end loop;
  end loop;
  return true;
exception when others then return false;
end;
$$;
revoke all on function public.finance_valid_state(jsonb) from public, anon;
grant execute on function public.finance_valid_state(jsonb) to authenticated;

create table public.finance_ledgers (
  owner_id uuid primary key references auth.users(id) on delete cascade,
  state jsonb not null check (public.finance_valid_state(state)),
  version integer not null default 0 check (version >= 0),
  last_request_id uuid,
  updated_at timestamptz not null default now()
);
alter table public.finance_ledgers enable row level security;
alter table public.finance_ledgers force row level security;
revoke all on table public.finance_ledgers from public, anon, authenticated;
grant select, insert, update on table public.finance_ledgers to authenticated;
create policy finance_read_own on public.finance_ledgers for select to authenticated using ((select auth.uid())=owner_id);
create policy finance_insert_own on public.finance_ledgers for insert to authenticated with check ((select auth.uid())=owner_id);
create policy finance_update_own on public.finance_ledgers for update to authenticated using ((select auth.uid())=owner_id) with check ((select auth.uid())=owner_id);

create or replace function public.finance_read()
returns jsonb language plpgsql stable security invoker set search_path = ''
as $$
declare ledger public.finance_ledgers;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  select * into ledger from public.finance_ledgers where owner_id=auth.uid();
  if not found then return jsonb_build_object('state',null,'version',0,'updated_at',null); end if;
  return jsonb_build_object('state',ledger.state,'version',ledger.version,'updated_at',ledger.updated_at);
end;
$$;
revoke all on function public.finance_read() from public, anon;
grant execute on function public.finance_read() to authenticated;

create or replace function public.finance_write(p_state jsonb,p_expected_version integer,p_request_id uuid)
returns jsonb language plpgsql security invoker set search_path = ''
as $$
declare ledger public.finance_ledgers;
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode='28000'; end if;
  if p_request_id is null or p_expected_version is null or p_expected_version<0 or not public.finance_valid_state(p_state) then raise exception 'Invalid ledger' using errcode='22023'; end if;
  insert into public.finance_ledgers(owner_id,state,version) values(auth.uid(),p_state,0) on conflict(owner_id) do nothing;
  select * into strict ledger from public.finance_ledgers where owner_id=auth.uid() for update;
  if ledger.last_request_id=p_request_id then
    return jsonb_build_object('state',ledger.state,'version',ledger.version,'updated_at',ledger.updated_at);
  end if;
  if ledger.version<>p_expected_version then raise exception 'Ledger was changed by another device' using errcode='40001'; end if;
  update public.finance_ledgers set state=p_state,version=version+1,last_request_id=p_request_id,updated_at=clock_timestamp()
    where owner_id=auth.uid() returning * into ledger;
  return jsonb_build_object('state',ledger.state,'version',ledger.version,'updated_at',ledger.updated_at);
end;
$$;
revoke all on function public.finance_write(jsonb,integer,uuid) from public, anon;
grant execute on function public.finance_write(jsonb,integer,uuid) to authenticated;
comment on table public.finance_ledgers is 'Leyisheng: one isolated ledger per authenticated account. The same account can access it on multiple devices.';
commit;
