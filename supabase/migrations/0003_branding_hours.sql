-- The restaurant's look on the customer menu, and serving hours for menu sections.

alter table restaurants add column if not exists cover_url text;
alter table restaurants add column if not exists logo_url text;
alter table restaurants add column if not exists tagline text;
alter table restaurants add column if not exists offer_title text;
alter table restaurants add column if not exists offer_text text;

-- A section such as Tiffins or Meals is only orderable between these times (India time).
alter table categories add column if not exists available_from time;
alter table categories add column if not exists available_to time;
