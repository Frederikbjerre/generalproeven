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

// --- Video ---

/** Extra questions that only make sense for a video seen in a feed. */
export const VideoFieldsSchema = z.object({
  stopper_op: z.boolean().describe("Ville du stoppe op i dit feed inden for de første 3 sekunder?"),
  hook_vurdering: z.string().describe("Hvad fangede (eller ikke fangede) dig i starten"),
  ville_se_til_ende: z.number().int().describe("1-10: hvor sandsynligt er det, at du ser videoen færdig?"),
  hvad_jeg_husker: z.string().describe("Det du husker bagefter, med dine egne ord"),
  hvem_er_afsenderen: z.string().describe("Hvem du tror står bag. Sig det, hvis det er uklart."),
});
export type VideoFields = z.infer<typeof VideoFieldsSchema>;

export const VideoReactionSchema = ReactionSchema.extend({ video: VideoFieldsSchema });

export type Reaction = z.infer<typeof ReactionSchema> & { video?: VideoFields };

/** A campaign video as the models see it: still frames with timestamps plus an optional script. */
export type VideoMaterial = {
  fileName: string;
  duration: number;
  /** JPEG frames as base64 (no data: prefix), in order */
  frames: { t: number; data: string }[];
  script: string;
};

export const formatTime = (t: number) => `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, "0")}`;

/** The text stand-in for a video, used everywhere that only needs text (discussion, report, storage). */
export function videoAsText(v: Pick<VideoMaterial, "fileName" | "duration" | "frames" | "script">) {
  return `[Kampagnevideo: ${v.fileName}, ${formatTime(v.duration)} min., vist som ${v.frames.length} stillbilleder]${
    v.script.trim() ? `\n\nManuskript/speak:\n${v.script.trim()}` : "\n\n(Intet manuskript angivet.)"
  }`;
}

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
export function abReactionModelSchema(video: boolean) {
  const reaction = video ? VideoReactionSchema : ReactionSchema;
  return z.object({
    version_1: reaction,
    version_2: reaction,
    foretrukket: z.enum(["version_1", "version_2", "ingen"]),
    begrundelse: z.string().describe("Kort, i egen stemme: hvorfor den ene frem for den anden (eller ingen)"),
  });
}

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

/** Feed metrics across video reactions; null when none of them were for a video. */
export function videoStats(reactions: Reaction[]) {
  const v = reactions.flatMap((r) => (r.video ? [r.video] : []));
  if (!v.length) return null;
  return {
    stopShare: v.filter((x) => x.stopper_op).length / v.length,
    avgWatch: v.reduce((s, x) => s + x.ville_se_til_ende, 0) / v.length,
  };
}

export function clampReaction(r: Reaction): Reaction {
  return {
    ...r,
    koebsvilje: clamp(r.koebsvilje, 1, 10),
    ...(r.video && { video: { ...r.video, ville_se_til_ende: clamp(r.video.ville_se_til_ende, 1, 10) } }),
  };
}
