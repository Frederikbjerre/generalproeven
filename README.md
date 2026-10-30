# Generalprøven (MVP, fase 1–4)

Syntetiske fokusgrupper for danske marketingfolk: beskriv en målgruppe, få 8 AI-personas, indsæt marketingmateriale (tekst eller URL), se deres reaktioner, lad dem diskutere og få en rapport. I A/B-tilstand vurderer personaerne to versioner, og rapporten udpeger en vinder.

## Kør lokalt

1. `cp .env.example .env.local` og udfyld nøglerne (alle er valgfrie, se nedenfor)
2. `npm install`
3. `npm run dev` → http://localhost:3000

| Mangler | Hvad sker der |
|---|---|
| `ANTHROPIC_API_KEY` | Demo-tilstand: faste eksempeldata i stedet for AI |
| Supabase-variablerne | Lokal tilstand: én side, ingen login, intet gemmes |

## Sæt Supabase op

1. Opret et projekt på supabase.com.
2. Kør `supabase/migrations/0001_init.sql` og derefter `0002_ab_tests.sql` i SQL-editoren (tabeller, Row Level Security og A/B-felter).
3. Under **Authentication → URL Configuration**: sæt *Site URL* til din app-adresse og tilføj `http://localhost:3000/auth/callback` (og din Vercel-adresse + `/auth/callback`) under *Redirect URLs*.
4. Under **Project Settings → API**: kopiér *Project URL* og *publishable key* (eller den gamle *anon key*) til `.env.local`.

Supabase' indbyggede e-mail er stærkt begrænset (få mails i timen). Til rigtig brug: sæt egen SMTP op under Authentication → Emails.

## Struktur

- `src/lib/prompts.ts` – alle prompts og skepsis-kravene
- `src/lib/schemas.ts` – zod-skemaer (structured outputs) og fælles typer
- `src/lib/claude.ts` – server-side kald til `claude-sonnet-5-5` (JSON og streaming), med server-side fallback
- `src/lib/demo.ts` – demo-data når der ikke er API-nøgle
- `src/lib/scrape.ts` – URL-scraper (Readability + jsdom) med blokering af interne adresser
- `src/lib/store.ts` – gemmer i Supabase fra browseren; RLS sikrer, at brugere kun ser egne data
- `src/middleware.ts` – login-krav på sider og API'er (kun når Supabase er sat op)
- `src/app/api/*` – personas, reaktioner, diskussion (streaming), moderator, rapport, scrape og `ab/*` til A/B-tests
- `src/components/ABTest.tsx` – A/B-flowet; hver persona ser begge versioner i tilfældig rækkefølge
- `src/app/projekter/[id]` – et gemt projekt med seneste test
