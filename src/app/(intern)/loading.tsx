export default function InternLoading() {
  return (
    <div role="status" aria-label="Loading attendance screen" className="flex min-h-screen flex-col gap-4 bg-background p-4">
      <div className="h-14 animate-pulse rounded-card border border-border bg-card" />
      <div className="h-56 animate-pulse rounded-card border border-border bg-card" />
      <div className="h-32 animate-pulse rounded-card border border-border bg-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
