import type { Metadata } from "next";

import { AuthFrame } from "@/components/shell/auth-frame";
import { SetPasswordForm } from "@/components/views/auth/set-password-form";
import { getSetupLink } from "@/lib/ui/queries/auth";

export const metadata: Metadata = {
  title: "Set your password · Top Realty Attendance",
};

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default async function SetPasswordPage({ searchParams }: { searchParams: SearchParams }) {
  const params = await searchParams;
  const token = typeof params.token === "string" ? params.token : "";
  const link = await getSetupLink(token);
  const form = <SetPasswordForm link={link} token={token} mock={process.env.NODE_ENV !== "production"} />;

  // Interns go on to the camera and location steps; HR goes straight to the panel.
  return link?.role === "INTERN" ? (
    <AuthFrame variant="steps" step={1}>
      {form}
    </AuthFrame>
  ) : (
    <AuthFrame
      variant="brand"
      panel={{
        title: "One step to finish your account",
        body: "Choose a password. Next time, sign in with your email and this password.",
      }}
    >
      {form}
    </AuthFrame>
  );
}
