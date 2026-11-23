import Link from "next/link";

import { buttonClasses } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col items-start justify-center gap-4 p-6">
      <p className="font-mono text-xs font-semibold uppercase tracking-[0.08em] text-muted-foreground">404</p>
      <h1 className="font-heading text-2xl font-bold uppercase tracking-[0.01em]">Page not found</h1>
      <p className="text-sm leading-[21px] text-muted-foreground">
        The record or screen you opened doesn&apos;t exist or isn&apos;t available for your account.
      </p>
      <Link href="/" className={buttonClasses({ variant: "primary" })}>
        Go to home
      </Link>
    </main>
  );
}
