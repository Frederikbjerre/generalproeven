import { callJson, errorResponse } from "@/lib/claude";
import { demoReaction, fakeLatency, isDemo } from "@/lib/demo";
import { personaSystem, reactionUser, videoReactionContent } from "@/lib/prompts";
import { ReactionSchema, VideoReactionSchema, clampReaction, type Persona, type VideoMaterial } from "@/lib/schemas";

export const maxDuration = 120;

// One persona per request; the client fires these in parallel so results stream in as they finish.
export async function POST(req: Request) {
  const { persona, material, video } = (await req.json()) as {
    persona: Persona;
    material: string;
    video?: VideoMaterial;
  };
  if (!material?.trim()) {
    return Response.json({ error: "Indsæt noget materiale at teste." }, { status: 400 });
  }
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ reaction: demoReaction(persona, material, video), demo: true });
  }
  try {
    const reaction = video?.frames.length
      ? await callJson({
          schema: VideoReactionSchema,
          system: personaSystem(persona),
          user: videoReactionContent(video),
          effort: "low",
        })
      : await callJson({
          schema: ReactionSchema,
          system: personaSystem(persona),
          user: reactionUser(material),
          effort: "low",
        });
    return Response.json({ reaction: clampReaction(reaction) });
  } catch (err) {
    return errorResponse(err);
  }
}
