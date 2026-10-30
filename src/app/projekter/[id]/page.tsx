import { notFound, redirect } from "next/navigation";
import { AppHeader } from "@/components/AppHeader";
import { FocusGroupApp, type ProjectData } from "@/components/FocusGroupApp";
import type { ABReaction, ABReport, DiscussionMessage, Persona, Reaction, Report } from "@/lib/schemas";
import { supabaseEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function ProjectPage({ params }: { params: Promise<{ id: string }> }) {
  if (!supabaseEnabled) redirect("/");
  const { id } = await params;
  const supabase = await createClient();

  // RLS returns nothing for other users' projects, so this doubles as the access check.
  const { data: project } = await supabase
    .from("projects")
    .select("id, name, audience, context")
    .eq("id", id)
    .maybeSingle();
  if (!project) notFound();

  const [{ data: personaRows }, { data: testRow }] = await Promise.all([
    supabase.from("personas").select("id, data").eq("project_id", id).order("position"),
    supabase
      .from("tests")
      .select("id, mode, input_type, input_text, source_url, variant_b_input_type, variant_b_text, variant_b_source_url")
      .eq("project_id", id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let test: ProjectData["test"] = null;
  let abTest: ProjectData["abTest"] = null;
  if (testRow) {
    const [{ data: reactionRows }, { data: messageRows }, { data: reportRow }] = await Promise.all([
      supabase.from("reactions").select("persona_id, data").eq("test_id", testRow.id),
      supabase
        .from("discussion_messages")
        .select("id, persona_id, round, content, speaker_name")
        .eq("test_id", testRow.id)
        .order("created_at"),
      supabase
        .from("reports")
        .select("data, includes_discussion")
        .eq("test_id", testRow.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle(),
    ]);
    const reactionsByPersona = Object.fromEntries(
      (reactionRows ?? []).filter((r) => r.persona_id).map((r) => [r.persona_id, r.data]),
    );
    if (testRow.mode === "ab") {
      abTest = {
        id: testRow.id,
        a: { material: testRow.input_text, source: { type: testRow.input_type, url: testRow.source_url } },
        b: {
          material: testRow.variant_b_text ?? "",
          source: { type: testRow.variant_b_input_type ?? "text", url: testRow.variant_b_source_url },
        },
        reactions: reactionsByPersona as Record<string, ABReaction>,
        report: (reportRow?.data as ABReport) ?? null,
      };
    } else test = {
      id: testRow.id,
      material: testRow.input_text,
      source: { type: testRow.input_type, url: testRow.source_url },
      reactions: reactionsByPersona as Record<string, Reaction>,
      discussion: (messageRows ?? []).map(
        (m): DiscussionMessage => ({
          id: m.id,
          round: m.round,
          personaId: m.persona_id,
          navn: m.speaker_name,
          content: m.content,
        }),
      ),
      report: (reportRow?.data as Report) ?? null,
      reportIncludesDiscussion: reportRow?.includes_discussion ?? false,
    };
  }

  const initial: ProjectData = {
    project,
    personas: (personaRows ?? []).map((r) => ({ ...(r.data as Omit<Persona, "id">), id: r.id })),
    test,
    abTest,
  };

  return (
    <FocusGroupApp
      // Remount when navigating between projects
      key={project.id}
      initial={initial}
      header={<AppHeader title={project.name} />}
    />
  );
}
