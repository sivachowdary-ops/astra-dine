-- Reports for the owner, computed in the database so they stay fast with months of bills.
-- Each checks that the caller works at the restaurant they ask about.

create or replace function report_days(r uuid, days int)
returns table (day date, sales bigint, bills int, guests int, qr_bills int)
language sql stable security definer set search_path = public
as $$
  select (paid_at at time zone 'Asia/Kolkata')::date as day,
         coalesce(sum(total), 0)::bigint, count(*)::int, coalesce(sum(guests), 0)::int,
         count(*) filter (where via_qr)::int
  from table_sessions
  where restaurant_id = r and r = my_restaurant() and paid_at is not null
    and paid_at >= (now() at time zone 'Asia/Kolkata')::date - days
  group by 1 order by 1
$$;

create or replace function report_hours(r uuid, days int)
returns table (dow int, hour int, bills int)
language sql stable security definer set search_path = public
as $$
  select extract(dow from opened_at at time zone 'Asia/Kolkata')::int,
         extract(hour from opened_at at time zone 'Asia/Kolkata')::int, count(*)::int
  from table_sessions
  where restaurant_id = r and r = my_restaurant() and paid_at is not null
    and opened_at >= now() - make_interval(days => days)
  group by 1, 2
$$;

create or replace function report_items(r uuid, days int)
returns table (name text, qty bigint, revenue bigint)
language sql stable security definer set search_path = public
as $$
  select l.name, sum(l.qty)::bigint, sum(l.qty * l.unit_price)::bigint
  from order_lines l
  where l.restaurant_id = r and r = my_restaurant() and l.status not in ('cancelled', 'pending')
    and l.created_at >= now() - make_interval(days => days)
  group by l.name order by 2 desc
$$;

grant execute on function report_days(uuid, int), report_hours(uuid, int), report_items(uuid, int) to authenticated;
