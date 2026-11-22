-- Indexes on foreign keys. Without them, deleting a restaurant (an expired trial copy) cascades
-- through full-table scans and took ~17 s, past Supabase's 8 s statement limit, so expired copies
-- were never removed and each new trial waited on the failed clean-up.
create index if not exists categories_restaurant_id_idx on public.categories (restaurant_id);
create index if not exists menu_items_category_id_idx on public.menu_items (category_id);
create index if not exists table_sessions_member_id_idx on public.table_sessions (member_id);
create index if not exists orders_restaurant_id_idx on public.orders (restaurant_id);
create index if not exists orders_confirmed_by_idx on public.orders (confirmed_by);
create index if not exists order_lines_order_id_idx on public.order_lines (order_id);
create index if not exists order_lines_item_id_idx on public.order_lines (item_id);
create index if not exists payments_restaurant_id_idx on public.payments (restaurant_id);
create index if not exists payments_confirmed_by_idx on public.payments (confirmed_by);
create index if not exists calls_table_id_idx on public.calls (table_id);
create index if not exists feedback_restaurant_id_idx on public.feedback (restaurant_id);
create index if not exists feedback_session_id_idx on public.feedback (session_id);
create index if not exists campaigns_restaurant_id_idx on public.campaigns (restaurant_id);
create index if not exists trial_tokens_user_id_idx on public.trial_tokens (user_id);
