"use client";

import { getBrowserClient } from "./supabase/client";
import type { ABReaction, ABReport, DiscussionMessage, Persona, Reaction, Report } from "./schemas";

// Client-side persistence. Row Level Security enforces that users only touch their own rows.
// Every method throws on failure so the caller can show a "not saved" warning.

function personaData(p: Persona) {
  const data: Partial<Persona> = { ...p };
  delete data.id;
  return data;
}

async function check<T extends { error: { message: string } | null }>(p: PromiseLike<T>): Promise<T> {
  const res = await p;
  if (res.error) throw new Error(res.error.message);
  return res;
}

export function createStore(projectId: string) {
  const db = getBrowserClient();
  return {
    saveBrief: (audience: string, context: string) =>
      check(db.from("projects").update({ audience, context }).eq("id", projectId)),

    async replacePersonas(personas: Persona[]) {
      await check(db.from("personas").delete().eq("project_id", projectId));
      await check(
        db.from("personas").insert(
          personas.map((p, position) => ({ id: p.id, project_id: projectId, position, data: personaData(p) })),
        ),
      );
    },

    updatePersona: (p: Persona) => check(db.from("personas").update({ data: personaData(p) }).eq("id", p.id)),

    deletePersona: (id: string) => check(db.from("personas").delete().eq("id", id)),

    async createTest(input: {
      input_type: "text" | "url" | "video";
      input_text: string;
      source_url: string | null;
      mode?: "single" | "ab";
      variant_b_input_type?: "text" | "url" | "video";
      variant_b_text?: string;
      variant_b_source_url?: string | null;
    }) {
      const { data, error } = await db.from("tests").insert({ project_id: projectId, ...input }).select("id").single();
      if (error) throw new Error(error.message);
      return (data as { id: string }).id;
    },

    saveReaction: (testId: string, personaId: string, reaction: Reaction | ABReaction) =>
      check(db.from("reactions").insert({ test_id: testId, persona_id: personaId, data: reaction })),

    clearDiscussion: (testId: string) => check(db.from("discussion_messages").delete().eq("test_id", testId)),

    saveDiscussionMessage: (testId: string, m: DiscussionMessage) =>
      check(
        db.from("discussion_messages").insert({
          id: m.id,
          test_id: testId,
          persona_id: m.personaId,
          round: m.round,
          content: m.content,
          speaker_name: m.navn,
        }),
      ),

    saveReport: (testId: string, report: Report | ABReport, includesDiscussion: boolean) =>
      check(db.from("reports").insert({ test_id: testId, data: report, includes_discussion: includesDiscussion })),
  };
}

export type Store = ReturnType<typeof createStore>;
