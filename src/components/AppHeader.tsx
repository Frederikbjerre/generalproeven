import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export async function AppHeader({ title }: { title?: string }) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return (
    <header className="mb-10 print:mb-4">
      <div className="flex items-center justify-between gap-4 text-sm print:hidden">
        <Link href="/" className="font-semibold tracking-tight">Generalprøven</Link>
        <div className="flex items-center gap-3 text-stone-500">
          <span className="hidden sm:inline">{user?.email}</span>
          <form action="/auth/signout" method="post">
            <button className="btn-ghost">Log ud</button>
          </form>
        </div>
      </div>
      {title && <h1 className="mt-6 text-3xl font-bold tracking-tight">{title}</h1>}
    </header>
  );
}
