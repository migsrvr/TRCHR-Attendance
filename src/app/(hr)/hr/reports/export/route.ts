import { dtrCsv, dtrFilename } from "@/lib/ui/dtr-csv";
import { getDtrReport } from "@/lib/ui/queries/hr";

/**
 * CSV download of the DTR preview, from the same query and scope as the
 * page, so the file always matches what HR checked.
 */
export async function GET(request: Request) {
  // TODO(auth): require an HR session once Better Auth is wired (401 otherwise).
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const page = await getDtrReport(params);
  if (page.rangeError) {
    return new Response(page.rangeError, { status: 400, headers: { "Content-Type": "text/plain; charset=utf-8" } });
  }
  return new Response(dtrCsv(page), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${dtrFilename(page)}"`,
      "Cache-Control": "no-store",
    },
  });
}
