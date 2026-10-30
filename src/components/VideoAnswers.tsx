import type { Reaction } from "@/lib/schemas";

export function VideoAnswers({ v, compact }: { v: NonNullable<Reaction["video"]>; compact?: boolean }) {
  return (
    <div className="space-y-1.5 rounded-lg bg-stone-50 p-2.5">
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span
          className={`rounded-full px-2 py-0.5 font-medium ${v.stopper_op ? "bg-emerald-100 text-emerald-800" : "bg-red-100 text-red-800"}`}
        >
          {v.stopper_op ? "Stopper op" : "Scroller forbi"}
        </span>
        <span className="text-stone-600">Ser til ende: <strong>{v.ville_se_til_ende}/10</strong></span>
      </div>
      {!compact && <p className="text-stone-600">{v.hook_vurdering}</p>}
      <p><span className="label">Husker</span> {v.hvad_jeg_husker}</p>
      <p><span className="label">Afsender</span> {v.hvem_er_afsenderen}</p>
    </div>
  );
}
