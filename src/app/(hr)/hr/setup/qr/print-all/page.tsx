import type { Metadata } from "next";
import Link from "next/link";

import { PrintAllButton, QrSvg } from "@/components/views/hr/qr-print";
import { formatLongDate } from "@/lib/ui/format";
import { getAllActiveCheckpointPrints } from "@/lib/ui/queries/hr";

export const metadata: Metadata = {
  title: "Print all active QR posters · Top Realty HR",
};

/** Multi-page printable bundle: one poster per page (Time in, Time out, etc.) for monthly office posting. */
export default async function QrPrintAllPage() {
  const { officeName, items } = await getAllActiveCheckpointPrints();

  return (
    <div className="min-h-screen bg-white text-foreground">
      <div className="mx-auto flex max-w-3xl flex-wrap items-center justify-between gap-3 border-b border-border px-6 py-4 print:hidden">
        <div className="flex flex-col gap-0.5">
          <Link href="/hr/setup" className="text-sm font-semibold text-primary hover:underline">
            ← Back to Office and QR
          </Link>
          <p className="text-xs text-muted-foreground">
            {items.length} active {items.length === 1 ? "poster" : "posters"} · prints one checkpoint per page
          </p>
        </div>
        {items.length > 0 ? <PrintAllButton count={items.length} /> : null}
      </div>

      {items.length === 0 ? (
        <main className="mx-auto max-w-xl px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">No active QR checkpoints to print.</p>
        </main>
      ) : (
        <main>
          {items.map(({ checkpoint, token }) => {
            const word = checkpoint.action === "IN" ? "Time in" : "Time out";
            return (
              <section
                key={checkpoint.id}
                className="mx-auto flex min-h-[calc(100vh-72px)] max-w-xl break-after-page flex-col items-center justify-center gap-6 border-b border-hairline px-6 py-10 text-center last:break-after-auto last:border-b-0 print:min-h-0 print:border-b-0 print:py-8"
              >
                <div>
                  <p className="font-heading text-xs font-bold uppercase tracking-[0.12em] text-muted-foreground">
                    {officeName} · Intern Attendance
                  </p>
                  <p className="mt-2 font-heading text-6xl font-bold uppercase leading-none tracking-[0.02em]">
                    {checkpoint.action}
                  </p>
                  <p className="mt-2 text-xl font-semibold">
                    {word} · {checkpoint.name}
                  </p>
                </div>
                <QrSvg token={token} label={`${word} at ${checkpoint.name}`} />
                <p className="max-w-sm text-base leading-6">
                  Scan with the attendance app on your phone{" "}
                  {checkpoint.action === "IN" ? "when you arrive" : "when you leave"}. Only {officeName} interns inside
                  the office area can use this code.
                </p>
                <p className="rounded-chip border border-border px-3 py-1 font-mono text-xs font-medium text-foreground">
                  {checkpoint.action} · v{checkpoint.codeVersion}
                  {checkpoint.expiresIso
                    ? ` · valid until ${formatLongDate(checkpoint.expiresIso).replace(/^\w+, /, "")}`
                    : ""}
                </p>
              </section>
            );
          })}
        </main>
      )}
    </div>
  );
}
