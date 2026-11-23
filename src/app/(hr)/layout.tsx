import { requirePageHr } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function HrLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePageHr("/hr");
  return <div className="min-h-screen">{children}</div>;
}
