import type { Report } from "@/lib/schemas";

function scoreTone(score: number) {
  if (score >= 70) return "text-emerald-700";
  if (score >= 40) return "text-amber-700";
  return "text-red-700";
}

type Props = {
  report: Report;
  avgBuy: number;
  /** Feed metrics when the material was a video */
  video?: { stopShare: number; avgWatch: number } | null;
};

export function ReportView({ report, avgBuy, video }: Props) {
  return (
    <div className="space-y-6">
      <div className="rounded-lg border-2 border-amber-400 bg-amber-50 px-4 py-3 text-sm font-medium text-amber-900">
        Simulation – ikke en erstatning for rigtige kunder. Resultaterne er genereret af AI-personas og bør
        bruges til at skærpe hypoteser, ikke til at træffe endelige beslutninger.
      </div>

      <div className="card flex flex-col gap-6 sm:flex-row sm:items-center">
        <div className="text-center sm:w-40">
          <div className={`text-6xl font-bold ${scoreTone(report.samlet_score)}`}>{report.samlet_score}</div>
          <div className="text-sm text-stone-500">Samlet score / 100</div>
          <div className="mt-1 text-xs text-stone-500">Gns. købsvilje {avgBuy.toFixed(1)}/10</div>
          {video && (
            <div className="mt-1 text-xs text-stone-500">
              {Math.round(video.stopShare * 100)}% stopper op · ser til ende {video.avgWatch.toFixed(1)}/10
            </div>
          )}
        </div>
        <p className="flex-1 text-stone-700">{report.samlet_vurdering}</p>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Top 3 indvendinger" tone="red">
          {report.top_indvendinger.map((x, i) => (
            <Item key={i} n={i + 1} title={x.titel} body={x.forklaring} />
          ))}
        </Section>
        <Section title="Top 3 styrker" tone="emerald">
          {report.top_styrker.map((x, i) => (
            <Item key={i} n={i + 1} title={x.titel} body={x.forklaring} />
          ))}
        </Section>
      </div>

      <Section title="5 bedste citater">
        <div className="space-y-3">
          {report.bedste_citater.map((c, i) => (
            <blockquote key={i} className="border-l-4 border-stone-300 pl-3">
              <p className="italic">“{c.citat}”</p>
              <footer className="text-sm text-stone-500">– {c.persona_navn}</footer>
            </blockquote>
          ))}
        </div>
      </Section>

      <div className="grid gap-4 md:grid-cols-2">
        <Section title="Mest positive segmenter" tone="emerald">
          {report.mest_positive_segmenter.map((s, i) => <Item key={i} title={s.segment} body={s.begrundelse} />)}
        </Section>
        <Section title="Mindst positive segmenter" tone="red">
          {report.mindst_positive_segmenter.map((s, i) => <Item key={i} title={s.segment} body={s.begrundelse} />)}
        </Section>
      </div>

      <Section title="3 konkrete forbedringsforslag" tone="sky">
        {report.forbedringsforslag.map((f, i) => (
          <Item key={i} n={i + 1} title={f.forslag} body={f.begrundelse} />
        ))}
      </Section>
    </div>
  );
}

function Section({ title, tone = "stone", children }: { title: string; tone?: string; children: React.ReactNode }) {
  const bar = { red: "border-red-500", emerald: "border-emerald-500", sky: "border-sky-500", stone: "border-stone-400" }[tone];
  return (
    <section className={`card break-inside-avoid border-t-4 ${bar}`}>
      <h3 className="mb-3 font-semibold">{title}</h3>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function Item({ n, title, body }: { n?: number; title: string; body: string }) {
  return (
    <div>
      <div className="font-medium">{n ? `${n}. ` : ""}{title}</div>
      <div className="text-sm text-stone-600">{body}</div>
    </div>
  );
}
