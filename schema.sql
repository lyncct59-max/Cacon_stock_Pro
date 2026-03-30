create table watchlist (
  id uuid primary key default gen_random_uuid(),
  ticker text,
  total_score int,
  current_price numeric
);

create table journal (
  id uuid primary key default gen_random_uuid(),
  ticker text,
  buy_price numeric,
  pnl numeric,
  status text
);
