import "server-only";
import {
  abStats,
  type ABChoice,
  type ABReaction,
  type ABReport,
  type DiscussionMessage,
  type Persona,
  type Reaction,
  type Report,
  type VideoFields,
  type VideoMaterial,
} from "./schemas";

// Demo mode: canned Danish data so the whole flow can be tried without an API key.
// Active when ANTHROPIC_API_KEY is unset, or forced with DEMO_MODE=1.

export const isDemo = () => process.env.DEMO_MODE === "1" || !process.env.ANTHROPIC_API_KEY;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
export const fakeLatency = () => sleep(600 + Math.random() * 2400);

type Base = Omit<Persona, "id" | "segment">;

const POOL: Base[] = [
  {
    navn: "Henrik Mølgaard", alder: 58, by: "Viborg", jobtitel: "Afdelingschef",
    virksomhedstype: "Offentlig organisation, ca. 900 ansatte",
    budget_mandat: "Kan godkende op til 250.000 kr. alene; større køb kræver udbud",
    holdninger: "Har prøvet tre 'revolutionerende' løsninger, som alle endte som hyldevare. Stoler kun på kolleger.",
    kaepheste: ["Sælgere der ringer uopfordret", "Licensmodeller der stiger år to", "Buzzwords uden cases"],
    mediebrug: ["Version2", "LinkedIn (læser, poster aldrig)", "Faglige netværksmøder"],
    skepsis_score: 10, er_afvisende: true, grund_til_interesse: "",
  },
  {
    navn: "Mette Kjærsgaard", alder: 46, by: "Aarhus", jobtitel: "Indkøbschef",
    virksomhedstype: "Mellemstor produktionsvirksomhed, 320 ansatte",
    budget_mandat: "Ansvarlig for indkøbsbudget på 40 mio. kr.; skal have CFO med over 500.000 kr.",
    holdninger: "Tænker i total cost of ownership. Gider ikke læse marketingsprog.",
    kaepheste: ["Skjulte implementeringsomkostninger", "Ingen danske referencer", "Uklar exit-strategi"],
    mediebrug: ["Børsen", "Indkøbsnetværket DILF", "Nyhedsbreve fra branchen"],
    skepsis_score: 8, er_afvisende: false, grund_til_interesse: "Hvis det dokumenterbart sparer tid i indkøbsprocessen",
  },
  {
    navn: "Jonas Holst", alder: 34, by: "København", jobtitel: "Digital projektleder",
    virksomhedstype: "Konsulenthus, 60 ansatte",
    budget_mandat: "Kan teste værktøjer for op til 5.000 kr./md. uden godkendelse",
    holdninger: "Nysgerrig på nye værktøjer, men har ingen tålmodighed med dårlig onboarding.",
    kaepheste: ["Demo-booking i stedet for gratis prøveperiode", "Langsomme websites", "Mangel på integrationer"],
    mediebrug: ["LinkedIn", "Podcasts (Prompt, Techtopia)", "Product Hunt"],
    skepsis_score: 4, er_afvisende: false, grund_til_interesse: "Hvis han kan prøve det selv samme dag og vise det til en kunde",
  },
  {
    navn: "Birgitte Lund", alder: 52, by: "Odense", jobtitel: "Økonomichef",
    virksomhedstype: "Regional virksomhed i service, 180 ansatte",
    budget_mandat: "Ejer budgettet; skal forklare alle nye udgifter for direktionen",
    holdninger: "Vil se tal, ikke løfter. Er træt af abonnementer, der hober sig op.",
    kaepheste: ["Priser 'fra' uden reel pris", "ROI-beregninger uden forudsætninger", "Engelske fagudtryk"],
    mediebrug: ["Børsen", "FSR-nyhedsbrev", "Erhvervsnetværk i Odense"],
    skepsis_score: 7, er_afvisende: false, grund_til_interesse: "Hvis prisen er fast og der er en klar besparelse",
  },
  {
    navn: "Ahmad Rahimi", alder: 39, by: "Aalborg", jobtitel: "IT-ansvarlig",
    virksomhedstype: "Lille virksomhed, 35 ansatte",
    budget_mandat: "Anbefaler; direktøren beslutter alt over 20.000 kr.",
    holdninger: "Gør alt selv og har ikke tid til endnu et system. Pragmatisk.",
    kaepheste: ["GDPR-uklarhed", "Data hostet uden for EU", "Systemer der kræver kursus"],
    mediebrug: ["Reddit", "YouTube-tutorials", "Computerworld"],
    skepsis_score: 6, er_afvisende: false, grund_til_interesse: "Hvis det fjerner manuelt arbejde, han hader",
  },
  {
    navn: "Louise Bech", alder: 29, by: "Roskilde", jobtitel: "Marketingkoordinator",
    virksomhedstype: "E-handelsvirksomhed, 25 ansatte",
    budget_mandat: "Intet eget budget; kan foreslå værktøjer til sin chef",
    holdninger: "Positiv over for nyt, men skal kunne argumentere opad.",
    kaepheste: ["Tekster der lover alt", "Ingen eksempler fra lignende virksomheder"],
    mediebrug: ["Instagram", "LinkedIn", "Nyhedsbreve fra Shopify-økosystemet"],
    skepsis_score: 3, er_afvisende: false, grund_til_interesse: "Hvis hun kan bruge det til at vise resultater til sin chef",
  },
  {
    navn: "Per Søndergaard", alder: 61, by: "Esbjerg", jobtitel: "Administrerende direktør",
    virksomhedstype: "Familieejet virksomhed, 110 ansatte",
    budget_mandat: "Fuldt mandat, men bruger sjældent penge på 'luft'",
    holdninger: "Køber af folk han kender. Mener det meste software er overvurderet.",
    kaepheste: ["Unge sælgere uden branchekendskab", "Lange kontrakter", "Ingen telefon man kan ringe til"],
    mediebrug: ["JydskeVestkysten", "Dansk Industri", "Golfklubben"],
    skepsis_score: 8, er_afvisende: false, grund_til_interesse: "Hvis en han kender i branchen bruger det",
  },
  {
    navn: "Sara Damgaard", alder: 41, by: "Kolding", jobtitel: "Forretningsudviklingschef",
    virksomhedstype: "Vækstvirksomhed, 75 ansatte",
    budget_mandat: "Har innovationsbudget på 800.000 kr. årligt",
    holdninger: "Vil gerne være first mover, men er blevet brændt på en leverandør der lukkede.",
    kaepheste: ["Startups uden finansiering", "Ingen roadmap", "Pilotprojekter uden succeskriterier"],
    mediebrug: ["LinkedIn", "Børsen Executive", "Konferencer (TechBBQ)"],
    skepsis_score: 5, er_afvisende: false, grund_til_interesse: "Hvis der er en kort pilot med klare succeskriterier",
  },
  {
    navn: "Karsten Vinther", alder: 49, by: "Herning", jobtitel: "Driftschef",
    virksomhedstype: "Logistikvirksomhed, 240 ansatte",
    budget_mandat: "Kan godkende op til 100.000 kr.",
    holdninger: "Interesserer sig kun for oppetid og færre opkald fra medarbejdere.",
    kaepheste: ["Leverandører der ikke svarer", "Opdateringer der ændrer alt", "Fancy dashboards ingen bruger"],
    mediebrug: ["Transportmagasinet", "LinkedIn", "Brancheforeningen"],
    skepsis_score: 9, er_afvisende: false, grund_til_interesse: "Hvis der er dansk support med svartid på timer",
  },
];

export function demoPersonas(audience: string): Persona[] {
  return POOL.slice(0, 8).map((p) => ({ ...p, id: crypto.randomUUID(), segment: segmentFor(p, audience) }));
}

export function demoReplacement(
  current: Persona,
  others: Persona[],
  target: Pick<Persona, "skepsis_score" | "er_afvisende">,
  audience: string,
): Persona {
  const taken = new Set([current, ...others].map((o) => o.navn));
  const p = POOL.find((x) => !taken.has(x.navn)) ?? POOL[POOL.length - 1];
  return { ...p, ...target, id: crypto.randomUUID(), segment: segmentFor(p, audience) };
}

function segmentFor(p: Base, audience: string) {
  const size = /(\d+)\s*ansatte/.exec(p.virksomhedstype)?.[1];
  const scale = size && Number(size) >= 200 ? "Større organisation" : "Mindre organisation";
  return `${scale}, ${audience.trim().slice(0, 30) || "målgruppe"}`;
}

const pick = <T,>(xs: T[], seed: number) => xs[seed % xs.length];

export function demoReaction(p: Persona, material: string, video?: VideoMaterial): Reaction {
  const seed = p.navn.length + material.length;
  const source = video ? video.script || video.fileName : material;
  const teaser = source.trim().replace(/\s+/g, " ").slice(0, 70);
  const buy = Math.max(1, Math.min(10, 11 - p.skepsis_score + ((seed % 3) - 1)));
  const tier = p.er_afvisende ? "hostile" : p.skepsis_score >= 7 ? "skeptic" : p.skepsis_score >= 5 ? "neutral" : "open";
  const t = {
    hostile: {
      indtryk: "Endnu en sælger der tror, de har opfundet den dybe tallerken. Jeg stoppede efter første linje.",
      citat: "Smid det i bunken med de andre. Vi har ikke tid til det her.",
    },
    skeptic: {
      indtryk: "Meget snak og få beviser. Jeg leder efter en pris og en reference, og jeg finder ingen af delene.",
      citat: "Vis mig én dansk kunde, der har sparet penge, så gider jeg læse videre.",
    },
    neutral: {
      indtryk: "Der er noget, men jeg skal læse det to gange for at forstå, hvad det konkret gør for mig.",
      citat: "Måske. Men hvad koster det, og hvor lang tid tager det at komme i gang?",
    },
    open: {
      indtryk: "Det fanger mig faktisk. Jeg kan se en use case, men teksten hjælper mig ikke med at sælge det internt.",
      citat: "Jeg ville prøve det, hvis jeg kan komme i gang uden at booke et møde.",
    },
  }[tier];
  return {
    foerstehaandsindtryk: t.indtryk,
    hvad_jeg_forstod: `At "${teaser}${source.length > 70 ? "…" : ""}" er en form for løsning, der skal spare tid – men hvad den præcist gør, står ikke klart.`,
    stoerste_indvending: pick(p.kaepheste, seed),
    koebsvilje: buy,
    koebsvilje_begrundelse:
      buy >= 7 ? `Interessant – ${p.grund_til_interesse.toLowerCase() || "hvis det holder"}.`
      : buy >= 4 ? "Ikke nu. Jeg skal se mere konkret dokumentation først."
      : "Nej. Intet her rammer et problem, jeg har lige nu.",
    citat: t.citat,
    ...(video && { video: demoVideoFields(tier, buy, seed) }),
  };
}

function demoVideoFields(tier: "hostile" | "skeptic" | "neutral" | "open", buy: number, seed: number): VideoFields {
  const stops = tier === "open" || (tier === "neutral" && seed % 2 === 0);
  return {
    stopper_op: stops,
    hook_vurdering: stops
      ? "Åbningsbilledet er roligt, men der står en konkret påstand på skærmen, der fik mig til at blive."
      : "De første sekunder ligner alle andre reklamer. Jeg var videre, før jeg vidste, hvad det handlede om.",
    ville_se_til_ende: Math.max(1, Math.min(10, buy + (stops ? 2 : -1))),
    hvad_jeg_husker: stops ? "At det skulle spare tid, og slutskiltet med prisen." : "Ikke ret meget. Noget med en skærm og en glad medarbejder.",
    hvem_er_afsenderen: tier === "hostile" || seed % 3 === 0 ? "Aner det ikke – logoet kom først til sidst." : "Den virksomhed, hvis logo står på slutskiltet.",
  };
}

export function demoReport(items: { persona: Persona; reaction: Reaction }[], discussion?: DiscussionMessage[]): Report {
  const avg = items.reduce((s, x) => s + x.reaction.koebsvilje, 0) / items.length;
  const bySkepsis = [...items].sort((a, b) => b.persona.skepsis_score - a.persona.skepsis_score);
  const bySegment = new Map<string, number[]>();
  for (const { persona, reaction } of items) {
    bySegment.set(persona.segment, [...(bySegment.get(persona.segment) ?? []), reaction.koebsvilje]);
  }
  const segs = [...bySegment.entries()]
    .map(([segment, xs]) => ({ segment, avg: xs.reduce((a, b) => a + b, 0) / xs.length }))
    .sort((a, b) => b.avg - a.avg);
  return {
    samlet_score: Math.round(avg * 10),
    samlet_vurdering: `Demo-rapport baseret på fiktive svar. Gennemsnitlig købsvilje er ${avg.toFixed(1)}/10. De skeptiske personas savner pris og danske referencer.${discussion?.length ? ` Diskussionen (${discussion.filter((m) => m.personaId).length} replikker) flyttede ingen af de skeptiske.` : ""}`,
    top_indvendinger: bySkepsis.slice(0, 3).map(({ persona, reaction }) => ({
      titel: reaction.stoerste_indvending,
      forklaring: `Rejst af ${persona.navn} (${persona.jobtitel}).`,
    })),
    top_styrker: [
      { titel: "Relevant problem", forklaring: "De mest åbne personas genkender behovet." },
      { titel: "Kort tekst", forklaring: "Materialet kan læses på under et minut." },
      { titel: "Klar afsender", forklaring: "Det er tydeligt, hvem der sælger." },
    ],
    bedste_citater: items
      .flatMap(({ persona, reaction }) => [
        { persona_navn: persona.navn, citat: reaction.citat },
        { persona_navn: persona.navn, citat: reaction.foerstehaandsindtryk },
      ])
      .filter((c, i, all) => all.findIndex((x) => x.citat === c.citat) === i)
      .slice(0, 5),
    mest_positive_segmenter: segs.slice(0, 1).map((s) => ({ segment: s.segment, begrundelse: `Gns. købsvilje ${s.avg.toFixed(1)}/10.` })),
    mindst_positive_segmenter: segs.slice(-1).map((s) => ({ segment: s.segment, begrundelse: `Gns. købsvilje ${s.avg.toFixed(1)}/10.` })),
    forbedringsforslag: [
      { forslag: "Sæt en konkret pris i teksten", begrundelse: "Flere personas stoppede, fordi de ikke kunne se, hvad det koster." },
      { forslag: "Tilføj én navngiven dansk reference", begrundelse: "De skeptiske personas vil se, at andre som dem har brugt det." },
      { forslag: "Tilbyd at prøve det selv uden møde", begrundelse: "De mest åbne personas vil i gang uden at booke en demo." },
    ],
  };
}

const TURN_LINES = {
  hostile: [
    "{prev}, du er alt for venlig. Det her er præcis den slags, vi har fået solgt fem gange før.",
    "Jeg har ikke ændret mening. Der står intet om, hvad det koster, og så er jeg ude.",
    "Nej. Uanset hvad moderatoren spørger om: ingen pris, ingen reference, intet møde.",
  ],
  skeptic: [
    "Jeg er enig med {prev} i, at det er uklart. Hvor er tallene bag de 30 procent?",
    "{prev} har en pointe, men jeg skal stadig se én dansk kunde, før jeg gider bruge tid på det.",
    "Hvis de kunne vise mig en fast pris og en exit-klausul, så ville jeg måske læse videre.",
  ],
  neutral: [
    "Jeg forstår godt {prev}, men problemet de beskriver, har vi faktisk. Spørgsmålet er bare, om det virker hos os.",
    "Jeg hælder lidt mere til nej efter at have hørt {prev}. Det lyder dyrt at komme i gang.",
    "En kort pilot med klare mål kunne overbevise mig. En demo kan ikke.",
  ],
  open: [
    "Altså, jeg synes nu, {prev} er lidt hård. Hvis jeg kunne prøve det i en uge, ville jeg gøre det.",
    "Okay, {prev} har ret i, at prisen mangler. Det ville jeg også skulle forklare min chef.",
    "Jeg er stadig positiv, men teksten skal give mig noget, jeg kan sende videre internt.",
  ],
};

const OPENERS = {
  hostile: "Jeg kan lige så godt starte: det her er spild af min tid. Ingen pris, ingen kunder, bare løfter.",
  skeptic: "Jeg starter. Påstanden om 30 procent står helt alene – der er ikke ét tal, der underbygger den.",
  neutral: "Jeg kan godt se problemet, de prøver at løse, men jeg forstår ikke helt, hvad produktet gør.",
  open: "Jeg synes faktisk, det er spændende – men jeg mangler at vide, hvad det koster.",
};

export function demoTurn(p: Persona, transcript: DiscussionMessage[], round: number) {
  const tier = p.er_afvisende ? "hostile" : p.skepsis_score >= 7 ? "skeptic" : p.skepsis_score >= 5 ? "neutral" : "open";
  const prev = [...transcript].reverse().find((m) => m.personaId && m.personaId !== p.id)?.navn.split(" ")[0];
  if (!prev) return OPENERS[tier];
  return TURN_LINES[tier][(round - 1) % 3].replace("{prev}", prev);
}

const MODERATOR_QUESTIONS = [
  "Flere af jer nævner prisen. Hvad skulle der konkret stå, før I ville tage kontakt?",
  "Hvem i jeres organisation skulle overbevises, og hvad ville de spørge om først?",
];

export const demoModeratorQuestion = (nextRound: number) =>
  MODERATOR_QUESTIONS[(nextRound - 2) % MODERATOR_QUESTIONS.length];

/** Streams a canned line word by word so the demo looks like live output. */
export function demoStream(text: string) {
  const words = text.split(/(?<= )/);
  const encoder = new TextEncoder();
  return new ReadableStream<Uint8Array>({
    async start(controller) {
      await sleep(400 + Math.random() * 600);
      for (const w of words) {
        controller.enqueue(encoder.encode(w));
        await sleep(40 + Math.random() * 60);
      }
      controller.close();
    },
  });
}

// --- A/B mode ---

export function demoABReaction(
  p: Persona,
  materialA: string,
  materialB: string,
  videoA?: VideoMaterial,
  videoB?: VideoMaterial,
): ABReaction {
  const a = demoReaction(p, materialA, videoA);
  const b = demoReaction(p, materialB, videoB);
  // Deterministic but persona-dependent nudge, so the demo shows a split vote
  const nudge = ((p.navn.length + materialB.length - materialA.length) % 3) - 1;
  b.koebsvilje = Math.max(1, Math.min(10, b.koebsvilje + nudge + (materialB.length > materialA.length ? 1 : 0)));
  const foretrukket: ABChoice =
    a.koebsvilje <= 3 && b.koebsvilje <= 3 ? "ingen" : a.koebsvilje === b.koebsvilje ? "ingen" : a.koebsvilje > b.koebsvilje ? "A" : "B";
  const begrundelse = {
    A: "A er kortere og kommer hurtigere til sagen.",
    B: "B giver mig flere konkrete detaljer at forholde mig til.",
    ingen: "Ingen af dem rammer mig. De lover det samme uden at bevise noget.",
  }[foretrukket];
  return { a, b, foretrukket, begrundelse };
}

export function demoABReport(items: { persona: Persona; reaction: ABReaction }[]): ABReport {
  const { votes, avgA, avgB } = abStats(items.map((x) => x.reaction));
  const diff = votes.A - votes.B;
  const vinder = Math.abs(diff) <= 1 ? "uafgjort" : diff > 0 ? "A" : "B";
  const quotes = items.slice(0, 4).map(({ persona, reaction }, i) => {
    const version = i % 2 === 0 ? "A" : "B";
    return { persona_navn: persona.navn, version, citat: (version === "A" ? reaction.a : reaction.b).citat } as const;
  });
  return {
    vinder,
    sikkerhed: Math.abs(diff) >= 4 ? "middel" : "lav",
    begrundelse: `Demo-rapport baseret på fiktive svar. ${votes.A} foretrækker A, ${votes.B} foretrækker B og ${votes.ingen} ingen af dem. Gns. købsvilje er ${avgA.toFixed(1)} for A og ${avgB.toFixed(1)} for B.`,
    score_a: Math.round(avgA * 10),
    score_b: Math.round(avgB * 10),
    styrker_a: ["Kort og let at skimme", "Klart budskab i første linje"],
    svagheder_a: ["Ingen pris", "Ingen dokumentation for løftet"],
    styrker_b: ["Flere konkrete detaljer", "Tydeligere næste skridt"],
    svagheder_b: ["Længere at læse", "Stadig ingen dansk reference"],
    segment_forskelle: [],
    bedste_citater: quotes,
    forbedringsforslag: [
      { forslag: "Sæt en konkret pris i teksten", begrundelse: "Begge versioner mister de skeptiske på manglende pris." },
      { forslag: "Tilføj én navngiven dansk kunde", begrundelse: "Det efterspørges i næsten alle svar." },
      { forslag: "Tilbyd at prøve uden møde", begrundelse: "De mest åbne personas vil i gang selv." },
    ],
  };
}
