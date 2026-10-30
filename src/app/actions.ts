"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

export async function createProject(formData: FormData) {
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return;
  const supabase = await createClient();
  const { data, error } = await supabase.from("projects").insert({ name }).select("id").single();
  if (error) throw new Error(`Kunne ikke oprette projektet: ${error.message}`);
  redirect(`/projekter/${data.id}`);
}

export async function deleteProject(formData: FormData) {
  const id = String(formData.get("id") ?? "");
  const supabase = await createClient();
  const { error } = await supabase.from("projects").delete().eq("id", id);
  if (error) throw new Error(`Kunne ikke slette projektet: ${error.message}`);
  revalidatePath("/");
}
