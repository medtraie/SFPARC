-- Enable UUID extension if not already enabled
create extension if not exists "uuid-ossp";

-- Create stock_suppliers table
create table if not exists public.stock_suppliers (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  contact_name text,
  phone text,
  email text,
  address text,
  city text,
  categories text[] default '{}',
  rating numeric default 5.0,
  notes text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create stock_items table
create table if not exists public.stock_items (
  id uuid default uuid_generate_v4() primary key,
  name text not null,
  reference text,
  category text not null,
  quantity integer default 0,
  min_quantity integer default 0,
  unit text default 'unité',
  unit_price numeric default 0,
  supplier_id uuid references public.stock_suppliers(id) on delete set null,
  location text,
  last_restocked date,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create stock_transactions table for history
create table if not exists public.stock_transactions (
  id uuid default uuid_generate_v4() primary key,
  item_id uuid references public.stock_items(id) on delete cascade,
  type text not null check (type in ('IN', 'OUT', 'ADJUSTMENT')),
  quantity integer not null,
  previous_quantity integer,
  new_quantity integer,
  notes text,
  created_at timestamptz default now(),
  created_by uuid references auth.users(id)
);

-- Add RLS policies
alter table public.stock_suppliers enable row level security;
alter table public.stock_items enable row level security;
alter table public.stock_transactions enable row level security;

-- Create policies (assuming authenticated users have full access for now)
create policy "Enable all for authenticated users" on public.stock_suppliers
  for all using (auth.role() = 'authenticated');

create policy "Enable all for authenticated users" on public.stock_items
  for all using (auth.role() = 'authenticated');

create policy "Enable all for authenticated users" on public.stock_transactions
  for all using (auth.role() = 'authenticated');

-- Create updated_at trigger function if not exists
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- Add triggers for updated_at
create trigger handle_updated_at_stock_suppliers
  before update on public.stock_suppliers
  for each row execute procedure public.handle_updated_at();

create trigger handle_updated_at_stock_items
  before update on public.stock_items
  for each row execute procedure public.handle_updated_at();
