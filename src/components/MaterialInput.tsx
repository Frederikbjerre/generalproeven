"use client";

import { useState } from "react";

export type MaterialSource = { type: "text" | "url"; url: string | null };

type Props = {
  material: string;
  source: MaterialSource;
  onChange: (material: string, source: MaterialSource) => void;
};

export function MaterialInput({ material, source, onChange }: Props) {
  const [tab, setTab] = useState<"text" | "url">(source.type);
  const [url, setUrl] = useState(source.url ?? "");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function fetchUrl() {
    setFetching(true);
    setError(null);
    try {
      const res = await fetch("/api/scrape", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Kunne ikke hente siden.");
      setUrl(data.url);
      onChange(data.text, { type: "url", url: data.url });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke hente siden.");
    } finally {
      setFetching(false);
    }
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg bg-stone-100 p-1 text-sm">
        {(["text", "url"] as const).map((t) => (
          <button
            key={t}
            className={`rounded-md px-3 py-1 ${tab === t ? "bg-white font-medium shadow-sm" : "text-stone-600"}`}
            onClick={() => setTab(t)}
          >
            {t === "text" ? "Tekst" : "Hent fra URL"}
          </button>
        ))}
      </div>

      {tab === "url" && (
        <div className="space-y-1">
          <div className="flex gap-2">
            <input
              className="input"
              type="url"
              placeholder="https://eksempel.dk/landingsside"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && url.trim() && !fetching && fetchUrl()}
            />
            <button className="btn-primary shrink-0" disabled={!url.trim() || fetching} onClick={fetchUrl}>
              {fetching ? "Henter…" : "Hent tekst"}
            </button>
          </div>
          {error && <p className="text-sm text-red-700">{error}</p>}
          {source.type === "url" && source.url && !error && (
            <p className="text-xs text-stone-500">
              Brødtekst hentet fra {source.url}. Du kan rette teksten herunder, før du kører testen.
            </p>
          )}
        </div>
      )}

      <textarea
        className="input font-mono text-sm"
        rows={10}
        placeholder={
          tab === "url" ? "Den hentede tekst vises her…" : "Indsæt annoncetekst, salgsmail, pristekst eller landingsside-tekst…"
        }
        value={material}
        // Hand edits keep the URL as source; the text is what gets tested either way.
        onChange={(e) => onChange(e.target.value, tab === "text" ? { type: "text", url: null } : source)}
      />
    </div>
  );
}
