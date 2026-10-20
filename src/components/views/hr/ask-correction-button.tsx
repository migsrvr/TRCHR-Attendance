"use client";

import { Send } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createHttpAttendanceApi, createMockAttendanceApi } from "@/lib/attendance/api";

/** Sends the intern a notice asking for a correction for a held session. */
export function AskCorrectionButton({ sessionId, firstName, mock }: { sessionId: string; firstName: string; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockAttendanceApi() : createHttpAttendanceApi()));
  const [state, setState] = useState<"idle" | "sending" | "sent" | "failed">("idle");

  async function ask() {
    if (state === "sending") return;
    setState("sending");
    const result = await api.askForCorrection(sessionId);
    setState(result.ok ? "sent" : "failed");
  }

  if (state === "sent") {
    return (
      <p role="status" className="text-[13px] font-medium leading-[19px] text-settled">
        Asked. {firstName} gets a notice with a link to request a correction for this day.
      </p>
    );
  }
  return (
    <>
      <Button onClick={ask} aria-busy={state === "sending"} className="w-full">
        <Send aria-hidden="true" />
        {state === "sending" ? "Sending…" : `Ask ${firstName} for a correction`}
      </Button>
      {state === "failed" ? (
        <p role="alert" className="text-xs text-attn">
          Couldn&apos;t send. Check your connection and try again.
        </p>
      ) : null}
    </>
  );
}
