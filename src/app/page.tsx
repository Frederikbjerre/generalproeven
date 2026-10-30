import Link from "next/link";
import { createProject } from "@/app/actions";
import { AppHeader } from "@/components/AppHeader";
import { DeleteProjectButton } from "@/components/DeleteProjectButton";
import { FocusGroupApp } from "@/components/FocusGroupApp";
import { supabaseEnabled } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  if (!supabaseEnabled) return <FocusGroupApp />;

  const supabase = await createClient();
  const { data: projects, error } = await supabase
    .from("projects")
    .select("id, name, audience, created_at")
    .order("created_at", { ascending: false });

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <AppHeader title="Dine projekter" />

      <form action={createProject} className="card mb-8 flex gap-2">
        <input name="name" required className="input" placeholder="Navn på nyt projekt, fx “Kommune-kampagne Q1”" />
        <button className="btn-primary shrink-0">Opret projekt</button>
      </form>

      {error && <p className="text-sm text-red-700">Kunne ikke hente projekter: {error.message}</p>}
      {projects?.length === 0 && (
        <p className="py-10 text-center text-stone-500">Du har ingen projekter endnu. Opret dit første ovenfor.</p>
      )}
      <ul className="space-y-3">
        {projects?.map((p) => (
          <li key={p.id} className="card flex items-center justify-between gap-4 py-4">
            <Link href={`/projekter/${p.id}`} className="min-w-0 flex-1">
              <div className="font-semibold hover:underline">{p.name}</div>
              <div className="truncate text-sm text-stone-500">
                {p.audience || "Ingen målgruppe endnu"} · {new Date(p.created_at).toLocaleDateString("da-DK")}
              </div>
            </Link>
            <DeleteProjectButton id={p.id} name={p.name} />
          </li>
        ))}
      </ul>
    </main>
  );
}
