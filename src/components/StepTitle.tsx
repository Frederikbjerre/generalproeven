export function StepTitle({ n, title }: { n: number; title: string }) {
  return (
    <h2 className="mb-4 flex items-center gap-3 text-xl font-semibold">
      <span className="flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-sm text-white print:hidden">
        {n}
      </span>
      {title}
    </h2>
  );
}
