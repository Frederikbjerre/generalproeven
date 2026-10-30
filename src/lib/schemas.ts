import { z } from "zod";

// Structured outputs don't enforce numeric ranges or array lengths, so those
// rules live in the prompts and are clamped/validated after parsing.

export const PersonaSchema = z.object({
  navn: z.string(),
  alder: z.number().int(),
  by: z.string(),
  jobtitel: z.string(),
  virksomhedstype: z.string(),
  budget_mandat: z.string().describe("Budget og beslutningsmandat, konkret"),
  segment: z.string().describe("Kort segment-label, fx 'Lille kommune, økonomiansvarlig'"),
  holdninger: z.string(),
  kaepheste: z.array(z.string()),
  mediebrug: z.array(z.string()),
  skepsis_score: z.number().int().describe("1-10, hvor 10 er mest skeptisk"),
  er_afvisende: z.boolean().describe("Sand for den ene persona der er decideret sur/afvisende"),
  grund_til_interesse: z
    .string()
    .describe("Konkret grund til evt. interesse. Tom streng hvis ingen interesse."),
});
export type Persona = z.infer<typeof PersonaSchema> & { id: string };

export const PersonaListSchema = z.object({ personas: z.array(PersonaSchema) });

export const ReactionSchema = z.object({
  foerstehaandsindtryk: z.string(),
  hvad_jeg_forstod: z.string(),
  stoerste_indvending: z.string(),
  koebsvilje: z.number().int().describe("1-10: ville du klikke/købe?"),
  koebsvilje_begrundelse: z.string(),
  citat: z.string().describe("Ét citat i personaens egen stemme"),
});
export type Reaction = z.infer<typeof ReactionSchema>;

export const ReportSchema = z.object({
  samlet_score: z.number().int().describe("0-100"),
  samlet_vurdering: z.string().describe("2-3 sætninger"),
  top_indvendinger: z.array(z.object({ titel: z.string(), forklaring: z.string() })),
  top_styrker: z.array(z.object({ titel: z.string(), forklaring: z.string() })),
  bedste_citater: z.array(z.object({ persona_navn: z.string(), citat: z.string() })),
  mest_positive_segmenter: z.array(z.object({ segment: z.string(), begrundelse: z.string() })),
  mindst_positive_segmenter: z.array(z.object({ segment: z.string(), begrundelse: z.string() })),
  forbedringsforslag: z.array(z.object({ forslag: z.string(), begrundelse: z.string() })),
});
export type Report = z.infer<typeof ReportSchema>;

export const clamp = (n: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, Math.round(n)));

export const ROUNDS = 3;

/** One line in the discussion room. personaId is null for the moderator. */
export type DiscussionMessage = {
  id: string;
  round: number;
  personaId: string | null;
  navn: string;
  content: string;
};

export const ModeratorSchema = z.object({
  spoergsmaal: z.string().describe("Ét kort, åbent opfølgende spørgsmål til gruppen"),
});

// --- A/B mode ---

// What the model sees: neutral labels in a random order per persona, to avoid position bias.
export const ABReactionModelSchema = z.object({
  version_1: ReactionSchema,
  version_2: ReactionSchema,
  foretrukket: z.enum(["version_1", "version_2", "ingen"]),
  begrundelse: z.string().describe("Kort, i egen stemme: hvorfor den ene frem for den anden (eller ingen)"),
});

export type ABChoice = "A" | "B" | "ingen";

/** Stored/returned shape, mapped back to the user's A and B. */
export type ABReaction = { a: Reaction; b: Reaction; foretrukket: ABChoice; begrundelse: string };

export const ABReportSchema = z.object({
  vinder: z.enum(["A", "B", "uafgjort"]),
  sikkerhed: z.enum(["lav", "middel", "høj"]).describe("Hvor sikker er konklusionen givet 8 syntetiske personas"),
  begrundelse: z.string().describe("3-4 sætninger: hvorfor vinderen vandt"),
  score_a: z.number().int().describe("0-100"),
  score_b: z.number().int().describe("0-100"),
  styrker_a: z.array(z.string()),
  svagheder_a: z.array(z.string()),
  styrker_b: z.array(z.string()),
  svagheder_b: z.array(z.string()),
  segment_forskelle: z.array(
    z.object({ segment: z.string(), foretrukket: z.enum(["A", "B", "ingen"]), begrundelse: z.string() }),
  ),
  bedste_citater: z.array(z.object({ persona_navn: z.string(), version: z.enum(["A", "B"]), citat: z.string() })),
  forbedringsforslag: z.array(z.object({ forslag: z.string(), begrundelse: z.string() })),
});
export type ABReport = z.infer<typeof ABReportSchema>;

export function abStats(reactions: ABReaction[]) {
  const n = reactions.length || 1;
  return {
    votes: {
      A: reactions.filter((r) => r.foretrukket === "A").length,
      B: reactions.filter((r) => r.foretrukket === "B").length,
      ingen: reactions.filter((r) => r.foretrukket === "ingen").length,
    },
    avgA: reactions.reduce((s, r) => s + r.a.koebsvilje, 0) / n,
    avgB: reactions.reduce((s, r) => s + r.b.koebsvilje, 0) / n,
  };
}
