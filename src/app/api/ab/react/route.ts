import { callJson, errorResponse } from "@/lib/claude";
import { demoABReaction, fakeLatency, isDemo } from "@/lib/demo";
import { abReactionContent, personaSystem } from "@/lib/prompts";
import {
  abReactionModelSchema,
  clampReaction,
  type ABChoice,
  type ABReaction,
  type Persona,
  type VideoMaterial,
} from "@/lib/schemas";

export const maxDuration = 120;

// One persona judges both versions. The order is randomized per call to cancel out position bias.
export async function POST(req: Request) {
  const { persona, materialA, materialB, videoA, videoB } = (await req.json()) as {
    persona: Persona;
    materialA: string;
    materialB: string;
    videoA?: VideoMaterial;
    videoB?: VideoMaterial;
  };
  if (!materialA?.trim() || !materialB?.trim()) {
    return Response.json({ error: "Indsæt begge versioner." }, { status: 400 });
  }
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ reaction: demoABReaction(persona, materialA, materialB, videoA, videoB), demo: true });
  }

  const a = { text: materialA, video: videoA?.frames.length ? videoA : undefined };
  const b = { text: materialB, video: videoB?.frames.length ? videoB : undefined };
  const aFirst = Math.random() < 0.5;
  try {
    const r = await callJson({
      // Video questions are asked for both versions as soon as either one is a video
      schema: abReactionModelSchema(Boolean(a.video || b.video)),
      system: personaSystem(persona),
      user: aFirst ? abReactionContent(a, b) : abReactionContent(b, a),
      effort: "low",
    });
    const [ra, rb] = aFirst ? [r.version_1, r.version_2] : [r.version_2, r.version_1];
    const foretrukket: ABChoice =
      r.foretrukket === "ingen" ? "ingen" : (r.foretrukket === "version_1") === aFirst ? "A" : "B";
    const reaction: ABReaction = {
      a: clampReaction(ra),
      b: clampReaction(rb),
      foretrukket,
      begrundelse: r.begrundelse,
    };
    return Response.json({ reaction });
  } catch (err) {
    return errorResponse(err);
  }
}
