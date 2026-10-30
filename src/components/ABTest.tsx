"use client";

import { useState } from "react";
import { errMsg, post } from "@/lib/http";
import { abStats, type ABReaction, type ABReport, type Persona, type Reaction } from "@/lib/schemas";
import type { Store } from "@/lib/store";
import { ABReportView } from "./ABReportView";
import { Avatar } from "./Avatar";
import { MaterialInput, type MaterialSource } from "./MaterialInput";
import { SkepsisBadge } from "./PersonaCard";
import { StepTitle } from "./StepTitle";

export type ABTestData = {
  id: string;
  a: { material: string; source: MaterialSource };
  b: { material: string; source: MaterialSource };
  reactions: Record<string, ABReaction>;
  report: ABReport | null;
};

type ReactionState =
  | { status: "loading" }
  | { status: "done"; reaction: ABReaction }
  | { status: "error"; error: string };

type Props = {
  personas: Persona[];
  initial?: ABTestData;
  disabled: boolean;
  /** Runs a background save; no-op in local mode. */
  save: (fn: (s: Store) => Promise<unknown>) => Promise<unknown>;
  store: Store | null;
  onBusyChange: (busy: boolean) => void;
  onError: (message: string | null) => void;
};

const EMPTY: MaterialSource = { type: "text", url: null };

export function ABTest({ personas, initial, disabled, save, store, onBusyChange, onError }: Props) {
  const [a, setA] = useState(initial?.a ?? { material: "", source: EMPTY });
  const [b, setB] = useState(initial?.b ?? { material: "", source: EMPTY });
  const [reactions, setReactions] = useState<Record<string, ReactionState>>(() =>
    Object.fromEntries(Object.entries(initial?.reactions ?? {}).map(([id, reaction]) => [id, { status: "done", reaction }])),
  );
  const [testing, setTesting] = useState(false);
  const [report, setReport] = useState<ABReport | null>(initial?.report ?? null);
  const [reportLoading, setReportLoading] = useState(false);

  const done = personas.flatMap((p) => {
    const r = reactions[p.id];
    return r?.status === "done" ? [{ persona: p, reaction: r.reaction }] : [];
  });
  const stats = abStats(done.map((x) => x.reaction));

  async function run() {
    setTesting(true);
    onBusyChange(true);
    onError(null);
    setReport(null);
    setReactions(Object.fromEntries(personas.map((p) => [p.id, { status: "loading" } as ReactionState])));

    let newTestId: string | null = null;
    if (store) {
      try {
        newTestId = await store.createTest({
          mode: "ab",
          input_type: a.source.type,
          input_text: a.material,
          source_url: a.source.url,
          variant_b_input_type: b.source.type,
          variant_b_text: b.material,
          variant_b_source_url: b.source.url,
        });
      } catch (e) {
        onError(`Kunne ikke gemme testen: ${errMsg(e)}`);
      }
    }

    const results = await Promise.all(
      personas.map(async (persona) => {
        try {
          const { reaction } = await post<{ reaction: ABReaction }>("/api/ab/react", {
            persona,
            materialA: a.material,
            materialB: b.material,
          });
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

    const items = results.filter((x): x is { persona: Persona; reaction: ABReaction } => x !== null);
    if (!items.length) {
      onError("Ingen af personaerne kunne svare. Prøv igen.");
      onBusyChange(false);
      return;
    }
    setReportLoading(true);
    try {
      const data = await post<{ report: ABReport }>("/api/ab/report", {
        materialA: a.material,
        materialB: b.material,
        items,
      });
      setReport(data.report);
      if (newTestId) void save((s) => s.saveReport(newTestId, data.report, false));
    } catch (e) {
      onError(errMsg(e));
    } finally {
      setReportLoading(false);
      onBusyChange(false);
    }
  }

  const busy = testing || reportLoading;
  const canRun = a.material.trim() && b.material.trim() && !busy && !disabled;

  return (
    <>
      <div className="card space-y-4">
        <div className="grid gap-6 lg:grid-cols-2">
          {([["A", a, setA], ["B", b, setB]] as const).map(([label, v, set]) => (
            <div key={label}>
              <div className={`mb-2 text-sm font-semibold ${label === "A" ? "text-sky-700" : "text-violet-700"}`}>
                Version {label}
              </div>
              <MaterialInput
                material={v.material}
                source={v.source}
                onChange={(material, source) => set({ material, source })}
              />
            </div>
          ))}
        </div>
        <div className="flex items-center justify-between">
          <span className="text-xs text-stone-500">
            Hver persona læser begge versioner i tilfældig rækkefølge og vælger en favorit – eller ingen.
          </span>
          <button className="btn-primary" disabled={!canRun} onClick={run}>
            {testing ? "Personaerne sammenligner…" : "Kør A/B-test"}
          </button>
        </div>
      </div>

      {Object.keys(reactions).length > 0 && (
        <section className="mt-12 print:hidden">
          <StepTitle n={4} title="Reaktioner på A og B" />
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
                  {r.status === "done" && <ABReactionBody r={r.reaction} />}
                </div>
              );
            })}
          </div>
        </section>
      )}

      {(reportLoading || report) && (
        <section className="mt-12">
          <div className="flex items-center justify-between">
            <StepTitle n={5} title="Rapport: A mod B" />
            {report && (
              <button className="btn-ghost print:hidden" onClick={() => window.print()}>
                Eksportér som PDF
              </button>
            )}
          </div>
          {reportLoading && <div className="card h-40 animate-pulse text-stone-500">Afgør testen…</div>}
          {report && <ABReportView report={report} stats={stats} />}
        </section>
      )}
    </>
  );
}

const PREFERENCE = {
  A: { label: "Foretrækker A", cls: "bg-sky-100 text-sky-800" },
  B: { label: "Foretrækker B", cls: "bg-violet-100 text-violet-800" },
  ingen: { label: "Ingen af dem", cls: "bg-stone-200 text-stone-700" },
};

function ABReactionBody({ r }: { r: ABReaction }) {
  const pref = PREFERENCE[r.foretrukket];
  return (
    <div className="space-y-3 text-sm">
      <div className="flex items-start gap-2">
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${pref.cls}`}>{pref.label}</span>
        <p className="italic">{r.begrundelse}</p>
      </div>
      <div className="grid grid-cols-2 gap-3">
        {(["A", "B"] as const).map((v) => (
          <VersionColumn key={v} label={v} r={v === "A" ? r.a : r.b} preferred={r.foretrukket === v} />
        ))}
      </div>
    </div>
  );
}

function VersionColumn({ label, r, preferred }: { label: "A" | "B"; r: Reaction; preferred: boolean }) {
  const tone = r.koebsvilje >= 7 ? "bg-emerald-600" : r.koebsvilje >= 4 ? "bg-amber-500" : "bg-red-600";
  return (
    <div className={`rounded-lg p-3 ${preferred ? "bg-stone-100 ring-1 ring-stone-300" : "bg-stone-50"}`}>
      <div className={`text-xs font-semibold ${label === "A" ? "text-sky-700" : "text-violet-700"}`}>Version {label}</div>
      <p className="mt-1 italic">“{r.citat}”</p>
      <div className="mt-2 flex items-center gap-2">
        <div className="h-1.5 flex-1 rounded bg-stone-200">
          <div className={`h-1.5 rounded ${tone}`} style={{ width: `${r.koebsvilje * 10}%` }} />
        </div>
        <span className="text-xs font-semibold">{r.koebsvilje}/10</span>
      </div>
      <div className="mt-2">
        <span className="label">Største indvending</span>
        <p>{r.stoerste_indvending}</p>
      </div>
      <details className="mt-2 text-stone-600">
        <summary className="cursor-pointer text-xs text-stone-500">Mere</summary>
        <p className="mt-1"><span className="label">Indtryk</span> {r.foerstehaandsindtryk}</p>
        <p className="mt-1"><span className="label">Forstod</span> {r.hvad_jeg_forstod}</p>
      </details>
    </div>
  );
}
