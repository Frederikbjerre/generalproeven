import { redirect } from "next/navigation";
import { supabaseEnabled } from "@/lib/supabase/config";
import { LoginForm } from "./LoginForm";

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ fejl?: string }> }) {
  if (!supabaseEnabled) redirect("/");
  const { fejl } = await searchParams;
  return (
    <main className="mx-auto max-w-md px-4 py-20">
      <h1 className="text-3xl font-bold tracking-tight">Generalprøven</h1>
      <p className="mt-1 mb-8 text-stone-600">Log ind med et link på e-mail – ingen adgangskode.</p>
      {fejl === "link" && (
        <p className="mb-4 rounded-lg border border-red-300 bg-red-50 px-4 py-3 text-sm text-red-800">
          Login-linket er udløbet eller allerede brugt. Bed om et nyt.
        </p>
      )}
      <LoginForm />
    </main>
  );
}
