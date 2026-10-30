"use client";

import { useState } from "react";
import type { Persona } from "@/lib/schemas";
import { Avatar } from "./Avatar";

type Props = {
  persona: Persona;
  busy: boolean;
  onChange: (p: Persona) => void;
  onDelete: () => void;
  onRegenerate: () => void;
};

export function SkepsisBadge({ score, hostile }: { score: number; hostile?: boolean }) {
  const tone = hostile
    ? "bg-red-600 text-white"
    : score >= 7
      ? "bg-orange-100 text-orange-800"
      : score >= 4
        ? "bg-stone-100 text-stone-700"
        : "bg-emerald-100 text-emerald-800";
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${tone}`}>
      {hostile ? "Afvisende · " : ""}Skepsis {score}/10
    </span>
  );
}

export function PersonaCard({ persona: p, busy, onChange, onDelete, onRegenerate }: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(p);

  if (editing) {
    const field = (key: keyof Persona, label: string, multiline = false) => {
      const value = Array.isArray(draft[key]) ? (draft[key] as string[]).join("\n") : String(draft[key]);
      const set = (v: string) =>
        setDraft({
          ...draft,
          [key]: Array.isArray(draft[key])
            ? v.split("\n").map((s) => s.trim()).filter(Boolean)
            : typeof draft[key] === "number"
              ? Number(v)
              : v,
        });
      return (
        <label className="block text-xs text-stone-500">
          {label}
          {multiline ? (
            <textarea className="input mt-1" rows={3} value={value} onChange={(e) => set(e.target.value)} />
          ) : (
            <input className="input mt-1" value={value} onChange={(e) => set(e.target.value)} />
          )}
        </label>
      );
    };
    return (
      <div className="card space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {field("navn", "Navn")}
          {field("alder", "Alder")}
          {field("by", "By")}
          {field("jobtitel", "Jobtitel")}
        </div>
        {field("virksomhedstype", "Virksomhedstype")}
        {field("segment", "Segment")}
        {field("budget_mandat", "Budget/mandat", true)}
        {field("holdninger", "Holdninger", true)}
        {field("kaepheste", "Kæpheste (én pr. linje)", true)}
        {field("mediebrug", "Mediebrug (én pr. linje)", true)}
        {field("grund_til_interesse", "Grund til interesse", true)}
        <div className="flex items-center gap-4">
          <label className="text-xs text-stone-500">
            Skepsis (1-10)
            <input
              type="number"
              min={1}
              max={10}
              className="input mt-1 w-20"
              value={draft.skepsis_score}
              onChange={(e) => setDraft({ ...draft, skepsis_score: Number(e.target.value) })}
            />
          </label>
          <label className="mt-4 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={draft.er_afvisende}
              onChange={(e) => setDraft({ ...draft, er_afvisende: e.target.checked })}
            />
            Afvisende
          </label>
        </div>
        <div className="flex gap-2 pt-2">
          <button
            className="btn-primary"
            onClick={() => {
              onChange({ ...draft, skepsis_score: Math.min(10, Math.max(1, draft.skepsis_score || 1)) });
              setEditing(false);
            }}
          >
            Gem
          </button>
          <button className="btn-ghost" onClick={() => { setDraft(p); setEditing(false); }}>
            Annullér
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={`card flex flex-col ${busy ? "animate-pulse opacity-60" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar name={p.navn} />
        <div className="min-w-0 flex-1">
          <div className="font-semibold">{p.navn}, {p.alder}</div>
          <div className="text-sm text-stone-600">{p.jobtitel}</div>
          <div className="text-xs text-stone-500">{p.virksomhedstype} · {p.by}</div>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <SkepsisBadge score={p.skepsis_score} hostile={p.er_afvisende} />
        <span className="rounded-full bg-stone-100 px-2 py-0.5 text-xs text-stone-600">{p.segment}</span>
      </div>
      <dl className="mt-3 space-y-2 text-sm">
        <div><dt className="label">Budget/mandat</dt><dd>{p.budget_mandat}</dd></div>
        <div><dt className="label">Holdninger</dt><dd>{p.holdninger}</dd></div>
        <div>
          <dt className="label">Kæpheste</dt>
          <dd><ul className="list-disc pl-4">{p.kaepheste.map((k) => <li key={k}>{k}</li>)}</ul></dd>
        </div>
        <div><dt className="label">Mediebrug</dt><dd>{p.mediebrug.join(" · ")}</dd></div>
        {p.grund_til_interesse && (
          <div><dt className="label">Kunne blive interesseret hvis</dt><dd>{p.grund_til_interesse}</dd></div>
        )}
      </dl>
      <div className="mt-auto flex gap-1 pt-4 text-sm print:hidden">
        <button className="btn-ghost" disabled={busy} onClick={() => { setDraft(p); setEditing(true); }}>Redigér</button>
        <button className="btn-ghost" disabled={busy} onClick={onRegenerate}>Regenerér</button>
        <button className="btn-ghost text-red-700" disabled={busy} onClick={onDelete}>Slet</button>
      </div>
    </div>
  );
}
