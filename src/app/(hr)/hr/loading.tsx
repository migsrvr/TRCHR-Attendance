export default function HrLoading() {
  return (
    <div role="status" aria-label="Loading HR view" className="mx-auto flex max-w-content flex-col gap-5 p-4 sm:p-8">
      <div className="h-14 w-64 animate-pulse rounded-btn bg-muted" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[1, 2, 3, 4].map((key) => (
          <div key={key} className="h-24 animate-pulse rounded-card border border-border bg-card" />
        ))}
      </div>
      <div className="h-80 animate-pulse rounded-card border border-border bg-card" />
      <span className="sr-only">Loading…</span>
    </div>
  );
}
