import type { Metadata } from "next";

import { AuthFrame } from "@/components/shell/auth-frame";
import { WelcomeLocation } from "@/components/views/auth/welcome-location";

export const metadata: Metadata = {
  title: "Allow location · Top Realty Attendance",
};

export default function WelcomeLocationPage() {
  return (
    <AuthFrame variant="steps" step={3}>
      <WelcomeLocation />
    </AuthFrame>
  );
}
