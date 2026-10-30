import { ScrapeError, scrape } from "@/lib/scrape";

export const runtime = "nodejs";
export const maxDuration = 30;

export async function POST(req: Request) {
  const { url } = (await req.json()) as { url?: string };
  if (!url?.trim()) return Response.json({ error: "Indtast en adresse." }, { status: 400 });
  try {
    return Response.json(await scrape(url));
  } catch (err) {
    if (err instanceof ScrapeError) return Response.json({ error: err.message }, { status: 422 });
    console.error(err);
    return Response.json({ error: "Uventet fejl ved hentning af siden." }, { status: 500 });
  }
}
