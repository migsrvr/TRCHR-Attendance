import type { Metadata } from "next";

import { AuthFrame } from "@/components/shell/auth-frame";
import { WelcomeCamera } from "@/components/views/auth/welcome-camera";

export const metadata: Metadata = {
  title: "Allow the camera · Top Realty Attendance",
};

export default function WelcomeCameraPage() {
  return (
    <AuthFrame variant="steps" step={2}>
      <WelcomeCamera />
    </AuthFrame>
  );
}
