-- La Table de l'Equipe — Schema PostgreSQL + RLS
-- Coller dans Supabase SQL Editor

-- Extensions
create extension if not exists "uuid-ossp";

-- ============================================================
-- TABLES
-- ============================================================

create table public.establishments (
  id uuid primary key default uuid_generate_v4(),
  user_id uuid references auth.users(id) on delete cascade not null,
  name text not null,
  employee_count integer not null default 10,
  budget_per_meal numeric(6,2) not null default 3.50,
  market text not null default 'fr' check (market in ('fr','uk','us','au','ca')),
  currency text not null default 'EUR',
  language text not null default 'fr',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.suppliers (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid references public.establishments(id) on delete cascade not null,
  name text not null,
  delivery_days integer[] not null default '{1,4}',
  category text not null default 'general',
  is_primary boolean not null default false,
  created_at timestamptz not null default now()
);

create table public.supply_spans (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid references public.establishments(id) on delete cascade not null,
  supplier_id uuid references public.suppliers(id) on delete cascade not null,
  start_date date not null,
  end_date date not null,
  day_count integer not null,
  meal_count integer generated always as (day_count * 2) stored,
  created_at timestamptz not null default now()
);

create table public.suggestions (
  id uuid primary key default uuid_generate_v4(),
  span_id uuid references public.supply_spans(id) on delete cascade not null,
  establishment_id uuid references public.establishments(id) on delete cascade not null,
  day_index integer not null,
  meal_date date not null,
  meal_type text not null check (meal_type in ('lunch', 'dinner')),
  ingredients jsonb not null default '[]',
  estimated_cost numeric(6,2),
  grocery_list jsonb not null default '[]',
  notes text,
  created_at timestamptz not null default now()
);

create table public.feedback (
  id uuid primary key default uuid_generate_v4(),
  suggestion_id uuid references public.suggestions(id) on delete cascade not null,
  establishment_id uuid references public.establishments(id) on delete cascade not null,
  status text not null check (status in ('done', 'modified', 'skipped')),
  actual_ingredients jsonb,
  notes text,
  created_at timestamptz not null default now()
);

create table public.brief_codes (
  id uuid primary key default uuid_generate_v4(),
  establishment_id uuid references public.establishments(id) on delete cascade not null,
  code text not null unique,
  span_id uuid references public.supply_spans(id) on delete cascade not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);

-- ============================================================
-- INDEXES
-- ============================================================

create index idx_establishments_user on public.establishments(user_id);
create index idx_suppliers_establishment on public.suppliers(establishment_id);
create index idx_spans_establishment on public.supply_spans(establishment_id);
create index idx_spans_dates on public.supply_spans(start_date, end_date);
create index idx_suggestions_span on public.suggestions(span_id);
create index idx_suggestions_date on public.suggestions(meal_date);
create index idx_feedback_suggestion on public.feedback(suggestion_id);
create index idx_brief_codes_code on public.brief_codes(code);

-- ============================================================
-- ROW LEVEL SECURITY
-- ============================================================

alter table public.establishments enable row level security;
alter table public.suppliers enable row level security;
alter table public.supply_spans enable row level security;
alter table public.suggestions enable row level security;
alter table public.feedback enable row level security;
alter table public.brief_codes enable row level security;

-- Establishments: users can only access their own
create policy "Users manage own establishment"
  on public.establishments for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Suppliers: via establishment ownership
create policy "Users manage own suppliers"
  on public.suppliers for all
  using (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ))
  with check (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ));

-- Supply spans: via establishment ownership
create policy "Users manage own spans"
  on public.supply_spans for all
  using (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ))
  with check (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ));

-- Suggestions: via establishment ownership
create policy "Users manage own suggestions"
  on public.suggestions for all
  using (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ))
  with check (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ));

-- Feedback: via establishment ownership
create policy "Users manage own feedback"
  on public.feedback for all
  using (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ))
  with check (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ));

-- Brief codes: owners manage, anyone with code can read
create policy "Users manage own brief codes"
  on public.brief_codes for all
  using (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ))
  with check (establishment_id in (
    select id from public.establishments where user_id = auth.uid()
  ));

create policy "Anyone can read brief by code"
  on public.brief_codes for select
  using (expires_at > now());

-- ============================================================
-- UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger on_establishment_updated
  before update on public.establishments
  for each row execute function public.handle_updated_at();
