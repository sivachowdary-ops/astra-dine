-- Astra Dine: restaurants, menus, tables, orders, payments, loyalty.
-- Every write goes through the app's server (service role) after it checks who is asking.
-- Staff screens read their own restaurant directly (row level security) and get live
-- updates through Supabase Realtime. Guests never read the database: their phone talks to
-- the server with the table's QR token.

create extension if not exists pgcrypto;

create table if not exists restaurants (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9-]{3,40}$'),
  name text not null,
  place text,
  gstin text,
  gst_pct numeric(4, 2) not null default 5,
  upi_vpa text,
  upi_name text,
  confirm_first_order boolean not null default true,
  pay_at_table boolean not null default true,
  stamps_for_reward int not null default 6 check (stamps_for_reward between 2 and 20),
  stamp_min_bill int not null default 300,
  reward_text text not null default 'Free dessert',
  reward_value int not null default 150,
  google_review_url text,
  kot_seq int not null default 0,
  bill_seq int not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists staff (
  user_id uuid primary key references auth.users (id) on delete cascade,
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  username text not null,
  role text not null check (role in ('owner', 'manager', 'cashier', 'kitchen')),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (restaurant_id, username)
);

create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  note text,
  sort int not null default 0
);

create table if not exists menu_items (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  category_id uuid not null references categories (id) on delete cascade,
  name text not null,
  local_name text,
  description text,
  price int not null check (price >= 0),
  diet text not null default 'veg' check (diet in ('veg', 'egg', 'nonveg')),
  spice int not null default 0 check (spice between 0 and 3),
  station text not null default 'kitchen',
  prep_minutes int not null default 10,
  tags text[] not null default '{}',
  variants jsonb not null default '[]',
  addons jsonb not null default '[]',
  serves int,
  image_url text,
  available boolean not null default true,
  sort int not null default 0
);
create index if not exists menu_items_restaurant on menu_items (restaurant_id, category_id, sort);

create table if not exists dining_tables (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  label text not null,
  area text not null default 'Main hall',
  seats int not null default 4,
  qr_token text not null unique default encode(gen_random_bytes(9), 'hex'),
  sort int not null default 0,
  unique (restaurant_id, label)
);

create table if not exists members (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  phone text not null,
  name text,
  visits int not null default 0,
  stamps int not null default 0,
  rewards_ready int not null default 0,
  spend bigint not null default 0,
  birthday text,
  opt_in boolean not null default false,
  last_visit timestamptz,
  joined_at timestamptz not null default now(),
  unique (restaurant_id, phone)
);

create table if not exists table_sessions (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_id uuid not null references dining_tables (id) on delete cascade,
  status text not null default 'seated' check (status in ('seated', 'bill', 'paid', 'closed')),
  guests int not null default 2,
  member_id uuid references members (id),
  -- Kept on the guest's phone; lets that phone see and add to this table's orders.
  guest_token text not null default encode(gen_random_bytes(16), 'hex'),
  bill_no int,
  discount_label text,
  discount int not null default 0,
  stamped boolean not null default false,
  -- Set when the bill is settled, for reports.
  subtotal int,
  total int,
  via_qr boolean not null default false,
  opened_at timestamptz not null default now(),
  bill_requested_at timestamptz,
  paid_at timestamptz,
  closed_at timestamptz
);
create index if not exists sessions_open on table_sessions (restaurant_id, status) where status <> 'closed';
create unique index if not exists one_open_session_per_table on table_sessions (table_id) where status <> 'closed';
create index if not exists sessions_paid on table_sessions (restaurant_id, paid_at);

create table if not exists orders (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  session_id uuid not null references table_sessions (id) on delete cascade,
  kot int not null,
  source text not null check (source in ('qr', 'staff')),
  placed_at timestamptz not null default now(),
  confirmed_at timestamptz,
  confirmed_by uuid references auth.users (id)
);
create index if not exists orders_session on orders (session_id);

create table if not exists order_lines (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  order_id uuid not null references orders (id) on delete cascade,
  session_id uuid not null references table_sessions (id) on delete cascade,
  item_id uuid references menu_items (id) on delete set null,
  name text not null,
  variant text,
  addons text[] not null default '{}',
  qty int not null check (qty between 1 and 50),
  unit_price int not null,
  note text,
  station text not null,
  status text not null default 'queued' check (status in ('pending', 'queued', 'cooking', 'ready', 'served', 'cancelled')),
  created_at timestamptz not null default now(),
  fired_at timestamptz,
  ready_at timestamptz,
  served_at timestamptz
);
create index if not exists lines_kitchen on order_lines (restaurant_id, status) where status in ('pending', 'queued', 'cooking', 'ready');
create index if not exists lines_session on order_lines (session_id);
create index if not exists lines_item_time on order_lines (restaurant_id, created_at);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  session_id uuid not null references table_sessions (id) on delete cascade,
  mode text not null check (mode in ('upi', 'cash', 'card', 'gift')),
  amount int not null check (amount > 0),
  -- A guest who paid by UPI from their phone says so; the cashier confirms it arrived.
  status text not null default 'confirmed' check (status in ('claimed', 'confirmed', 'rejected')),
  ref text,
  at timestamptz not null default now(),
  confirmed_by uuid references auth.users (id)
);
create index if not exists payments_session on payments (session_id);

create table if not exists calls (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  table_id uuid not null references dining_tables (id) on delete cascade,
  kind text not null check (kind in ('waiter', 'water', 'cutlery', 'bill', 'help')),
  at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists calls_open on calls (restaurant_id) where resolved_at is null;

create table if not exists gift_cards (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  code text not null,
  value int not null,
  balance int not null check (balance >= 0),
  from_name text,
  to_name text,
  issued_at timestamptz not null default now(),
  unique (restaurant_id, code)
);

create table if not exists feedback (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  session_id uuid references table_sessions (id) on delete set null,
  table_label text,
  guest_name text,
  food int not null check (food between 1 and 5),
  service int not null check (service between 1 and 5),
  comment text,
  -- No reward is ever tied to a Google review: happy guests are only asked.
  route text not null check (route in ('google-ask', 'manager')),
  handled boolean not null default false,
  at timestamptz not null default now()
);

create table if not exists campaigns (
  id uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references restaurants (id) on delete cascade,
  name text not null,
  segment text not null,
  message text not null,
  recipients int not null,
  created_at timestamptz not null default now()
);

-- Numbered tickets and bills, without gaps or clashes between two tills.
create or replace function next_number(r uuid, kind text) returns int
  language plpgsql security definer set search_path = public
as $$
declare n int;
begin
  if kind = 'kot' then
    update restaurants set kot_seq = kot_seq + 1 where id = r returning kot_seq into n;
  else
    update restaurants set bill_seq = bill_seq + 1 where id = r returning bill_seq into n;
  end if;
  return n;
end $$;
revoke all on function next_number(uuid, text) from public, anon, authenticated;

-- Row level security: staff read their own restaurant. Nobody writes from the browser.
create or replace function my_restaurant() returns uuid
  language sql stable security definer set search_path = public
  as $$ select restaurant_id from staff where user_id = auth.uid() and active $$;

do $$
declare t text;
begin
  foreach t in array array['restaurants','staff','categories','menu_items','dining_tables','members','table_sessions','orders','order_lines','payments','calls','gift_cards','feedback','campaigns']
  loop
    execute format('alter table %I enable row level security', t);
    execute format('drop policy if exists staff_read on %I', t);
    if t = 'restaurants' then
      execute 'create policy staff_read on restaurants for select to authenticated using (id = my_restaurant())';
    else
      execute format('create policy staff_read on %I for select to authenticated using (restaurant_id = my_restaurant())', t);
    end if;
  end loop;
end $$;

-- Live updates for the staff screens.
do $$
declare t text;
begin
  foreach t in array array['orders','order_lines','calls','table_sessions','payments','menu_items','dining_tables','feedback']
  loop
    if not exists (select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = t) then
      execute format('alter publication supabase_realtime add table %I', t);
    end if;
  end loop;
end $$;

-- Dish photos, readable by anyone (they are on the public menu).
insert into storage.buckets (id, name, public) values ('menu', 'menu', true) on conflict (id) do nothing;
