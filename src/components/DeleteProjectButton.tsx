"use client";

import { deleteProject } from "@/app/actions";

export function DeleteProjectButton({ id, name }: { id: string; name: string }) {
  return (
    <form
      action={deleteProject}
      onSubmit={(e) => {
        if (!confirm(`Slet "${name}" med alle personas, tests og rapporter? Det kan ikke fortrydes.`)) e.preventDefault();
      }}
    >
      <input type="hidden" name="id" value={id} />
      <button className="btn-ghost text-sm text-red-700">Slet</button>
    </form>
  );
}
