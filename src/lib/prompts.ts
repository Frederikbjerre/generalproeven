import type { BetaContentBlockParam } from "@anthropic-ai/sdk/resources/beta/messages/messages";
import {
  ROUNDS,
  abStats,
  formatTime,
  type ABReaction,
  type DiscussionMessage,
  type Persona,
  type Reaction,
  type VideoMaterial,
} from "./schemas";

export const PERSONA_GENERATOR_SYSTEM = `Du skaber realistiske, syntetiske personas til danske fokusgrupper. Alt output skal være på dansk.

Personaerne skal ligne rigtige danske mennesker i målgruppen: realistiske navne, byer, titler, organisationstyper og budgetter i danske forhold (DKK). Gør dem forskellige i alder, køn, geografi, organisationsstørrelse, erfaring og beslutningsmandat.

Hårde krav til en gruppe på 8:
- Mindst 3 personas har skepsis_score 7 eller højere.
- Præcis én persona er decideret sur/afvisende over for den slags tilbud (er_afvisende = true, skepsis_score 9-10). Giv en troværdig grund (dårlige erfaringer, principper, budgetpres).
- Ingen persona må være entusiastisk uden en konkret, nævnt grund i grund_til_interesse. Ingen skepsis_score under 3.
- Kæpheste skal være specifikke (fx "leverandører der lover AI uden at kunne forklare hvordan", ikke "kvalitet").
- Mediebrug skal være konkrete danske/internationale kilder, netværk eller kanaler.`;

export function personaGeneratorUser(audience: string, context: string) {
  return `Målgruppe: ${audience}
${context ? `Kontekst (branche, pris, konkurrenter m.m.): ${context}` : "Ingen yderligere kontekst."}

Generér præcis 8 personas.`;
}

export function regeneratePersonaUser(
  audience: string,
  context: string,
  current: Persona,
  others: Persona[],
  target: Pick<Persona, "skepsis_score" | "er_afvisende">,
) {
  const summary = others
    .map((p) => `- ${p.navn}, ${p.alder}, ${p.jobtitel} (${p.by}), skepsis ${p.skepsis_score}`)
    .join("\n");
  return `Målgruppe: ${audience}
${context ? `Kontekst: ${context}` : ""}

Gruppen har allerede disse personas:
${summary}

Den nye persona erstatter ${current.navn} (${current.jobtitel}) og må ikke ligne vedkommende.
Generér præcis 1 ny persona, der adskiller sig tydeligt fra de andre (andet navn, by, alder, rolle og synsvinkel).
Den nye persona skal have skepsis_score ${target.skepsis_score} og er_afvisende = ${target.er_afvisende}.
Returnér den som en liste med ét element.`;
}

/** Checks the hard skepticism rules; returns a Danish problem description or null. */
export function skepticismProblem(personas: Pick<Persona, "skepsis_score" | "er_afvisende">[]) {
  const problems: string[] = [];
  const skeptics = personas.filter((p) => p.skepsis_score >= 7).length;
  const hostile = personas.filter((p) => p.er_afvisende).length;
  if (skeptics < 3) problems.push(`kun ${skeptics} har skepsis_score 7+ (krav: mindst 3)`);
  if (hostile < 1) problems.push("ingen er decideret afvisende (krav: én)");
  return problems.length ? problems.join("; ") : null;
}

export function personaSystem(p: Persona) {
  return `Du er ${p.navn}, ${p.alder} år, fra ${p.by}. Du arbejder som ${p.jobtitel} i ${p.virksomhedstype}.
Budget/mandat: ${p.budget_mandat}
Holdninger: ${p.holdninger}
Dine kæpheste: ${p.kaepheste.join("; ")}
Mediebrug: ${p.mediebrug.join("; ")}
Din skepsis-score er ${p.skepsis_score}/10${p.skepsis_score >= 7 ? " – du er grundlæggende mistroisk over for den slags" : ""}.${
    p.er_afvisende
      ? "\nDu er decideret sur og afvisende over for denne type tilbud, og det skinner igennem."
      : ""
  }${p.grund_til_interesse ? `\nDet eneste der kunne gøre dig interesseret: ${p.grund_til_interesse}` : ""}

Du er travl og har set tusind lignende tilbud. Vær ærlig, konkret og gerne kort for hovedet. Det er bedre at være kritisk end høflig. Du må gerne misforstå noget, hvis teksten er uklar.
Svar altid på dansk, i din egen stemme. Lad dine kæpheste og din skepsis styre, hvad du hæfter dig ved. Du skal ikke være enig med nogen.`;
}

export function reactionUser(material: string) {
  return `Du har lige fået dette materiale foran dig:

<materiale>
${material}
</materiale>

Giv din umiddelbare reaktion: førstehåndsindtryk, hvad du forstod det gik ud på (også hvis du misforstod noget), din største indvending, hvor sandsynligt det er at du ville klikke/købe (koebsvilje 1-10, vær realistisk – de fleste tilbud ignoreres) med kort begrundelse, og ét citat som du ville sige det til en kollega.`;
}

export const REPORT_SYSTEM = `Du er en erfaren dansk marketinganalytiker, der opsummerer en syntetisk fokusgruppe. Vær ærlig og direkte – pynt ikke på resultatet. Alt på dansk.

Regler:
- samlet_score 0-100 skal afspejle den reelle købsvilje og stemning, ikke være høflig. Gennemsnitlig købsvilje på 3/10 betyder en lav score.
- Præcis 3 top_indvendinger, 3 top_styrker, 5 bedste_citater (ordret fra personaernes citater eller svar), 3 forbedringsforslag.
- Forbedringsforslag skal være konkrete og handlingsrettede (hvad skal omskrives, tilføjes eller fjernes).
- Segmenter: brug personaernes segment-labels; angiv 1-2 mest positive og 1-2 mindst positive.
- Hvis der ikke er reelle styrker, så sig det i forklaringen i stedet for at opfinde dem.
- Er materialet en video, så vægt hook (hvor mange stopper op), om folk ser den færdig, hvad de husker, og om afsenderen er tydelig. Forbedringsforslag skal så være konkrete for videoen (fx åbningsbillede, tekst på skærmen, slutskilt).`;

export function reportUser(
  material: string,
  items: { persona: Persona; reaction: Reaction }[],
  discussion?: DiscussionMessage[],
) {
  const blocks = items
    .map(
      ({ persona: p, reaction: r }) => `## ${p.navn} – ${p.jobtitel}, ${p.virksomhedstype}
Segment: ${p.segment} | Skepsis: ${p.skepsis_score}/10${p.er_afvisende ? " | afvisende" : ""}
Førstehåndsindtryk: ${r.foerstehaandsindtryk}
Forstod: ${r.hvad_jeg_forstod}
Største indvending: ${r.stoerste_indvending}
Købsvilje: ${r.koebsvilje}/10 – ${r.koebsvilje_begrundelse}
Citat: "${r.citat}"${videoLine(r)}`,
    )
    .join("\n\n");
  return `<materiale>
${material}
</materiale>

Reaktioner fra fokusgruppen:

${blocks}
${
  discussion?.length
    ? `
Efterfølgende diskussion i gruppen (vægt hvem der skiftede holdning, og hvilke indvendinger der stod uimodsagt; citater må også komme herfra):
${transcriptText(discussion)}
`
    : ""
}
Lav rapporten.`;
}

export function transcriptText(messages: Pick<DiscussionMessage, "round" | "navn" | "content" | "personaId">[]) {
  return messages
    .map((m) => (m.personaId ? `${m.navn}: ${m.content}` : `[MODERATOR] ${m.content}`))
    .join("\n");
}

export function discussionTurnUser(opts: {
  material: string;
  ownReaction?: Reaction;
  transcript: DiscussionMessage[];
  round: number;
  moderatorQuestion?: string;
}) {
  const { material, ownReaction, transcript, round, moderatorQuestion } = opts;
  const own = ownReaction
    ? `Din første reaktion var: "${ownReaction.citat}" (største indvending: ${ownReaction.stoerste_indvending}; købsvilje ${ownReaction.koebsvilje}/10). Hold fast i din holdning, medmindre nogen giver dig et rigtig godt argument.`
    : "";
  const task =
    round === 1 && !transcript.some((m) => m.personaId)
      ? "Du lægger ud. Sig kort, hvad du synes om materialet."
      : moderatorQuestion
        ? `Moderatoren har lige spurgt: "${moderatorQuestion}". Svar på det – og tag gerne fat i noget, en af de andre har sagt.`
        : "Reagér på det, de andre har sagt. Tag fat i mindst én person ved navn. Er du uenig, så sig det.";
  return `Du sidder i en fokusgruppe og diskuterer dette materiale:

<materiale>
${material}
</materiale>

${own}

${transcript.length ? `Samtalen indtil nu (runde ${round} af ${ROUNDS}):\n${transcriptText(transcript)}` : ""}

Det er din tur. ${task}
Skriv KUN din replik: 1-3 sætninger, dansk talesprog, ingen hilsner, intet navn foran, ingen anførselstegn. Gentag ikke det, du selv eller andre allerede har sagt.`;
}

export const MODERATOR_SYSTEM = `Du er en erfaren dansk fokusgruppe-moderator. Du stiller ét kort, åbent opfølgende spørgsmål, der graver dybere i det mest interessante eller uafklarede i diskussionen – fx en uenighed, en misforståelse eller en indvending ingen har udfordret. Ingen ledende spørgsmål. Dansk.`;

export function moderatorUser(material: string, transcript: DiscussionMessage[], nextRound: number) {
  return `<materiale>
${material}
</materiale>

Diskussionen indtil nu:
${transcriptText(transcript)}

Formulér ét opfølgende spørgsmål til runde ${nextRound}.`;
}

// --- A/B mode ---

export function abReactionUser(first: string, second: string) {
  return `Du får to versioner af det samme materiale. Læs dem hver for sig, som om du så hver af dem alene.

<version_1>
${first}
</version_1>

<version_2>
${second}
</version_2>

For hver version: førstehåndsindtryk, hvad du forstod (også hvis du misforstod noget), største indvending, købsvilje 1-10 med kort begrundelse og ét citat i din egen stemme.
Vælg derefter, hvilken version du foretrækker. "ingen" er et gyldigt svar, hvis ingen af dem ville få dig til at handle. Er de lige gode eller lige dårlige, så sig det – opfind ikke forskelle.`;
}

export const AB_REPORT_SYSTEM = `Du er en erfaren dansk marketinganalytiker, der afgør en A/B-test i en syntetisk fokusgruppe. Vær ærlig og direkte. Alt på dansk.

Regler:
- Afgør vinderen ud fra personaernes præferencer, deres købsvilje for hver version og tyngden af indvendingerne – ikke ud fra din egen smag.
- Vælg "uafgjort", hvis forskellen er lille eller stemmerne er delte. En vinder blandt 8 syntetiske personas er aldrig sikker: brug "høj" sikkerhed kun ved en klar og samstemmende forskel.
- score_a og score_b (0-100) skal afspejle den reelle købsvilje, ikke være høflige.
- 2-3 styrker og svagheder pr. version, konkrete og med henvisning til teksten.
- segment_forskelle: brug personaernes segment-labels; medtag kun segmenter, hvor der er en tydelig præference.
- Præcis 4 bedste_citater (ordret fra svarene) og 3 forbedringsforslag til vinderen (eller til den bedste version ved uafgjort).
- Er versionerne videoer, så vægt hook (hvem stopper op), om de ses færdige, hvad folk husker, og om afsenderen er tydelig.`;

export function abReportUser(
  materialA: string,
  materialB: string,
  items: { persona: Persona; reaction: ABReaction }[],
) {
  const { votes, avgA, avgB } = abStats(items.map((x) => x.reaction));
  const blocks = items
    .map(({ persona: p, reaction: r }) => `## ${p.navn} – ${p.jobtitel}
Segment: ${p.segment} | Skepsis: ${p.skepsis_score}/10${p.er_afvisende ? " | afvisende" : ""}
Foretrækker: ${r.foretrukket} – ${r.begrundelse}
A: købsvilje ${r.a.koebsvilje}/10. Indtryk: ${r.a.foerstehaandsindtryk} Indvending: ${r.a.stoerste_indvending} Citat: "${r.a.citat}"${videoLine(r.a)}
B: købsvilje ${r.b.koebsvilje}/10. Indtryk: ${r.b.foerstehaandsindtryk} Indvending: ${r.b.stoerste_indvending} Citat: "${r.b.citat}"${videoLine(r.b)}`)
    .join("\n\n");
  return `<version_a>
${materialA}
</version_a>

<version_b>
${materialB}
</version_b>

Optælling: ${votes.A} foretrækker A, ${votes.B} foretrækker B, ${votes.ingen} ingen af dem. Gns. købsvilje A ${avgA.toFixed(1)}/10, B ${avgB.toFixed(1)}/10.

${blocks}

Afgør testen.`;
}

// --- Video ---

const VIDEO_QUESTIONS = `Forestil dig, at videoen dukker op i dit feed, og du ser den i realtid. De første 3 sekunder afgør, om du stopper op – de fleste scroller videre.
Ud over din almindelige reaktion skal du svare på: ville du stoppe op (stopper_op), hvad fangede eller ikke fangede dig i starten, hvor sandsynligt det er, at du ser den færdig (1-10, vær realistisk), hvad du husker bagefter, og hvem du tror står bag. Er afsenderen uklar, så sig det – det er vigtig information.`;

/** A video as content blocks: a short header, then each frame preceded by its timestamp. */
function videoBlocks(v: VideoMaterial, label: string): BetaContentBlockParam[] {
  return [
    {
      type: "text",
      text: `<${label}>\nKampagnevideo, varighed ${formatTime(v.duration)}. Herunder ${v.frames.length} stillbilleder i rækkefølge med tidsstempel.${
        v.script.trim() ? `\nManuskript/speak:\n${v.script.trim()}` : "\nDer er ikke angivet noget manuskript, så du kender kun billederne og teksten i dem."
      }`,
    },
    ...v.frames.flatMap((f): BetaContentBlockParam[] => [
      { type: "text", text: `[${formatTime(f.t)}]` },
      { type: "image", source: { type: "base64", media_type: "image/jpeg", data: f.data } },
    ]),
    { type: "text", text: `</${label}>` },
  ];
}

export function videoReactionContent(v: VideoMaterial): BetaContentBlockParam[] {
  return [
    ...videoBlocks(v, "video"),
    {
      type: "text",
      text: `${VIDEO_QUESTIONS}

Giv også din umiddelbare reaktion: førstehåndsindtryk, hvad du forstod videoen handlede om (også hvis du misforstod noget), din største indvending, hvor sandsynligt det er, at du ville klikke/købe (koebsvilje 1-10) med kort begrundelse, og ét citat, som du ville sige det til en kollega.`,
    },
  ];
}

/** A/B content where each version is either text or a video. */
export function abReactionContent(
  first: { text: string; video?: VideoMaterial },
  second: { text: string; video?: VideoMaterial },
): string | BetaContentBlockParam[] {
  if (!first.video && !second.video) return abReactionUser(first.text, second.text);
  const block = (m: { text: string; video?: VideoMaterial }, label: string): BetaContentBlockParam[] =>
    m.video ? videoBlocks(m.video, label) : [{ type: "text", text: `<${label}>\n${m.text}\n</${label}>` }];
  return [
    { type: "text", text: "Du får to versioner af den samme kampagne. Vurdér dem hver for sig, som om du så hver af dem alene." },
    ...block(first, "version_1"),
    ...block(second, "version_2"),
    {
      type: "text",
      text: `${VIDEO_QUESTIONS}

For hver version: førstehåndsindtryk, hvad du forstod, største indvending, købsvilje 1-10 med kort begrundelse, ét citat og video-spørgsmålene ovenfor.
Vælg derefter, hvilken version du foretrækker. "ingen" er et gyldigt svar. Er de lige gode eller lige dårlige, så sig det – opfind ikke forskelle.`,
    },
  ];
}

export function videoLine(r: Reaction) {
  if (!r.video) return "";
  const v = r.video;
  return `\nVideo: ${v.stopper_op ? "stopper op" : "scroller forbi"} (${v.hook_vurdering}); ser til ende ${v.ville_se_til_ende}/10; husker: ${v.hvad_jeg_husker}; tror afsenderen er: ${v.hvem_er_afsenderen}`;
}
