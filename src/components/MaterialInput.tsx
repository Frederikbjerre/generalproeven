"use client";

import { useRef, useState } from "react";
import { extractFrames } from "@/lib/frames";
import { formatTime, videoAsText, type VideoMaterial } from "@/lib/schemas";

export type MaterialSource = {
  type: "text" | "url" | "video";
  url: string | null;
  /** Only in memory: frames are never stored, so a saved video test must be re-uploaded to run again. */
  video?: VideoMaterial;
};

type Tab = MaterialSource["type"];

type Props = {
  material: string;
  source: MaterialSource;
  onChange: (material: string, source: MaterialSource) => void;
};

const TABS: { id: Tab; label: string }[] = [
  { id: "text", label: "Tekst" },
  { id: "url", label: "Hent fra URL" },
  { id: "video", label: "Video" },
];

export function MaterialInput({ material, source, onChange }: Props) {
  const [tab, setTab] = useState<Tab>(source.type);
  const [url, setUrl] = useState(source.url ?? "");
  const [fetching, setFetching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState<string | null>(null);
  // Text typed before switching to the video tab, restored when switching back
  const textBackup = useRef(source.type === "video" ? "" : material);

  function switchTab(next: Tab) {
    setError(null);
    setTab(next);
    if (next === "video" && source.type !== "video") {
      textBackup.current = material;
      onChange("", { type: "video", url: null });
    } else if (next !== "video" && source.type === "video") {
      onChange(textBackup.current, { type: next, url: null });
    }
  }

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

  async function loadVideo(file: File) {
    setError(null);
    setProgress("Læser video…");
    try {
      const v = await extractFrames(file, (done, total) => setProgress(`Udtrækker stillbilleder ${done}/${total}…`));
      const video: VideoMaterial = { ...v, script: source.video?.script ?? "" };
      onChange(videoAsText(video), { type: "video", url: null, video });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Kunne ikke læse videoen.");
    } finally {
      setProgress(null);
    }
  }

  function setScript(script: string) {
    if (!source.video) return;
    const video = { ...source.video, script };
    onChange(videoAsText(video), { ...source, video });
  }

  return (
    <div className="space-y-3">
      <div className="inline-flex rounded-lg bg-stone-100 p-1 text-sm">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`rounded-md px-3 py-1 ${tab === t.id ? "bg-white font-medium shadow-sm" : "text-stone-600"}`}
            onClick={() => switchTab(t.id)}
          >
            {t.label}
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
          {source.type === "url" && source.url && !error && (
            <p className="text-xs text-stone-500">
              Brødtekst hentet fra {source.url}. Du kan rette teksten herunder, før du kører testen.
            </p>
          )}
        </div>
      )}

      {tab === "video" ? (
        <div className="space-y-3">
          <label className="flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border-2 border-dashed border-stone-300 px-4 py-6 text-center text-sm hover:border-stone-500">
            <span className="font-medium">
              {progress ?? (source.video ? `Skift video (${source.video.fileName})` : "Vælg kampagnevideo (mp4, mov, webm)")}
            </span>
            <span className="text-xs text-stone-500">
              Videoen bliver på din computer. Kun stillbilleder sendes til personaerne – flest fra de første sekunder.
            </span>
            <input
              type="file"
              accept="video/*"
              className="sr-only"
              disabled={!!progress}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void loadVideo(file);
                e.target.value = "";
              }}
            />
          </label>

          {source.type === "video" && !source.video && material && (
            <p className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              Videoen fra den gemte test er ikke gemt. Vælg den igen for at køre en ny test.
            </p>
          )}

          {source.video && (
            <>
              <div className="flex gap-2 overflow-x-auto pb-1">
                {source.video.frames.map((f) => (
                  <figure key={f.t} className="shrink-0">
                    {/* eslint-disable-next-line @next/next/no-img-element -- local data URL, nothing to optimize */}
                    <img
                      src={`data:image/jpeg;base64,${f.data}`}
                      alt={`Stillbillede ved ${formatTime(f.t)}`}
                      className="h-20 rounded border border-stone-200"
                    />
                    <figcaption className="text-center text-[10px] text-stone-500">{formatTime(f.t)}</figcaption>
                  </figure>
                ))}
              </div>
              <p className="text-xs text-stone-500">
                {source.video.fileName} · {formatTime(source.video.duration)} · {source.video.frames.length} stillbilleder
              </p>
              <label className="block">
                <span className="text-sm font-medium">
                  Manuskript / speak <span className="font-normal text-stone-500">(valgfrit, men anbefalet)</span>
                </span>
                <textarea
                  className="input mt-1 text-sm"
                  rows={5}
                  placeholder="Indsæt speak, dialog og tekst der kun høres. Personaerne kan ikke høre lyden."
                  value={source.video.script}
                  onChange={(e) => setScript(e.target.value)}
                />
              </label>
            </>
          )}
        </div>
      ) : (
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
      )}

      {error && <p className="text-sm text-red-700">{error}</p>}
    </div>
  );
}

/** True when the material can be tested (a video test needs its frames in memory). */
export function materialReady(material: string, source: MaterialSource) {
  return source.type === "video" ? Boolean(source.video?.frames.length) : Boolean(material.trim());
}
