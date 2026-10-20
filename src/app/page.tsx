import Link from "next/link";

export default function HomePage() {
  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-start justify-center gap-6 p-8">
      <h1 className="font-heading text-3xl font-bold uppercase tracking-[0.01em] text-primary">
        Top Realty Intern Attendance
      </h1>
      <p className="text-muted-foreground">
        Scaffolding placeholder. Authentication and role-based routing are not
        implemented yet.
      </p>
      <nav className="flex gap-4 font-semibold text-primary">
        <Link href="/scan">Intern scan</Link>
        <Link href="/dashboard">Intern home</Link>
        <Link href="/hr">HR</Link>
      </nav>
    </main>
  );
}
