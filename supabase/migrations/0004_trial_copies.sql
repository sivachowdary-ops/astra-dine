-- "Try the whole restaurant yourself": a private 24-hour copy of Kaaram Kitchen for one visitor,
-- with its own owner, kitchen and cashier logins. Safe to run again.

alter table restaurants add column if not exists expires_at timestamptz;

-- One-time links that sign a device in as the copy's kitchen or cashier. Only the hash is kept.
create table if not exists trial_tokens (
  token_hash text primary key,
  user_id uuid not null references staff (user_id) on delete cascade,
  path text not null,
  expires_at timestamptz not null,
  used_at timestamptz
);
alter table trial_tokens enable row level security;

-- Copies a restaurant's settings, branding, menu, tables (not the public "Try it" tables),
-- members, gift cards, campaigns and the last `days` days of bills into an empty restaurant,
-- giving every row a new id. Only the server (service role) calls it.
create or replace function clone_restaurant(src uuid, dst uuid, days int) returns int
language plpgsql as $$
declare n int;
begin
  update restaurants d set
    name = s.name, place = s.place, gstin = s.gstin, gst_pct = s.gst_pct, upi_vpa = null, upi_name = s.upi_name,
    confirm_first_order = s.confirm_first_order, pay_at_table = s.pay_at_table, stamps_for_reward = s.stamps_for_reward,
    stamp_min_bill = s.stamp_min_bill, reward_text = s.reward_text, reward_value = s.reward_value,
    google_review_url = s.google_review_url, kot_seq = s.kot_seq, bill_seq = s.bill_seq, cover_url = s.cover_url,
    logo_url = s.logo_url, tagline = s.tagline, offer_title = s.offer_title, offer_text = s.offer_text
  from restaurants s where s.id = src and d.id = dst;

  create temp table m_cat on commit drop as select id as old, gen_random_uuid() as new from categories where restaurant_id = src;
  insert into categories (id, restaurant_id, name, note, sort, available_from, available_to)
    select m.new, dst, c.name, c.note, c.sort, c.available_from, c.available_to from categories c join m_cat m on m.old = c.id;

  create temp table m_item on commit drop as select id as old, gen_random_uuid() as new from menu_items where restaurant_id = src;
  insert into menu_items (id, restaurant_id, category_id, name, local_name, description, price, diet, spice, station, prep_minutes, tags, variants, addons, serves, image_url, available, sort)
    select m.new, dst, mc.new, i.name, i.local_name, i.description, i.price, i.diet, i.spice, i.station, i.prep_minutes, i.tags, i.variants, i.addons, i.serves, i.image_url, true, i.sort
    from menu_items i join m_item m on m.old = i.id join m_cat mc on mc.old = i.category_id;

  create temp table m_tab on commit drop as select id as old, gen_random_uuid() as new from dining_tables where restaurant_id = src and area <> 'Try it';
  insert into dining_tables (id, restaurant_id, label, area, seats, sort)
    select m.new, dst, t.label, t.area, t.seats, t.sort from dining_tables t join m_tab m on m.old = t.id;

  create temp table m_mem on commit drop as select id as old, gen_random_uuid() as new from members where restaurant_id = src and phone like '+915%';
  insert into members (id, restaurant_id, phone, name, visits, stamps, rewards_ready, spend, birthday, opt_in, last_visit, joined_at)
    select m.new, dst, x.phone, x.name, x.visits, x.stamps, x.rewards_ready, x.spend, x.birthday, x.opt_in, x.last_visit, x.joined_at
    from members x join m_mem m on m.old = x.id;

  create temp table m_ses on commit drop as
    select s.id as old, gen_random_uuid() as new from table_sessions s join m_tab t on t.old = s.table_id
    where s.restaurant_id = src and s.status in ('paid', 'closed') and s.opened_at > now() - make_interval(days => days);
  insert into table_sessions (id, restaurant_id, table_id, status, guests, member_id, bill_no, discount_label, discount, stamped, subtotal, total, via_qr, opened_at, bill_requested_at, paid_at, closed_at)
    select m.new, dst, t.new, 'closed', s.guests, mm.new, s.bill_no, s.discount_label, s.discount, s.stamped, s.subtotal, s.total, s.via_qr, s.opened_at, s.bill_requested_at, s.paid_at, coalesce(s.closed_at, s.paid_at)
    from table_sessions s join m_ses m on m.old = s.id join m_tab t on t.old = s.table_id left join m_mem mm on mm.old = s.member_id;
  get diagnostics n = row_count;

  create temp table m_ord on commit drop as select o.id as old, gen_random_uuid() as new from orders o join m_ses m on m.old = o.session_id;
  insert into orders (id, restaurant_id, session_id, kot, source, placed_at, confirmed_at)
    select mo.new, dst, ms.new, o.kot, o.source, o.placed_at, o.confirmed_at from orders o join m_ord mo on mo.old = o.id join m_ses ms on ms.old = o.session_id;
  insert into order_lines (restaurant_id, order_id, session_id, item_id, name, variant, addons, qty, unit_price, note, station, status, created_at, fired_at, ready_at, served_at)
    select dst, mo.new, ms.new, mi.new, l.name, l.variant, l.addons, l.qty, l.unit_price, l.note, l.station, l.status, l.created_at, l.fired_at, l.ready_at, l.served_at
    from order_lines l join m_ord mo on mo.old = l.order_id join m_ses ms on ms.old = l.session_id left join m_item mi on mi.old = l.item_id;
  insert into payments (restaurant_id, session_id, mode, amount, status, ref, at)
    select dst, ms.new, p.mode, p.amount, p.status, p.ref, p.at from payments p join m_ses ms on ms.old = p.session_id;
  insert into feedback (restaurant_id, session_id, table_label, guest_name, food, service, comment, route, handled, at)
    select dst, ms.new, f.table_label, f.guest_name, f.food, f.service, f.comment, f.route, f.handled, f.at
    from feedback f left join m_ses ms on ms.old = f.session_id where f.restaurant_id = src and f.at > now() - make_interval(days => days * 3);
  insert into gift_cards (restaurant_id, code, value, balance, from_name, to_name, issued_at)
    select dst, code, value, balance, from_name, to_name, issued_at from gift_cards where restaurant_id = src;
  insert into campaigns (restaurant_id, name, segment, message, recipients, created_at)
    select dst, name, segment, message, recipients, created_at from campaigns where restaurant_id = src;
  return n;
end $$;
revoke execute on function clone_restaurant(uuid, uuid, int) from public, anon, authenticated;

notify pgrst, 'reload schema';
