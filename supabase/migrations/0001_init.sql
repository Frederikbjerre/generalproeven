-- Generalprøven: schema + Row Level Security.
-- Run in the Supabase SQL editor (or `supabase db push`).

create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null default auth.uid() references auth.users (id) on delete cascade,
  name text not null,
  audience text not null default '',
  context text not null default '',
  created_at timestamptz not null default now()
);

create table public.personas (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  data jsonb not null,
  position int not null default 0
);

create table public.tests (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete cascade,
  input_type text not null check (input_type in ('text', 'url')),
  input_text text not null,
  source_url text,
  created_at timestamptz not null default now()
);

create table public.reactions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  -- Personas can be regenerated after a test, so keep the reaction but drop the link.
  persona_id uuid references public.personas (id) on delete set null,
  data jsonb not null
);

create table public.discussion_messages (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  persona_id uuid references public.personas (id) on delete set null, -- null = moderator
  round int not null,
  content text not null,
  speaker_name text not null default '',
  created_at timestamptz not null default now()
);

create table public.reports (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests (id) on delete cascade,
  data jsonb not null,
  includes_discussion boolean not null default false,
  created_at timestamptz not null default now()
);

create index on public.projects (user_id, created_at desc);
create index on public.personas (project_id, position);
create index on public.tests (project_id, created_at desc);
create index on public.reactions (test_id);
create index on public.discussion_messages (test_id, created_at);
create index on public.reports (test_id, created_at desc);

-- Row Level Security: users only see their own projects and everything under them.

alter table public.projects enable row level security;
alter table public.personas enable row level security;
alter table public.tests enable row level security;
alter table public.reactions enable row level security;
alter table public.discussion_messages enable row level security;
alter table public.reports enable row level security;

create policy "own projects" on public.projects
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create or replace function public.owns_project(pid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (select 1 from public.projects p where p.id = pid and p.user_id = (select auth.uid()))
  $$;

create or replace function public.owns_test(tid uuid) returns boolean
  language sql stable security definer set search_path = '' as $$
    select exists (
      select 1 from public.tests t join public.projects p on p.id = t.project_id
      where t.id = tid and p.user_id = (select auth.uid())
    )
  $$;

create policy "own personas" on public.personas
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy "own tests" on public.tests
  for all to authenticated
  using (public.owns_project(project_id)) with check (public.owns_project(project_id));

create policy "own reactions" on public.reactions
  for all to authenticated
  using (public.owns_test(test_id)) with check (public.owns_test(test_id));

create policy "own discussion" on public.discussion_messages
  for all to authenticated
  using (public.owns_test(test_id)) with check (public.owns_test(test_id));

create policy "own reports" on public.reports
  for all to authenticated
  using (public.owns_test(test_id)) with check (public.owns_test(test_id));
