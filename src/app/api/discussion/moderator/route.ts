import { callJson, errorResponse } from "@/lib/claude";
import { demoModeratorQuestion, fakeLatency, isDemo } from "@/lib/demo";
import { MODERATOR_SYSTEM, moderatorUser } from "@/lib/prompts";
import { ModeratorSchema, type DiscussionMessage } from "@/lib/schemas";

export const maxDuration = 60;

// Suggests the moderator's follow-up question between rounds; the user can edit or skip it.
export async function POST(req: Request) {
  const { material, transcript, nextRound } = (await req.json()) as {
    material: string;
    transcript: DiscussionMessage[];
    nextRound: number;
  };
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ spoergsmaal: demoModeratorQuestion(nextRound) });
  }
  try {
    const { spoergsmaal } = await callJson({
      schema: ModeratorSchema,
      system: MODERATOR_SYSTEM,
      user: moderatorUser(material, transcript, nextRound),
      effort: "low",
    });
    return Response.json({ spoergsmaal });
  } catch (err) {
    return errorResponse(err);
  }
}
