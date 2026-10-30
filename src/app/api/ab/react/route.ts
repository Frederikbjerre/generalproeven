import { callJson, errorResponse } from "@/lib/claude";
import { demoABReaction, fakeLatency, isDemo } from "@/lib/demo";
import { abReactionUser, personaSystem } from "@/lib/prompts";
import { ABReactionModelSchema, clamp, type ABChoice, type ABReaction, type Persona, type Reaction } from "@/lib/schemas";

export const maxDuration = 120;

const clampBuy = (r: Reaction): Reaction => ({ ...r, koebsvilje: clamp(r.koebsvilje, 1, 10) });

// One persona judges both versions. The order is randomized per call to cancel out position bias.
export async function POST(req: Request) {
  const { persona, materialA, materialB } = (await req.json()) as {
    persona: Persona;
    materialA: string;
    materialB: string;
  };
  if (!materialA?.trim() || !materialB?.trim()) {
    return Response.json({ error: "Indsæt begge versioner." }, { status: 400 });
  }
  if (isDemo()) {
    await fakeLatency();
    return Response.json({ reaction: demoABReaction(persona, materialA, materialB), demo: true });
  }

  const aFirst = Math.random() < 0.5;
  try {
    const r = await callJson({
      schema: ABReactionModelSchema,
      system: personaSystem(persona),
      user: aFirst ? abReactionUser(materialA, materialB) : abReactionUser(materialB, materialA),
      effort: "low",
    });
    const [a, b] = aFirst ? [r.version_1, r.version_2] : [r.version_2, r.version_1];
    const foretrukket: ABChoice =
      r.foretrukket === "ingen" ? "ingen" : (r.foretrukket === "version_1") === aFirst ? "A" : "B";
    const reaction: ABReaction = { a: clampBuy(a), b: clampBuy(b), foretrukket, begrundelse: r.begrundelse };
    return Response.json({ reaction });
  } catch (err) {
    return errorResponse(err);
  }
}
