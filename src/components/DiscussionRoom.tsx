"use client";

import { useEffect, useRef, useState } from "react";
import { ROUNDS, type DiscussionMessage, type Persona, type Reaction } from "@/lib/schemas";
import { Avatar } from "./Avatar";

type Phase = "idle" | "running" | "moderator" | "done";

type Props = {
  personas: Persona[];
  reactions: Record<string, Reaction>;
  material: string;
  /** A saved discussion to show instead of starting fresh. */
  initialMessages?: DiscussionMessage[];
  /** Called when a new discussion starts (so saved messages can be cleared). */
  onStart?: () => void;
  /** Called for every finished message, including moderator questions. */
  onMessage?: (m: DiscussionMessage) => void;
  /** Called when all rounds are finished (or stopped) with the full transcript. */
  onFinished: (messages: DiscussionMessage[]) => void;
  disabled?: boolean;
};

/** Speaking order for a round: rotate so each round starts with someone new. */
function orderFor(personas: Persona[], round: number) {
  const shift = ((round - 1) * 3) % personas.length;
  return [...personas.slice(shift), ...personas.slice(0, shift)];
}

export function DiscussionRoom({
  personas,
  reactions,
  material,
  initialMessages,
  onStart,
  onMessage,
  onFinished,
  disabled,
}: Props) {
  const [messages, setMessages] = useState<DiscussionMessage[]>(initialMessages ?? []);
  const [live, setLive] = useState<{ persona: Persona; text: string } | null>(null);
  const [phase, setPhase] = useState<Phase>(initialMessages?.length ? "done" : "idle");
  const [round, setRound] = useState(() => Math.max(0, ...(initialMessages ?? []).map((m) => m.round)));
  const [question, setQuestion] = useState("");
  const [suggesting, setSuggesting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);
  const transcriptRef = useRef<DiscussionMessage[]>(initialMessages ?? []);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, live]);

  useEffect(() => () => abortRef.current?.abort(), []);

  function push(m: DiscussionMessage) {
    transcriptRef.current = [...transcriptRef.current, m];
    setMessages(transcriptRef.current);
    onMessage?.(m);
  }

  async function streamTurn(persona: Persona, r: number, moderatorQuestion: string | undefined, signal: AbortSignal) {
    const res = await fetch("/api/discussion/turn", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        persona,
        material,
        ownReaction: reactions[persona.id],
        transcript: transcriptRef.current,
        round: r,
        moderatorQuestion,
      }),
      signal,
    });
    if (!res.ok || !res.body) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error ?? "Kunne ikke hente næste replik.");
    }
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let text = "";
    setLive({ persona, text });
    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;
      text += decoder.decode(value, { stream: true });
      setLive({ persona, text });
    }
    setLive(null);
    const content = text.trim();
    if (content) {
      push({ id: crypto.randomUUID(), round: r, personaId: persona.id, navn: persona.navn, content });
    }
  }

  async function runRound(r: number, moderatorQuestion?: string) {
    const controller = new AbortController();
    abortRef.current = controller;
    setRound(r);
    setPhase("running");
    setError(null);
    try {
      for (const persona of orderFor(personas, r)) {
        if (controller.signal.aborted) return;
        await streamTurn(persona, r, moderatorQuestion, controller.signal);
      }
    } catch (e) {
      setLive(null);
      if (controller.signal.aborted) return;
      setError(e instanceof Error ? e.message : "Noget gik galt.");
      finish();
      return;
    }

    if (r >= ROUNDS) {
      finish();
      return;
    }
    setPhase("moderator");
    setQuestion("");
    setSuggesting(true);
    try {
      const res = await fetch("/api/discussion/moderator", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ material, transcript: transcriptRef.current, nextRound: r + 1 }),
        signal: controller.signal,
      });
      const data = await res.json();
      if (res.ok) setQuestion(data.spoergsmaal);
    } catch {
      // A missing suggestion is fine; the user can type or skip.
    } finally {
      setSuggesting(false);
    }
  }

  function finish() {
    setPhase("done");
    onFinished(transcriptRef.current);
  }

  function start() {
    onStart?.();
    transcriptRef.current = [];
    setMessages([]);
    void runRound(1);
  }

  function continueWith(q: string | null) {
    const trimmed = q?.trim();
    if (trimmed) {
      push({ id: crypto.randomUUID(), round: round + 1, personaId: null, navn: "Moderator", content: trimmed });
    }
    void runRound(round + 1, trimmed || undefined);
  }

  function stop() {
    abortRef.current?.abort();
    setLive(null);
    finish();
  }

  const rounds = Array.from({ length: ROUNDS }, (_, i) => i + 1);

  return (
    <div className="card p-0">
      <div className="flex items-center justify-between border-b border-stone-200 px-5 py-3">
        <div className="flex gap-1.5">
          {rounds.map((n) => (
            <span
              key={n}
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                n < round || (n === round && phase === "done")
                  ? "bg-stone-900 text-white"
                  : n === round
                    ? "bg-amber-100 text-amber-900"
                    : "bg-stone-100 text-stone-500"
              }`}
            >
              Runde {n}
            </span>
          ))}
        </div>
        {phase === "idle" && (
          <button className="btn-primary" disabled={disabled} onClick={start}>
            Start diskussion
          </button>
        )}
        {(phase === "running" || phase === "moderator") && (
          <button className="btn-ghost" onClick={stop}>Stop</button>
        )}
        {phase === "done" && (
          <button className="btn-ghost" disabled={disabled} onClick={start}>Kør igen</button>
        )}
      </div>

      <div ref={scrollRef} className="max-h-[560px] min-h-40 space-y-4 overflow-y-auto px-5 py-4">
        {phase === "idle" && (
          <p className="py-10 text-center text-sm text-stone-500">
            Personaerne diskuterer materialet i {ROUNDS} runder og reagerer på hinanden. Mellem runderne kan
            moderatoren stille ét opfølgende spørgsmål.
          </p>
        )}
        {messages.map((m, i) => {
          const showRound = messages.slice(0, i).every((x) => x.round !== m.round);
          return (
            <div key={m.id}>
              {showRound && <RoundDivider n={m.round} />}
              {m.personaId ? (
                <Bubble persona={personas.find((p) => p.id === m.personaId)} navn={m.navn} text={m.content} />
              ) : (
                <ModeratorBubble text={m.content} />
              )}
            </div>
          );
        })}
        {live && <Bubble persona={live.persona} navn={live.persona.navn} text={live.text} typing />}
        {phase === "running" && !live && <p className="text-xs text-stone-400">…</p>}
        {error && <p className="text-sm text-red-700">{error}</p>}
      </div>

      {phase === "moderator" && (
        <div className="space-y-3 border-t border-stone-200 bg-stone-50 px-5 py-4">
          <label className="block text-sm font-medium">
            Moderatorens opfølgende spørgsmål før runde {round + 1}
            <textarea
              className="input mt-1 font-normal"
              rows={2}
              placeholder={suggesting ? "Moderatoren formulerer et spørgsmål…" : "Skriv et spørgsmål, eller fortsæt uden"}
              value={question}
              disabled={suggesting}
              onChange={(e) => setQuestion(e.target.value)}
            />
          </label>
          <div className="flex gap-2">
            <button className="btn-primary" disabled={suggesting || !question.trim()} onClick={() => continueWith(question)}>
              Stil spørgsmålet
            </button>
            <button className="btn-ghost" disabled={suggesting} onClick={() => continueWith(null)}>
              Fortsæt uden spørgsmål
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RoundDivider({ n }: { n: number }) {
  return (
    <div className="my-2 flex items-center gap-3 text-xs font-medium uppercase tracking-wide text-stone-400">
      <div className="h-px flex-1 bg-stone-200" />
      Runde {n}
      <div className="h-px flex-1 bg-stone-200" />
    </div>
  );
}

function Bubble({ persona, navn, text, typing }: { persona?: Persona; navn: string; text: string; typing?: boolean }) {
  return (
    <div className="flex gap-3">
      <Avatar name={navn} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="text-xs text-stone-500">
          <span className="font-semibold text-stone-800">{navn}</span>
          {persona && <> · {persona.jobtitel}</>}
        </div>
        <div className="mt-1 inline-block rounded-2xl rounded-tl-sm bg-stone-100 px-3.5 py-2 text-sm">
          {text}
          {typing && <span className="ml-0.5 inline-block h-3.5 w-1.5 animate-pulse bg-stone-500 align-middle" />}
        </div>
      </div>
    </div>
  );
}

function ModeratorBubble({ text }: { text: string }) {
  return (
    <div className="mx-auto max-w-xl rounded-xl border border-sky-200 bg-sky-50 px-4 py-2.5 text-center text-sm text-sky-900">
      <div className="text-xs font-semibold uppercase tracking-wide text-sky-700">Moderator</div>
      {text}
    </div>
  );
}
