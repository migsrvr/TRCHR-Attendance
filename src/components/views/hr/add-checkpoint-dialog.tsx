"use client";

import { CheckCircle2, Plus, Printer, TriangleAlert, X } from "lucide-react";
import Link from "next/link";
import { useRef, useState, type FormEvent } from "react";

import { Button, buttonClasses } from "@/components/ui/button";
import { Field, INPUT_CLASSES } from "@/components/ui/field";
import { createHttpSetupApi, createMockSetupApi, type CreatedCheckpoint } from "@/lib/setup/api";

const EXPIRY_OPTIONS = [
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days (recommended)" },
  { value: "180", label: "180 days" },
  { value: "365", label: "365 days" },
] as const;

/** Modal dialog to create a new QR checkpoint (Time in or Time out) for the office. */
export function AddCheckpointDialog({
  officeId,
  mock,
}: {
  officeId?: string;
  mock: boolean;
}) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [action, setAction] = useState<"TIME_IN" | "TIME_OUT">("TIME_IN");
  const [expiresInDays, setExpiresInDays] = useState("90");
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<CreatedCheckpoint | null>(null);

  function reset() {
    setName("");
    setAction("TIME_IN");
    setExpiresInDays("90");
    setError(null);
    setCreated(null);
  }

  function close() {
    dialogRef.current?.close();
  }

  function onClosed() {
    if (created && !mock) window.location.reload();
    if (created) reset();
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const trimmed = name.trim();
    if (trimmed.length < 2 || trimmed.length > 80) {
      setError("Enter a checkpoint name between 2 and 80 characters.");
      return;
    }
    setError(null);
    setSending(true);
    const result = await api.createCheckpoint({
      ...(officeId ? { officeId } : {}),
      name: trimmed,
      action,
      expiresInDays: Number(expiresInDays),
    });
    setSending(false);
    if (result.ok) setCreated(result.value);
    else setError(result.message);
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => dialogRef.current?.showModal()}>
        <Plus aria-hidden="true" />
        Add checkpoint
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="add-checkpoint-title"
        onClose={onClosed}
        className="w-[calc(100%-32px)] max-w-[460px] rounded-card border border-border bg-card p-0 text-left text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 id="add-checkpoint-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
              Add QR checkpoint
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
              Creates a signed QR sheet for an entrance or desk. Print and post it after saving.
            </p>
          </div>
          <button
            type="button"
            onClick={close}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        {created ? (
          <div className="flex flex-col gap-4 px-6 pb-6 pt-3">
            <div role="status" className="flex items-start gap-3 rounded-btn bg-pend-bg px-4 py-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-settled" />
              <p className="text-sm leading-[21px]">
                <span className="font-semibold">
                  {created.name} · {created.action}
                </span>{" "}
                (v{created.codeVersion}) is ready. Print and post it at the entrance.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Link
                href={`/hr/setup/qr/${encodeURIComponent(created.id)}/print`}
                className={buttonClasses({ variant: "outline" })}
              >
                <Printer aria-hidden="true" />
                Print sheet
              </Link>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            <div className="flex flex-col gap-4 px-6 py-4">
              {error ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-btn border border-attn/35 bg-attn-bg px-3.5 py-2.5 text-[13px]"
                >
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attn" />
                  <p>{error}</p>
                </div>
              ) : null}
              <Field id="checkpoint-name" label="Location label">
                <input
                  id="checkpoint-name"
                  type="text"
                  value={name}
                  onChange={(event) => {
                    setName(event.target.value);
                    setError(null);
                  }}
                  placeholder="3rd floor reception"
                  className={INPUT_CLASSES}
                />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field id="checkpoint-action" label="Action">
                  <select
                    id="checkpoint-action"
                    value={action}
                    onChange={(event) => setAction(event.target.value as "TIME_IN" | "TIME_OUT")}
                    className={INPUT_CLASSES}
                  >
                    <option value="TIME_IN">Time in</option>
                    <option value="TIME_OUT">Time out</option>
                  </select>
                </Field>
                <Field id="checkpoint-expiry" label="Code validity">
                  <select
                    id="checkpoint-expiry"
                    value={expiresInDays}
                    onChange={(event) => setExpiresInDays(event.target.value)}
                    className={INPUT_CLASSES}
                  >
                    {EXPIRY_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </Field>
              </div>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" aria-busy={sending}>
                {sending ? "Creating…" : "Create checkpoint"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
