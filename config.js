// ── Supabase bağlantı bilgileri ───────────────────────────
// supabase.com → New Project → Settings → API
window.SUPABASE_URL = 'https://aghtuyzefjndjuqkqvng.supabase.co';
window.SUPABASE_KEY = 'sb_publishable_s6pvytR8qnynp4qsJo0IEQ_o5EG56Jf';

// ── Telegram Bot Token ────────────────────────────────────
// @BotFather'a /newbot yaz → token'ı buraya yapıştır
window.TELEGRAM_BOT_TOKEN = 'BURAYA_BOT_TOKEN';

/*
  Supabase'de aşağıdaki SQL'i çalıştır (SQL Editor):

  create table leads (
    id uuid default gen_random_uuid() primary key,
    first_name text not null,
    last_name text,
    phone text,
    email text,
    status text not null default 'uzak-takip',
    created_at timestamptz default now(),
    last_contact timestamptz,
    added_by text
  );

  create table notes (
    id uuid default gen_random_uuid() primary key,
    lead_id uuid references leads(id) on delete cascade,
    text text not null,
    date timestamptz default now(),
    added_by text
  );

  -- Herkese okuma/yazma izni (şifresiz kullanım için)
  alter table leads enable row level security;
  alter table notes enable row level security;

  create policy "public_all_leads" on leads for all using (true) with check (true);
  create policy "public_all_notes" on notes for all using (true) with check (true);
*/
