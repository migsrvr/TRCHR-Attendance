import type { Metadata, Viewport } from "next";

import { AuthFrame } from "@/components/shell/auth-frame";
import { SignInForm } from "@/components/views/auth/sign-in-form";
import { isMockModeEnabled } from "@/lib/auth/session";

export const metadata: Metadata = {
  title: "Sign in · Top Realty Attendance",
};

// The navy band runs under the status bar, so the browser bar matches it.
export const viewport: Viewport = {
  themeColor: "#10294C",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SignInPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const next = typeof params.next === "string" ? params.next : undefined;

  return (
    <AuthFrame variant="brand">
      <SignInForm mock={isMockModeEnabled()} next={next} />
    </AuthFrame>
  );
}
