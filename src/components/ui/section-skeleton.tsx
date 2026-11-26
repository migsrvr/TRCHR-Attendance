export function PageContentSkeleton({ rows = 6 }: { rows?: number }) {
  return (
    <div className="animate-pulse space-y-5" aria-busy="true" aria-label="Loading content">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="space-y-2">
          <div className="h-7 w-48 rounded bg-muted" />
          <div className="h-4 w-72 rounded bg-muted" />
        </div>
        <div className="h-9 w-32 rounded-btn bg-muted" />
      </div>
      <div className="rounded-card border border-border bg-card p-5">
        <div className="space-y-3">
          {Array.from({ length: rows }).map((_, i) => (
            <div key={i} className="h-10 w-full rounded bg-muted/70" />
          ))}
        </div>
      </div>
    </div>
  );
}
