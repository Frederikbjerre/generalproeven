import type { ABReport } from "@/lib/schemas";

type Stats = { votes: { A: number; B: number; ingen: number }; avgA: number; avgB: number };

const CONFIDENCE = { lav: "Lav sikkerhed", middel: "Middel sikkerhed", høj: "Høj sikkerhed" };

export function ABReportView({ report, stats }: { report: ABReport; stats: Stats }) {
  const total = stats.votes.A + stats.votes.B + stats.votes.ingen || 1;
  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        Simulation – ikke en erstatning for rigtige kunder. En A/B-vinder blandt 8 AI-personas er en hypotese, der bør
        afprøves på rigtige kunder.
      </div>

      <div className="card">
        <div className="flex flex-wrap items-center gap-3">
          <h3 className="text-2xl font-bold">
            {report.vinder === "uafgjort" ? "Uafgjort" : `Vinder: Version ${report.vinder}`}
          </h3>
          <span className="rounded-full bg-stone-100 px-2.5 py-0.5 text-xs font-medium text-stone-700">
            {CONFIDENCE[report.sikkerhed]}
          </span>
        </div>
        <p className="mt-2 text-stone-700">{report.begrundelse}</p>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {(["A", "B"] as const).map((v) => {
            const score = v === "A" ? report.score_a : report.score_b;
            const avg = v === "A" ? stats.avgA : stats.avgB;
            const won = report.vinder === v;
            return (
              <div key={v} className={`rounded-lg border p-4 ${won ? "border-emerald-500 bg-emerald-50" : "border-stone-200"}`}>
                <div className="text-sm font-medium text-stone-500">Version {v}</div>
                <div className="text-4xl font-bold">{score}<span className="text-base font-normal text-stone-500"> / 100</span></div>
                <div className="mt-1 text-sm text-stone-600">
                  {stats.votes[v]} af {total} foretrækker den · gns. købsvilje {avg.toFixed(1)}/10
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4">
          <div className="flex h-3 overflow-hidden rounded-full bg-stone-100">
            <div className="bg-sky-600" style={{ width: `${(stats.votes.A / total) * 100}%` }} />
            <div className="bg-stone-300" style={{ width: `${(stats.votes.ingen / total) * 100}%` }} />
            <div className="bg-violet-600" style={{ width: `${(stats.votes.B / total) * 100}%` }} />
          </div>
          <div className="mt-1 flex justify-between text-xs text-stone-500">
            <span>A: {stats.votes.A}</span>
            <span>Ingen: {stats.votes.ingen}</span>
            <span>B: {stats.votes.B}</span>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {(["A", "B"] as const).map((v) => (
          <section key={v} className="card break-inside-avoid">
            <h3 className="mb-3 font-semibold">Version {v}</h3>
            <List title="Styrker" items={v === "A" ? report.styrker_a : report.styrker_b} tone="text-emerald-700" />
            <List title="Svagheder" items={v === "A" ? report.svagheder_a : report.svagheder_b} tone="text-red-700" />
          </section>
        ))}
      </div>

      {report.segment_forskelle.length > 0 && (
        <section className="card break-inside-avoid">
          <h3 className="mb-3 font-semibold">Forskelle mellem segmenter</h3>
          <div className="space-y-2">
            {report.segment_forskelle.map((s, i) => (
              <div key={i} className="text-sm">
                <span className="font-medium">{s.segment}</span>{" "}
                <span className="text-stone-500">– foretrækker {s.foretrukket === "ingen" ? "ingen" : s.foretrukket}:</span>{" "}
                {s.begrundelse}
              </div>
            ))}
          </div>
        </section>
      )}

      <section className="card break-inside-avoid">
        <h3 className="mb-3 font-semibold">Citater</h3>
        <div className="space-y-3">
          {report.bedste_citater.map((c, i) => (
            <blockquote key={i} className={`border-l-4 pl-3 ${c.version === "A" ? "border-sky-600" : "border-violet-600"}`}>
              <p className="italic">“{c.citat}”</p>
              <footer className="text-sm text-stone-500">– {c.persona_navn} om version {c.version}</footer>
            </blockquote>
          ))}
        </div>
      </section>

      <section className="card break-inside-avoid border-t-4 border-sky-500">
        <h3 className="mb-3 font-semibold">
          Forbedringsforslag {report.vinder === "uafgjort" ? "" : `til version ${report.vinder}`}
        </h3>
        <div className="space-y-3">
          {report.forbedringsforslag.map((f, i) => (
            <div key={i}>
              <div className="font-medium">{i + 1}. {f.forslag}</div>
              <div className="text-sm text-stone-600">{f.begrundelse}</div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function List({ title, items, tone }: { title: string; items: string[]; tone: string }) {
  return (
    <div className="mb-3">
      <div className={`label ${tone}`}>{title}</div>
      <ul className="mt-1 list-disc space-y-1 pl-4 text-sm">
        {items.map((x, i) => <li key={i}>{x}</li>)}
      </ul>
    </div>
  );
}
