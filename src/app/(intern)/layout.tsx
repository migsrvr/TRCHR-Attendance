import { requirePageIntern } from "@/lib/auth/session";

export const dynamic = "force-dynamic";

export default async function InternLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  await requirePageIntern("/dashboard");
  return <div className="min-h-screen">{children}</div>;
}
