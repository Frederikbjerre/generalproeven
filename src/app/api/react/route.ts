import { callJson, errorResponse } from "@/lib/claude";
import { demoReaction, fakeLatency, isDemo } from "@/lib/demo";
import { personaSystem, reactionUser } from "@/lib/prompts";
import { ReactionSchema, clamp, type Persona } from "@/lib/schemas";

export const maxDuration = 120;

// One persona per request; the client fires these in parallel so results stream in as they finish.
export async function POST(req: Request) {
  const { persona, material } = (await req.json()) as { persona: Persona; material: string };
  if (!material?.trim()) {
    return Response.json({ error: "Indsæt noget materiale at teste." }, { status: 400 });
  }
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ reaction: demoReaction(persona, material), demo: true });
  }
  try {
    const reaction = await callJson({
      schema: ReactionSchema,
      system: personaSystem(persona),
      user: reactionUser(material),
      effort: "low",
    });
    return Response.json({ reaction: { ...reaction, koebsvilje: clamp(reaction.koebsvilje, 1, 10) } });
  } catch (err) {
    return errorResponse(err);
  }
}
