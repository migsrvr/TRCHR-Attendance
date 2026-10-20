"use client";

import { Check, Send } from "lucide-react";
import { useState, type FormEvent } from "react";

import { Button, ButtonLink } from "@/components/ui/button";
import { createHttpCorrectionsApi, createMockCorrectionsApi } from "@/lib/corrections/api";
import {
  CORRECTION_REASONS,
  describeProposal,
  reasonLabel,
  suggestReason,
  validateCorrection,
  type CorrectionField,
  type CorrectionProposal,
  type CorrectionReason,
} from "@/lib/ui/correction-form";
import { formatShortDate } from "@/lib/ui/format";
import { newId } from "@/lib/ui/id";
import type { NewCorrectionVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const FIELD_ORDER: CorrectionField[] = ["dateIso", "reason", "timeIn", "timeOut", "explanation"];
const FIELD_ID: Record<CorrectionField, string> = {
  dateIso: "corr-date",
  reason: "corr-reason-missed_clock_out",
  timeIn: "corr-time-in",
  timeOut: "corr-time-out",
  explanation: "corr-explanation",
};

const inputClass =
  "phone-field h-12 w-full rounded-btn border border-border bg-card px-3.5 text-foreground aria-[invalid=true]:border-attn";

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? (
    <p id={id} className="text-xs font-medium leading-[18px] text-attn">
      {message}
    </p>
  ) : null;
}

/**
 * The intern's correction request. Fields are 16px (no zoom on iPhone), the
 * reason is a real radio group, and the submit button sits at the end of the
 * form rather than fixed to the screen, so the phone keyboard never covers it.
 */
export function NewCorrectionForm({ data, mock }: { data: NewCorrectionVM; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockCorrectionsApi() : createHttpCorrectionsApi()));
  // One id per form: resending after a dropped connection returns the same request.
  const [clientRequestId] = useState(newId);

  const initialRecorded = data.recordedByDate[data.initialDateIso] ?? null;
  const [dateIso, setDateIso] = useState(data.initialDateIso);
  const [reason, setReason] = useState<CorrectionReason | null>(suggestReason(initialRecorded));
  const [timeIn, setTimeIn] = useState(initialRecorded?.timeIn ?? "");
  const [timeOut, setTimeOut] = useState(initialRecorded?.timeOut ?? "");
  const [explanation, setExplanation] = useState("");
  const [errors, setErrors] = useState<Partial<Record<CorrectionField, string>>>({});
  const [phase, setPhase] = useState<"editing" | "sending" | "sent">("editing");
  const [serverError, setServerError] = useState<string | null>(null);
  const [sentProposal, setSentProposal] = useState<CorrectionProposal>({});

  const recorded = data.recordedByDate[dateIso] ?? null;
  const changedIn = Boolean(timeIn) && timeIn !== recorded?.timeIn;
  const changedOut = Boolean(timeOut) && timeOut !== recorded?.timeOut;

  function clearError(field: CorrectionField) {
    setErrors(({ [field]: _removed, ...rest }) => rest);
  }

  function changeDate(value: string) {
    setDateIso(value);
    const next = data.recordedByDate[value] ?? null;
    setTimeIn(next?.timeIn ?? "");
    setTimeOut(next?.timeOut ?? "");
    setReason((current) => suggestReason(next) ?? current);
    setErrors({});
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (phase === "sending") return;
    setServerError(null);

    const result = validateCorrection({ dateIso, reason, timeIn, timeOut, explanation, recorded }, data.todayIso);
    if (!result.ok) {
      setErrors(result.errors);
      const first = FIELD_ORDER.find((field) => result.errors[field]);
      if (first) document.getElementById(FIELD_ID[first])?.focus();
      return;
    }

    setPhase("sending");
    const response = await api.create({
      clientRequestId,
      attendanceDate: dateIso,
      reason: reason!,
      explanation: explanation.trim(),
      proposedTimeIn: result.proposal.timeIn,
      proposedTimeOut: result.proposal.timeOut,
    });
    if (response.ok) {
      setSentProposal(result.proposal);
      setPhase("sent");
      document.getElementById("app-main")?.scrollTo({ top: 0 });
    } else {
      setServerError(response.message);
      setPhase("editing");
    }
  }

  if (phase === "sent") {
    return (
      <div className="flex min-h-full flex-col gap-4 p-4 pb-safe-or-4">
        <section
          role="status"
          className="flex flex-col items-center rounded-panel border border-border bg-card px-5 pb-6 pt-7 text-center shadow-card"
        >
          <span className="flex size-14 items-center justify-center rounded-full bg-settled text-white">
            <Check aria-hidden="true" className="size-7" strokeWidth={2.5} />
          </span>
          <h1 className="mt-4 font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.02em] text-settled">
            Sent to HR
          </h1>
          <p className="mt-1 text-base font-semibold leading-[22px]">
            {formatShortDate(dateIso, { weekday: true })} · {reason ? reasonLabel(reason) : ""}
          </p>
          <p className="mt-1 text-sm leading-[21px] text-muted-foreground">{describeProposal(sentProposal)}</p>
          <p className="mt-4 border-t border-hairline pt-4 text-[13px] leading-[19px] text-muted-foreground">
            HR will review it. Until then it adds no hours. You&apos;ll see the decision under Corrections.
          </p>
        </section>
        <div className="mt-auto flex flex-col gap-2 pt-2">
          <ButtonLink href="/corrections" size="lg" className="w-full">
            View your corrections
          </ButtonLink>
          <ButtonLink href="/dashboard" size="lg" variant="outline" className="w-full font-medium">
            Back to Home
          </ButtonLink>
        </div>
      </div>
    );
  }

  const describedBy = (field: CorrectionField, hint?: string) =>
    [errors[field] ? `${FIELD_ID[field]}-error` : null, hint ?? null].filter(Boolean).join(" ") || undefined;

  return (
    <form noValidate onSubmit={submit} className="flex min-h-full flex-col gap-4 p-4 pb-safe-or-4">
      <div>
        <h1 className="font-heading text-[22px] font-bold uppercase leading-7 tracking-[0.01em]">Request a correction</h1>
        <p className="mt-0.5 text-[13px] leading-[19px] text-muted-foreground">
          HR reviews every request. Proposed times add no hours until approved.
        </p>
      </div>

      {Object.keys(errors).length > 0 ? (
        <p role="alert" className="rounded-btn bg-attn-bg px-3.5 py-2.5 text-[13px] font-medium leading-[19px] text-attn">
          Check the highlighted fields.
        </p>
      ) : null}

      <div className="flex flex-col gap-1.5">
        <label htmlFor="corr-date" className="text-[13px] font-semibold leading-[18px]">
          Day
        </label>
        <input
          id="corr-date"
          type="date"
          value={dateIso}
          min={data.earliestDateIso}
          max={data.todayIso}
          onChange={(event) => changeDate(event.target.value)}
          aria-invalid={errors.dateIso ? true : undefined}
          aria-describedby={describedBy("dateIso", "corr-recorded")}
          className={inputClass}
        />
        <FieldError id="corr-date-error" message={errors.dateIso} />
        <p id="corr-recorded" className="rounded-btnsm bg-pend-bg px-3 py-2 text-xs leading-[18px]">
          {recorded ? (
            <>
              Recorded that day: Time in{" "}
              {recorded.timeIn ? (
                <span className="font-mono font-semibold">{recorded.timeIn}</span>
              ) : (
                <span className="italic">none</span>
              )}{" "}
              · Time out{" "}
              {recorded.timeOut ? (
                <span className="font-mono font-semibold">{recorded.timeOut}</span>
              ) : (
                <span className="italic">no Time out</span>
              )}
            </>
          ) : (
            "No scans recorded that day. Add both times."
          )}
        </p>
      </div>

      <fieldset
        className="flex flex-col gap-2"
        aria-invalid={errors.reason ? true : undefined}
        aria-describedby={errors.reason ? "corr-reason-error" : undefined}
      >
        <legend className="mb-2 text-[13px] font-semibold leading-[18px]">What happened?</legend>
        <div className="flex flex-wrap gap-2">
          {CORRECTION_REASONS.map((option) => (
            <label key={option.value} className="relative">
              <input
                id={`corr-reason-${option.value}`}
                type="radio"
                name="reason"
                value={option.value}
                checked={reason === option.value}
                onChange={() => {
                  setReason(option.value);
                  clearError("reason");
                }}
                className="peer sr-only"
              />
              <span
                className={cn(
                  "flex h-11 cursor-pointer items-center rounded-full border px-4 text-[13px] leading-none",
                  "border-border bg-card font-medium text-foreground",
                  "peer-checked:border-2 peer-checked:border-pend peer-checked:bg-pend-bg peer-checked:font-semibold peer-checked:text-pend",
                  "peer-focus-visible:outline peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-ring",
                )}
              >
                {option.label}
              </span>
            </label>
          ))}
        </div>
        <FieldError id="corr-reason-error" message={errors.reason} />
      </fieldset>

      <div className="grid grid-cols-2 gap-2.5">
        {(
          [
            { field: "timeIn", id: "corr-time-in", label: "Time in", value: timeIn, set: setTimeIn, changed: changedIn, recordedValue: recorded?.timeIn },
            { field: "timeOut", id: "corr-time-out", label: "Time out", value: timeOut, set: setTimeOut, changed: changedOut, recordedValue: recorded?.timeOut },
          ] as const
        ).map((item) => (
          <div key={item.field} className="flex min-w-0 flex-col gap-1.5">
            <label htmlFor={item.id} className="text-[13px] font-semibold leading-[18px]">
              {item.label}
            </label>
            <input
              id={item.id}
              type="time"
              value={item.value}
              onChange={(event) => {
                item.set(event.target.value);
                clearError(item.field);
              }}
              aria-invalid={errors[item.field] ? true : undefined}
              aria-describedby={describedBy(item.field, `${item.id}-hint`)}
              className={cn(inputClass, "font-mono", item.changed && "border-2 border-primary font-semibold")}
            />
            <p id={`${item.id}-hint`} className={cn("text-xs leading-4", item.changed ? "text-primary" : "text-muted-foreground")}>
              {item.changed ? "Your proposed time" : item.recordedValue ? "As recorded" : "Not recorded"}
            </p>
            <FieldError id={`${item.id}-error`} message={errors[item.field]} />
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label htmlFor="corr-explanation" className="text-[13px] font-semibold leading-[18px]">
          Explain what happened
        </label>
        <textarea
          id="corr-explanation"
          rows={4}
          value={explanation}
          onChange={(event) => {
            setExplanation(event.target.value);
            clearError("explanation");
          }}
          placeholder="The client meeting ran late and I left at 6:05 PM without scanning OUT."
          aria-invalid={errors.explanation ? true : undefined}
          aria-describedby={describedBy("explanation", "corr-explanation-hint")}
          className={cn(inputClass, "h-auto resize-y py-2.5 leading-[22px]")}
        />
        <p id="corr-explanation-hint" className="text-xs leading-[18px] text-muted-foreground">
          Say where you were and who can confirm it. HR sees your recorded scans next to this.
        </p>
        <FieldError id="corr-explanation-error" message={errors.explanation} />
      </div>

      {serverError ? (
        <p role="alert" className="rounded-btn bg-attn-bg px-3.5 py-2.5 text-[13px] font-medium leading-[19px] text-attn">
          {serverError}
        </p>
      ) : null}

      <div className="mt-auto pt-2">
        <Button type="submit" size="lg" className="w-full" aria-busy={phase === "sending"}>
          <Send aria-hidden="true" />
          {phase === "sending" ? "Sending…" : "Send to HR"}
        </Button>
      </div>
    </form>
  );
}
