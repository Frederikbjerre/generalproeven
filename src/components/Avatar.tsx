const COLORS = [
  "bg-rose-500", "bg-amber-500", "bg-emerald-600", "bg-sky-600",
  "bg-violet-600", "bg-teal-600", "bg-fuchsia-600", "bg-indigo-600",
];

function hash(s: string) {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) | 0;
  return Math.abs(h);
}

export function Avatar({ name, size = "md" }: { name: string; size?: "sm" | "md" }) {
  const initials = name.split(/\s+/).filter(Boolean).map((w) => w[0]).slice(0, 2).join("").toUpperCase();
  const dims = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-sm";
  return (
    <div
      className={`${COLORS[hash(name) % COLORS.length]} ${dims} flex shrink-0 items-center justify-center rounded-full font-semibold text-white`}
      aria-hidden
    >
      {initials}
    </div>
  );
}
