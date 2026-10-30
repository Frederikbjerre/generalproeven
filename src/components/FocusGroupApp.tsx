"use client";

import { useMemo, useState } from "react";
import { videoStats, type DiscussionMessage, type Persona, type Reaction, type Report } from "@/lib/schemas";
import { errMsg, post } from "@/lib/http";
import { createStore, type Store } from "@/lib/store";
import { ABTest, type ABTestData } from "./ABTest";
import { Avatar } from "./Avatar";
import { DiscussionRoom } from "./DiscussionRoom";
import { MaterialInput, materialReady, type MaterialSource } from "./MaterialInput";
import { PersonaCard, SkepsisBadge } from "./PersonaCard";
import { ReportView } from "./ReportView";
import { VideoAnswers } from "./VideoAnswers";
import { StepTitle } from "./StepTitle";

/** A saved project and its latest test (single or A/B), loaded on the server. Absent in local mode. */
export type ProjectData = {
  project: { id: string; name: string; audience: string; context: string };
  personas: Persona[];
  test: {
    id: string;
    material: string;
    source: MaterialSource;
    reactions: Record<string, Reaction>;
    discussion: DiscussionMessage[];
    report: Report | null;
    reportIncludesDiscussion: boolean;
  } | null;
  abTest: ABTestData | null;
};

type ReactionState =
  | { status: "loading" }
  | { status: "done"; reaction: Reaction }
  | { status: "error"; error: string };

export function FocusGroupApp({ initial, header }: { initial?: ProjectData; header?: React.ReactNode }) {
  const test = initial?.test;
  const projectId = initial?.project.id;
  const store = useMemo(() => (projectId ? createStore(projectId) : null), [projectId]);
  const [saveError, setSaveError] = useState<string | null>(null);

  /** Runs a save in the background; failures show a warning but never block the flow. */
  function save(fn: (s: Store) => Promise<unknown>) {
    if (!store) return Promise.resolve();
    return fn(store).then(
      () => undefined,
      (e) => setSaveError(`Kunne ikke gemme: ${errMsg(e)}`),
    );
  }

  const [audience, setAudience] = useState(initial?.project.audience ?? "");
  const [context, setContext] = useState(initial?.project.context ?? "");
  const [personas, setPersonas] = useState<Persona[]>(initial?.personas ?? []);
  const [generating, setGenerating] = useState(false);
  const [warning, setWarning] = useState<string | null>(null);
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set());

  const [material, setMaterial] = useState(test?.material ?? "");
  const [source, setSource] = useState<MaterialSource>(test?.source ?? { type: "text", url: null });
  const [testId, setTestId] = useState<string | null>(test?.id ?? null);
  const [reactions, setReactions] = useState<Record<string, ReactionState>>(() =>
    Object.fromEntries(Object.entries(test?.reactions ?? {}).map(([id, reaction]) => [id, { status: "done", reaction }])),
  );
  const [testing, setTesting] = useState(false);

  const [report, setReport] = useState<Report | null>(test?.report ?? null);
  const [reportLoading, setReportLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [demo, setDemo] = useState(false);

  const [mode, setMode] = useState<"single" | "ab">(initial?.abTest ? "ab" : "single");
  const [abBusy, setAbBusy] = useState(false);

  const [testRun, setTestRun] = useState(0);
  const [discussion, setDiscussion] = useState<DiscussionMessage[]>(test?.discussion ?? []);
  const [reportIncludesDiscussion, setReportIncludesDiscussion] = useState(test?.reportIncludesDiscussion ?? false);

  const skeptics = personas.filter((p) => p.skepsis_score >= 7).length;
  const hostile = personas.some((p) => p.er_afvisende);
  const doneReactions = personas.flatMap((p) => {
    const r = reactions[p.id];
    return r?.status === "done" ? [{ persona: p, reaction: r.reaction }] : [];
  });
  const avgBuy = doneReactions.length
    ? doneReactions.reduce((s, x) => s + x.reaction.koebsvilje, 0) / doneReactions.length
    : 0;

  async function generate() {
    setGenerating(true);
    setError(null);
    setWarning(null);
    setReactions({});
    setReport(null);
    setTestId(null);
    setDiscussion([]);
    try {
      const data = await post<{ personas: Persona[]; warning: string | null; demo?: boolean }>("/api/personas", {
        audience,
        context,
      });
      setPersonas(data.personas);
      setWarning(data.warning);
      setDemo(!!data.demo);
      void save(async (s) => {
        await s.saveBrief(audience, context);
        await s.replacePersonas(data.personas);
      });
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setGenerating(false);
    }
  }

  function setBusy(id: string, on: boolean) {
    setBusyIds((prev) => {
      const next = new Set(prev);
      if (on) next.add(id);
      else next.delete(id);
      return next;
    });
  }

  async function regenerate(p: Persona) {
    setBusy(p.id, true);
    setError(null);
    try {
      const { persona } = await post<{ persona: Persona }>("/api/personas", {
        audience,
        context,
        replace: {
          current: p,
          others: personas.filter((x) => x.id !== p.id),
          target: { skepsis_score: p.skepsis_score, er_afvisende: p.er_afvisende },
        },
      });
      // Keep the slot's id so the saved row is updated in place
      const replaced = { ...persona, id: p.id };
      setPersonas((prev) => prev.map((x) => (x.id === p.id ? replaced : x)));
      void save((s) => s.updatePersona(replaced));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setBusy(p.id, false);
    }
  }

  async function runTest() {
    setTesting(true);
    setError(null);
    setReport(null);
    setDiscussion([]);
    setTestRun((n) => n + 1);
    setReactions(Object.fromEntries(personas.map((p) => [p.id, { status: "loading" } as ReactionState])));

    let newTestId: string | null = null;
    if (store) {
      try {
        newTestId = await store.createTest({ input_type: source.type, input_text: material, source_url: source.url });
      } catch (e) {
        setSaveError(`Kunne ikke gemme testen: ${errMsg(e)}`);
      }
    }
    setTestId(newTestId);

    const results = await Promise.all(
      personas.map(async (persona) => {
        try {
          const { reaction } = await post<{ reaction: Reaction }>("/api/react", { persona, material, video: source.video });
          setReactions((prev) => ({ ...prev, [persona.id]: { status: "done", reaction } }));
          if (newTestId) void save((s) => s.saveReaction(newTestId, persona.id, reaction));
          return { persona, reaction };
        } catch (e) {
          setReactions((prev) => ({ ...prev, [persona.id]: { status: "error", error: errMsg(e) } }));
          return null;
        }
      }),
    );
    setTesting(false);

    const items = results.filter((x): x is { persona: Persona; reaction: Reaction } => x !== null);
    if (!items.length) {
      setError("Ingen af personaerne kunne svare. Prøv igen.");
      return;
    }
    await generateReport(items, undefined, newTestId);
  }

  async function generateReport(
    items: { persona: Persona; reaction: Reaction }[],
    discussion?: DiscussionMessage[],
    forTestId = testId,
  ) {
    setReportLoading(true);
    setError(null);
    try {
      const data = await post<{ report: Report }>("/api/report", { material, items, discussion });
      setReport(data.report);
      setReportIncludesDiscussion(!!discussion?.length);
      if (forTestId) void save((s) => s.saveReport(forTestId, data.report, !!discussion?.length));
    } catch (e) {
      setError(errMsg(e));
    } finally {
      setReportLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {header ?? (
        <header className="mb-10 print:mb-4">
          <h1 className="text-3xl font-bold tracking-tight">Generalprøven</h1>
          <p className="mt-1 text-stone-600 print:hidden">
            Syntetiske fokusgrupper: test dit marketingmateriale på skeptiske AI-personas, før det møder rigtige kunder.
          </p>
        </header>
      )}

      {saveError && (
        <div className="mb-6 flex items-start justify-between gap-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 print:hidden">
          <span>{saveError}</span>
          <button className="text-amber-700 hover:underline" onClick={() => setSaveError(null)}>Luk</button>
        </div>
      )}

      {demo && (
        <div className="mb-6 rounded-lg border border-sky-300 bg-sky-50 px-4 py-3 text-sm text-sky-900">
          <strong>Demo-tilstand:</strong> der er ingen API-nøgle, så personas, reaktioner og rapport er faste
          eksempeldata – ikke AI-genereret. Tilføj <code>ANTHROPIC_API_KEY</code> i <code>.env.local</code> for rigtige svar.
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800 print:hidden">
          {error}
        </div>
      )}

      {/* Trin 1 */}
      <section className="mb-12 print:hidden">
        <StepTitle n={1} title="Beskriv målgruppen" />
        <div className="card space-y-4">
          <label className="block">
            <span className="text-sm font-medium">Målgruppe</span>
            <textarea
              className="input mt-1"
              rows={2}
              placeholder="Fx: IT-chefer i danske kommuner"
              value={audience}
              onChange={(e) => setAudience(e.target.value)}
            />
          </label>
          <label className="block">
            <span className="text-sm font-medium">Kontekst <span className="font-normal text-stone-500">(valgfri)</span></span>
            <textarea
              className="input mt-1"
              rows={3}
              placeholder="Branche, pris, konkurrenter, hvad du sælger…"
              value={context}
              onChange={(e) => setContext(e.target.value)}
            />
          </label>
          <button className="btn-primary" disabled={!audience.trim() || generating} onClick={generate}>
            {generating ? "Genererer 8 personas…" : personas.length ? "Generér nye personas" : "Generér 8 personas"}
          </button>
        </div>
      </section>

      {/* Trin 2 */}
      {personas.length > 0 && (
        <section className="mb-12 print:hidden">
          <StepTitle n={2} title="Mød fokusgruppen" />
          <div className="mb-4 flex flex-wrap items-center gap-3 text-sm">
            <span>{personas.length} personas · {skeptics} skeptiske (7+) · {hostile ? "1+ afvisende" : "ingen afvisende"}</span>
            {(skeptics < 3 || !hostile) && (
              <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-900">
                Gruppen er for venlig – kravet er mindst 3 skeptiske og én afvisende.
              </span>
            )}
          </div>
          {warning && <p className="mb-4 text-sm text-amber-800">{warning}</p>}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {personas.map((p) => (
              <PersonaCard
                key={p.id}
                persona={p}
                busy={busyIds.has(p.id)}
                onChange={(np) => {
                  setPersonas((prev) => prev.map((x) => (x.id === p.id ? np : x)));
                  void save((s) => s.updatePersona(np));
                }}
                onDelete={() => {
                  setPersonas((prev) => prev.filter((x) => x.id !== p.id));
                  void save((s) => s.deletePersona(p.id));
                }}
                onRegenerate={() => regenerate(p)}
              />
            ))}
          </div>
        </section>
      )}

      {/* Trin 3 */}
      {personas.length > 0 && (
        <section className="mb-12 print:hidden">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <StepTitle n={3} title={mode === "ab" ? "Indsæt to versioner" : "Indsæt materiale"} />
            <div className="mb-4 inline-flex rounded-lg bg-stone-200 p-1 text-sm">
              {(["single", "ab"] as const).map((m) => (
                <button
                  key={m}
                  disabled={testing || reportLoading || abBusy}
                  className={`rounded-md px-3 py-1 ${mode === m ? "bg-white font-medium shadow-sm" : "text-stone-600"}`}
                  onClick={() => setMode(m)}
                >
                  {m === "single" ? "Én version" : "A/B-test"}
                </button>
              ))}
            </div>
          </div>
          {/* Kept mounted (just hidden) so switching modes doesn't throw away an A/B run */}
          <div className={mode === "ab" ? "" : "hidden"}>
            <ABTest
              personas={personas}
              initial={initial?.abTest ?? undefined}
              disabled={busyIds.size > 0}
              save={save}
              store={store}
              onBusyChange={setAbBusy}
              onError={setError}
            />
          </div>
          {mode === "single" && (
          <div className="card space-y-4">
            <MaterialInput
              material={material}
              source={source}
              onChange={(text, src) => {
                setMaterial(text);
                setSource(src);
              }}
            />
            <div className="flex items-center justify-between">
              <span className="text-xs text-stone-500">
                {source.type === "video" ? "" : `${material.length.toLocaleString("da-DK")} tegn`}
              </span>
              <button
                className="btn-primary"
                disabled={!materialReady(material, source) || testing || reportLoading || busyIds.size > 0}
                onClick={runTest}
              >
                {testing ? "Personaerne læser…" : "Kør fokusgruppe"}
              </button>
            </div>
          </div>
          )}
        </section>
      )}

      {/* Trin 4 */}
      {mode === "single" && Object.keys(reactions).length > 0 && (
        <section className="mb-12 print:hidden">
          <StepTitle n={4} title="Individuelle reaktioner" />
          <div className="grid gap-4 md:grid-cols-2">
            {personas.map((p) => {
              const r = reactions[p.id];
              if (!r) return null;
              return (
                <div key={p.id} className="card">
                  <div className="mb-3 flex items-center gap-3">
                    <Avatar name={p.navn} size="sm" />
                    <div className="flex-1">
                      <div className="font-semibold">{p.navn}</div>
                      <div className="text-xs text-stone-500">{p.jobtitel}</div>
                    </div>
                    <SkepsisBadge score={p.skepsis_score} hostile={p.er_afvisende} />
                  </div>
                  {r.status === "loading" && <div className="h-24 animate-pulse rounded bg-stone-100" />}
                  {r.status === "error" && <p className="text-sm text-red-700">{r.error}</p>}
                  {r.status === "done" && <ReactionBody r={r.reaction} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* Trin 5 */}
      {mode === "single" && !testing && doneReactions.length > 1 && (
        <section className="mb-12 print:hidden">
          <StepTitle n={5} title="Diskussionsrum" />
          <DiscussionRoom
            key={testRun}
            personas={doneReactions.map((x) => x.persona)}
            reactions={Object.fromEntries(doneReactions.map((x) => [x.persona.id, x.reaction]))}
            material={material}
            disabled={reportLoading}
            initialMessages={testRun === 0 ? test?.discussion : undefined}
            onStart={() => {
              if (testId) void save((s) => s.clearDiscussion(testId));
            }}
            onMessage={(m) => {
              if (testId) void save((s) => s.saveDiscussionMessage(testId, m));
            }}
            onFinished={setDiscussion}
          />
          {discussion.length > 0 && !reportIncludesDiscussion && (
            <div className="mt-3 flex items-center justify-between rounded-lg bg-stone-100 px-4 py-3 text-sm">
              <span>Rapporten bygger kun på de individuelle reaktioner.</span>
              <button
                className="btn-primary"
                disabled={reportLoading}
                onClick={() => generateReport(doneReactions, discussion)}
              >
                Opdatér rapport med diskussionen
              </button>
            </div>
          )}
        </section>
      )}

      {/* Trin 6 */}
      {mode === "single" && (reportLoading || report) && (
        <section className="mb-12">
          <div className="flex items-center justify-between">
            <StepTitle n={6} title="Rapport" />
            {report && (
              <button className="btn-ghost print:hidden" onClick={() => window.print()}>
                Eksportér som PDF
              </button>
            )}
          </div>
          {report && (
            <p className="mb-3 text-sm text-stone-500">
              Baseret på {reportIncludesDiscussion ? "individuelle reaktioner og diskussionen" : "individuelle reaktioner"}.
            </p>
          )}
          {reportLoading && <div className="card h-40 animate-pulse text-stone-500">Analyserer reaktionerne…</div>}
          {report && (
            <ReportView report={report} avgBuy={avgBuy} video={videoStats(doneReactions.map((x) => x.reaction))} />
          )}
        </section>
      )}
    </main>
  );
}

function ReactionBody({ r }: { r: Reaction }) {
  const tone = r.koebsvilje >= 7 ? "bg-emerald-600" : r.koebsvilje >= 4 ? "bg-amber-500" : "bg-red-600";
  return (
    <div className="space-y-2 text-sm">
      <p className="text-base italic">“{r.citat}”</p>
      <div><span className="label">Førstehåndsindtryk</span><p>{r.foerstehaandsindtryk}</p></div>
      <div><span className="label">Hvad jeg forstod</span><p>{r.hvad_jeg_forstod}</p></div>
      <div><span className="label">Største indvending</span><p>{r.stoerste_indvending}</p></div>
      {r.video && <VideoAnswers v={r.video} />}
      <div>
        <span className="label">Ville klikke/købe</span>
        <div className="mt-1 flex items-center gap-2">
          <div className="h-2 flex-1 rounded bg-stone-100">
            <div className={`h-2 rounded ${tone}`} style={{ width: `${r.koebsvilje * 10}%` }} />
          </div>
          <span className="font-semibold">{r.koebsvilje}/10</span>
        </div>
        <p className="mt-1 text-stone-600">{r.koebsvilje_begrundelse}</p>
      </div>
    </div>
  );
}
