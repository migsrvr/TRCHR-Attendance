import Link from "next/link";
import { redirect } from "next/navigation";

import { DevModeBanner } from "@/components/shell/dev-mode-banner";
import { getMockModeReason, getServerActor, isMockModeEnabled } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HomePage() {
  if (isMockModeEnabled()) {
    const reason = getMockModeReason();
    return (
      <div className="flex min-h-screen flex-col">
        <DevModeBanner />
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-start justify-center gap-6 p-8">
          <h1 className="font-heading text-3xl font-bold uppercase tracking-[0.01em] text-primary">
            Top Realty Intern Attendance
          </h1>
          <p className="text-muted-foreground">
            {reason === "no-database"
              ? "Running in development fixture mode because DATABASE_URL is not configured yet. Pick a surface to preview:"
              : "Running in UI fixture mode (USE_MOCK_APIS=1). Pick a surface to preview:"}
          </p>
          <nav className="flex flex-wrap gap-4 font-semibold text-primary">
            <Link href="/sign-in">Sign in</Link>
            <Link href="/scan">Intern scan</Link>
            <Link href="/dashboard">Intern home</Link>
            <Link href="/hr">HR</Link>
            <Link href="/scan/test-codes">Test QR codes</Link>
          </nav>
        </main>
      </div>
    );
  }

  const actor = await getServerActor();
  if (!actor || actor.status !== "ACTIVE") {
    redirect("/sign-in");
  }
  redirect(actor.role === "HR" ? "/hr" : "/dashboard");
}
