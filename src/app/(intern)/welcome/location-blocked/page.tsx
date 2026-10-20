import type { Metadata } from "next";

import { AuthFrame } from "@/components/shell/auth-frame";
import { LocationBlocked } from "@/components/views/auth/location-blocked";

export const metadata: Metadata = {
  title: "Location is off · Top Realty Attendance",
};

export default function LocationBlockedPage() {
  return (
    <AuthFrame variant="steps" step={3}>
      <LocationBlocked />
    </AuthFrame>
  );
}
