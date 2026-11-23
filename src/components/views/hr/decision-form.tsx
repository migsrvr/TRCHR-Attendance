"use client";

import { Check, CheckCircle2, MessageCircleQuestion, RefreshCw, TriangleAlert, X } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { createHttpReviewsApi, createMockReviewsApi, type Decided } from "@/lib/reviews/api";
import { newId } from "@/lib/ui/id";
import { validateDecisionNote, type ReviewDecision } from "@/lib/ui/review-decision";

const DONE_COPY: Record<Decided["status"], string> = {
  APPROVED: "Approved. The day is recalculated and the intern sees your note.",
  REJECTED: "Rejected. The recorded times stay as they are and the intern sees your note.",
  NEEDS_INFO: "Sent back to the intern with your question. It returns here when they reply.",
};

/**
 * Decision note plus the three decisions. Sends the request version HR is
 * looking at; a 409 means the intern changed it, so nothing was saved and HR
 * is asked to refresh.
 */
export function DecisionForm({
  correctionId,
  version,
  expectedSessionVersion,
  expectedAttendanceVersion,
  firstName,
  dateLabel,
  mock,
  initialConflict = false,
}: {
  correctionId: string;
  version: number;
  expectedSessionVersion?: number | null;
  expectedAttendanceVersion?: number;
  firstName: string;
  dateLabel: string;
  mock: boolean;
  initialConflict?: boolean;
}) {
  const [api] = useState(() => (mock ? createMockReviewsApi({ conflict: initialConflict }) : createHttpReviewsApi()));
  const [operationKey] = useState(newId);
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);
  const [sending, setSending] = useState<ReviewDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [conflict, setConflict] = useState(initialConflict);
  const [done, setDone] = useState<Decided["status"] | null>(null);
  const noteRef = useRef<HTMLTextAreaElement>(null);

  async function decide(decision: ReviewDecision) {
    if (sending) return;
    const problem = validateDecisionNote(note);
    setNoteError(problem);
    if (problem) {
      noteRef.current?.focus();
      return;
    }
    setError(null);
    setSending(decision);
    const result = await api.decide({
      correctionId,
      version,
      operationKey,
      ...(expectedSessionVersion !== undefined ? { expectedSessionVersion } : {}),
      ...(expectedAttendanceVersion !== undefined ? { expectedAttendanceVersion } : {}),
      decision,
      note: note.trim(),
    });
    setSending(null);
    if (result.ok) setDone(result.value.status);
    else if (result.conflict) setConflict(true);
    else setError(result.message);
  }

  if (done) {
    return (
      <div role="status" className="mx-5 mb-5 flex items-start gap-3 rounded-btn bg-pend-bg px-4 py-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-settled" />
        <p className="text-sm leading-[21px]">{DONE_COPY[done]}</p>
      </div>
    );
  }

  return (
    <form noValidate onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-2 border-t border-hairline px-5 py-4">
      {conflict ? (
        <div role="alert" className="flex flex-wrap items-start gap-3 rounded-btn border border-attn/35 bg-attn-bg px-4 py-3">
          <TriangleAlert aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-attn" />
          <div className="min-w-0 flex-1 basis-64">
            <p className="text-[13px] font-semibold leading-[19px]">This request changed while you were reading it</p>
            <p className="text-[13px] leading-[19px]">
              {firstName} updated it, so you&apos;re looking at an old version. Refresh to see it before you decide. Nothing was
              saved.
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => window.location.reload()}>
            <RefreshCw aria-hidden="true" />
            Refresh request
          </Button>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-[13px] font-medium text-attn">
          {error}
        </p>
      ) : null}
      <label htmlFor="decision-note" className="text-[13px] font-semibold leading-[18px]">
        Decision note <span className="font-normal text-muted-foreground">· required, {firstName} sees this</span>
      </label>
      <textarea
        ref={noteRef}
        id="decision-note"
        rows={3}
        required
        value={note}
        onChange={(event) => {
          setNote(event.target.value);
          if (noteError) setNoteError(null);
        }}
        aria-invalid={noteError ? true : undefined}
        aria-describedby={noteError ? "decision-note-error" : "decision-help"}
        placeholder="Approved: confirmed with the team lead that the meeting ran until 6 PM."
        className="w-full resize-y rounded-btn border border-border bg-card px-3 py-2.5 text-sm leading-[21px] text-foreground placeholder:text-muted-foreground aria-[invalid=true]:border-attn"
      />
      {noteError ? (
        <p id="decision-note-error" className="text-xs font-medium text-attn">
          {noteError}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
        <p id="decision-help" className="mr-auto basis-full text-xs leading-[18px] text-muted-foreground sm:basis-auto sm:max-w-xs">
          Approving saves revision history and recalculates {dateLabel}. The original scans stay unchanged.
        </p>
        <Button variant="ghost" disabled={conflict} aria-busy={sending === "ASK_INFO"} onClick={() => decide("ASK_INFO")}>
          <MessageCircleQuestion aria-hidden="true" />
          {sending === "ASK_INFO" ? "Sending…" : "Ask for more info"}
        </Button>
        <Button variant="secondary" disabled={conflict} aria-busy={sending === "REJECT"} onClick={() => decide("REJECT")}>
          <X aria-hidden="true" />
          {sending === "REJECT" ? "Rejecting…" : "Reject"}
        </Button>
        <Button variant="accent" disabled={conflict} aria-busy={sending === "APPROVE"} onClick={() => decide("APPROVE")}>
          <Check aria-hidden="true" />
          {sending === "APPROVE" ? "Approving…" : "Approve correction"}
        </Button>
      </div>
    </form>
  );
}
