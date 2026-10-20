import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { TestCodes } from "./test-codes-client";

export const metadata: Metadata = {
  title: "Test QR codes · Top Realty Attendance",
};

/** Development aid: codes the mock scan server accepts. Absent in production. */
export default function TestCodesPage() {
  if (process.env.NODE_ENV === "production") notFound();

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 px-4 py-10">
      <div>
        <h1 className="font-heading text-2xl font-bold uppercase tracking-[0.01em]">Test QR codes</h1>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          Show this page on a laptop, open <span className="font-mono">/scan</span> on your phone, and scan a code. These
          work only with the development mock server, not with real attendance.
        </p>
      </div>
      <TestCodes />
    </main>
  );
}
