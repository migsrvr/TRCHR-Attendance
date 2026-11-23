"use client";

import { CheckCircle2, TriangleAlert, UserPlus, X } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASSES } from "@/components/ui/field";
import { createHttpAccountsApi, createMockAccountsApi } from "@/lib/accounts/api";
import { newId } from "@/lib/ui/id";
import { validateNewIntern, type NewInternDraft, type NewInternErrors } from "@/lib/ui/intern-form";

const FIELD_ORDER: (keyof NewInternDraft)[] = ["name", "email", "department", "requiredHours", "startDate", "endDate"];
const FIELD_ID: Record<keyof NewInternDraft, string> = {
  name: "intern-name",
  email: "intern-email",
  department: "intern-department",
  requiredHours: "intern-hours",
  startDate: "intern-start",
  endDate: "intern-end",
};

/**
 * "Add intern" button and its modal. Uses the native <dialog> (focus stays
 * inside, Esc closes, focus returns to the button). HR creates the account
 * and internship; the intern gets an email link to choose a password.
 */
export function AddInternDialog({
  departments,
  departmentOptions,
  officeLabel,
  defaultRequiredMinutes,
  mock,
  openOnLoad = false,
}: {
  departments: string[];
  departmentOptions?: { id: string; name: string }[];
  officeLabel: string;
  defaultRequiredMinutes: number;
  mock: boolean;
  /** Opened from another page's "Add intern" link (?add=1). */
  openOnLoad?: boolean;
}) {
  const [api] = useState(() => (mock ? createMockAccountsApi() : createHttpAccountsApi()));
  const empty: NewInternDraft = {
    name: "",
    email: "",
    department: "",
    requiredHours: String(Math.round(defaultRequiredMinutes / 60)),
    startDate: "",
    endDate: "",
  };
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [draft, setDraft] = useState(empty);
  const [errors, setErrors] = useState<NewInternErrors>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [created, setCreated] = useState<{ name: string; email: string } | null>(null);
  // One id per intern being added, so a retry after a dropped connection can't create two.
  const [requestId, setRequestId] = useState(newId);

  function open() {
    dialogRef.current?.showModal();
  }

  useEffect(() => {
    if (!openOnLoad) return;
    dialogRef.current?.showModal();
    const url = new URL(window.location.href);
    url.searchParams.delete("add");
    window.history.replaceState(null, "", url);
  }, [openOnLoad]);

  function reset() {
    setDraft(empty);
    setErrors({});
    setServerError(null);
    setCreated(null);
    setRequestId(newId());
  }

  function close() {
    dialogRef.current?.close();
  }

  function onClosed() {
    if (created && !mock) window.location.reload();
    if (created) reset();
  }

  function update<K extends keyof NewInternDraft>(key: K, value: string) {
    setDraft((current) => ({ ...current, [key]: value }));
    if (errors[key]) setErrors((current) => ({ ...current, [key]: undefined }));
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const found = validateNewIntern(draft, departments);
    setErrors(found);
    const first = FIELD_ORDER.find((key) => found[key]);
    if (first) {
      document.getElementById(FIELD_ID[first])?.focus();
      return;
    }
    setServerError(null);
    setSending(true);
    const departmentId = departmentOptions?.find((option) => option.name === draft.department)?.id;
    const result = await api.createIntern({
      clientRequestId: requestId,
      name: draft.name.trim(),
      email: draft.email.trim(),
      ...(departmentId ? { departmentId } : {}),
      department: draft.department,
      requiredMinutes: Number(draft.requiredHours) * 60,
      startDate: draft.startDate,
      endDate: draft.endDate || null,
    });
    setSending(false);
    if (result.ok) setCreated({ name: draft.name.trim(), email: draft.email.trim() });
    else setServerError(result.message);
  }

  const describedBy = (key: keyof NewInternDraft) => (errors[key] ? `${FIELD_ID[key]}-error` : undefined);
  const invalid = (key: keyof NewInternDraft) => (errors[key] ? true : undefined);

  return (
    <>
      <Button onClick={open}>
        <UserPlus aria-hidden="true" />
        Add intern
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="add-intern-title"
        onClose={onClosed}
        className="w-[calc(100%-32px)] max-w-[560px] rounded-card border border-border bg-card p-0 text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 id="add-intern-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
              Add intern
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
              The account turns active once the internship is saved. Then we email a link to set a password.
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
                <span className="font-semibold">{created.name}</span> was added. A setup link is on its way to{" "}
                <span className="font-semibold">{created.email}</span>. They&apos;ll show as Setup pending until they choose a
                password.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={reset}>
                Add another
              </Button>
              <Button onClick={close}>Done</Button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
              {serverError ? (
                <div
                  role="alert"
                  className="flex items-start gap-2.5 rounded-btn border border-attn/35 bg-attn-bg px-3.5 py-3 text-[13px] leading-[19px] sm:col-span-2"
                >
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attn" />
                  <p>{serverError}</p>
                </div>
              ) : null}
              <Field id={FIELD_ID.name} label="Full name" error={errors.name} className="sm:col-span-2">
                <input
                  id={FIELD_ID.name}
                  type="text"
                  autoComplete="off"
                  value={draft.name}
                  onChange={(event) => update("name", event.target.value)}
                  placeholder="Rina Mendoza"
                  aria-invalid={invalid("name")}
                  aria-describedby={describedBy("name")}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field id={FIELD_ID.email} label="Email" error={errors.email} className="sm:col-span-2">
                <input
                  id={FIELD_ID.email}
                  type="email"
                  autoComplete="off"
                  spellCheck={false}
                  value={draft.email}
                  onChange={(event) => update("email", event.target.value)}
                  placeholder="rina.mendoza@school.edu.ph"
                  aria-invalid={invalid("email")}
                  aria-describedby={describedBy("email")}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field id={FIELD_ID.department} label="Department" error={errors.department}>
                <select
                  id={FIELD_ID.department}
                  value={draft.department}
                  onChange={(event) => update("department", event.target.value)}
                  aria-invalid={invalid("department")}
                  aria-describedby={describedBy("department")}
                  className={INPUT_CLASSES}
                >
                  <option value="" disabled>
                    Choose…
                  </option>
                  {departments.map((department) => (
                    <option key={department} value={department}>
                      {department}
                    </option>
                  ))}
                </select>
              </Field>
              <Field id={FIELD_ID.requiredHours} label="Required hours" error={errors.requiredHours}>
                <input
                  id={FIELD_ID.requiredHours}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  value={draft.requiredHours}
                  onChange={(event) => update("requiredHours", event.target.value)}
                  aria-invalid={invalid("requiredHours")}
                  aria-describedby={describedBy("requiredHours")}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field id={FIELD_ID.startDate} label="Start date" error={errors.startDate}>
                <input
                  id={FIELD_ID.startDate}
                  type="date"
                  value={draft.startDate}
                  onChange={(event) => update("startDate", event.target.value)}
                  aria-invalid={invalid("startDate")}
                  aria-describedby={describedBy("startDate")}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field id={FIELD_ID.endDate} label="End date" optional error={errors.endDate}>
                <input
                  id={FIELD_ID.endDate}
                  type="date"
                  value={draft.endDate}
                  min={draft.startDate || undefined}
                  onChange={(event) => update("endDate", event.target.value)}
                  aria-invalid={invalid("endDate")}
                  aria-describedby={describedBy("endDate")}
                  className={INPUT_CLASSES}
                />
              </Field>
              <p className="text-xs leading-[18px] text-muted-foreground sm:col-span-2">
                Office: {officeLabel}. Passwords are never sent by email.
              </p>
            </div>
            <div className="flex flex-wrap justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={close}>
                Cancel
              </Button>
              <Button type="submit" aria-busy={sending}>
                {sending ? "Creating…" : "Create and send link"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
