export async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({ error: "Ugyldigt svar fra serveren." }));
  if (!res.ok) throw new Error(data.error ?? "Noget gik galt.");
  return data as T;
}

export const errMsg = (e: unknown) => (e instanceof Error ? e.message : "Noget gik galt.");
