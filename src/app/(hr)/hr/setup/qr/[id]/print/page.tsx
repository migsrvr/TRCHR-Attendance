import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

import { QrPrint } from "@/components/views/hr/qr-print";
import { formatLongDate } from "@/lib/ui/format";
import { getCheckpointPrint } from "@/lib/ui/queries/hr";

type Params = Promise<{ id: string }>;

export const metadata: Metadata = {
  title: "Print QR code · Top Realty HR",
};

/** One printable sheet per checkpoint code, posted at the entrance. */
export default async function QrPrintPage({ params }: { params: Params }) {
  const data = await getCheckpointPrint((await params).id);
  if (!data) notFound();
  const { checkpoint } = data;
  const word = checkpoint.action === "IN" ? "Time in" : "Time out";

  return (
    <main className="mx-auto flex min-h-screen max-w-xl flex-col items-center gap-6 bg-white px-6 py-10 text-center text-foreground">
      <Link href="/hr/setup" className="self-start text-sm font-semibold text-primary hover:underline print:hidden">
        ← Back to Office and QR
      </Link>
      <div>
        <p className="font-heading text-6xl font-bold uppercase leading-none tracking-[0.02em]">{checkpoint.action}</p>
        <p className="mt-2 text-xl font-semibold">
          {word} · {checkpoint.name}
        </p>
      </div>
      <QrPrint token={data.token} label={`${word} at ${checkpoint.name}`} />
      <p className="max-w-sm text-base leading-6">
        Scan with the attendance app on your phone {checkpoint.action === "IN" ? "when you arrive" : "when you leave"}. Only{" "}
        {data.officeName} interns can use this code.
      </p>
      <p className="font-mono text-xs text-muted-foreground">
        {checkpoint.action} · v{checkpoint.codeVersion}
        {checkpoint.expiresIso ? ` · valid until ${formatLongDate(checkpoint.expiresIso).replace(/^\w+, /, "")}` : ""}
      </p>
    </main>
  );
}
