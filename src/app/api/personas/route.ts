import { callJson, errorResponse } from "@/lib/claude";
import { demoPersonas, demoReplacement, fakeLatency, isDemo } from "@/lib/demo";
import {
  PERSONA_GENERATOR_SYSTEM,
  personaGeneratorUser,
  regeneratePersonaUser,
  skepticismProblem,
} from "@/lib/prompts";
import { PersonaListSchema, clamp, type Persona } from "@/lib/schemas";

export const maxDuration = 120;

const MAX_ATTEMPTS = 3;

type Body = {
  audience: string;
  context?: string;
  // Present when regenerating a single persona
  replace?: { current: Persona; others: Persona[]; target: Pick<Persona, "skepsis_score" | "er_afvisende"> };
};

const withIds = (list: Omit<Persona, "id">[]): Persona[] =>
  list.map((p) => ({
    ...p,
    id: crypto.randomUUID(),
    skepsis_score: clamp(p.skepsis_score, 1, 10),
  }));

export async function POST(req: Request) {
  const { audience, context = "", replace } = (await req.json()) as Body;
  if (!audience?.trim()) {
    return Response.json({ error: "Beskriv målgruppen først." }, { status: 400 });
  }

  if (isDemo()) {
    await fakeLatency();
    return replace
      ? Response.json({ persona: demoReplacement(replace.current, replace.others, replace.target, audience), demo: true })
      : Response.json({ personas: demoPersonas(audience), warning: null, demo: true });
  }

  try {
    if (replace) {
      const { personas } = await callJson({
        schema: PersonaListSchema,
        system: PERSONA_GENERATOR_SYSTEM,
        user: regeneratePersonaUser(audience, context, replace.current, replace.others, replace.target),
      });
      if (!personas.length) throw new Error("Ingen persona returneret");
      const [persona] = withIds(personas.slice(0, 1));
      // Keep the slot's role in the group so the quota survives regeneration
      return Response.json({ persona: { ...persona, ...replace.target } });
    }

    let user = personaGeneratorUser(audience, context);
    let personas: Persona[] = [];
    let problem: string | null = null;
    for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
      const result = await callJson({ schema: PersonaListSchema, system: PERSONA_GENERATOR_SYSTEM, user });
      personas = withIds(result.personas).slice(0, 8);
      problem = personas.length < 8 ? `kun ${personas.length} personas` : skepticismProblem(personas);
      if (!problem) break;
      user = `${personaGeneratorUser(audience, context)}\n\nForrige forsøg overholdt ikke kravene: ${problem}. Ret det.`;
    }
    return Response.json({ personas, warning: problem ? `Kravene blev ikke helt opfyldt: ${problem}` : null });
  } catch (err) {
    return errorResponse(err);
  }
}
