import { cn } from "@/lib/utils";

/** Jev's advisory category, or "Manual review" when Jev couldn't read the request. */
export function JevTag({ category, className }: { category: string | null; className?: string }) {
  if (!category) return <span className={cn("text-muted-foreground", className)}>Manual review</span>;
  return (
    <span className={className}>
      <span className="mr-1.5 text-[11px] font-semibold tracking-[0.06em] text-settled">JEV</span>
      {category}
    </span>
  );
}
