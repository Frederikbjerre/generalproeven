"use client";

import { useState } from "react";
import { getBrowserClient } from "@/lib/supabase/client";

export function LoginForm() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setState("sending");
    setError(null);
    const { error } = await getBrowserClient().auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) {
      setError(error.message);
      setState("idle");
    } else {
      setState("sent");
    }
  }

  if (state === "sent") {
    return (
      <div className="card">
        <p className="font-medium">Tjek din indbakke</p>
        <p className="mt-1 text-sm text-stone-600">
          Vi har sendt et login-link til <strong>{email}</strong>. Linket virker én gang.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="card space-y-4">
      <label className="block">
        <span className="text-sm font-medium">E-mail</span>
        <input
          type="email"
          required
          className="input mt-1"
          placeholder="dig@firma.dk"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </label>
      {error && <p className="text-sm text-red-700">{error}</p>}
      <button className="btn-primary w-full" disabled={state === "sending"}>
        {state === "sending" ? "Sender…" : "Send login-link"}
      </button>
    </form>
  );
}
