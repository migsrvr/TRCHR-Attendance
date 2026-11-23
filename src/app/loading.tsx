export default function Loading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-5xl flex-col gap-4 p-6" aria-busy="true" aria-label="Loading">
      <div className="h-8 w-56 animate-pulse rounded-btn bg-muted" />
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        <div className="h-24 animate-pulse rounded-card bg-muted" />
        <div className="h-24 animate-pulse rounded-card bg-muted" />
        <div className="h-24 animate-pulse rounded-card bg-muted" />
        <div className="h-24 animate-pulse rounded-card bg-muted" />
      </div>
      <div className="h-64 animate-pulse rounded-card bg-muted" />
    </main>
  );
}
