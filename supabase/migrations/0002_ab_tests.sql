-- Fase 4: A/B-tests. En test har enten én version (single) eller to (ab).
-- For A/B ligger version A i input_text/source_url og version B i variant_b_*.
-- reactions.data og reports.data har en anden form for A/B; tests.mode fortæller hvilken.

alter table public.tests
  add column mode text not null default 'single' check (mode in ('single', 'ab')),
  add column variant_b_input_type text check (variant_b_input_type in ('text', 'url')),
  add column variant_b_text text,
  add column variant_b_source_url text;
