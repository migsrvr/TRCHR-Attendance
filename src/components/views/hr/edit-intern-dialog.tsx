"use client";

import { CheckCircle2, Pencil, TriangleAlert, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASSES } from "@/components/ui/field";
import { createHttpAccountsApi, createMockAccountsApi } from "@/lib/accounts/api";
import type { InternProfileVM } from "@/lib/ui/view-models";

/** Edit internship modal: transfer department, update required hours, end date, or status. */
export function EditInternDialog({ data, mock }: { data: InternProfileVM; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockAccountsApi() : createHttpAccountsApi()));
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [departmentId, setDepartmentId] = useState(data.departmentId ?? "");
  const [requiredHours, setRequiredHours] = useState(String(Math.round(data.hours.requiredMinutes / 60)));
  const [endDate, setEndDate] = useState(data.endDateIso ?? "");
  const [status, setStatus] = useState<"ACTIVE" | "COMPLETED" | "CANCELLED">(data.internshipStatus ?? "ACTIVE");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const departments = data.availableDepartments ?? [];

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const hoursNum = Number(requiredHours);
    if (!Number.isInteger(hoursNum) || hoursNum <= 0) {
      setError("Required hours must be a positive whole number.");
      return;
    }
    setError(null);
    setSending(true);
    const result = await api.updateIntern(data.id, {
      expectedAttendanceVersion: data.attendanceVersion,
      ...(departmentId ? { departmentId } : {}),
      requiredMinutes: hoursNum * 60,
      endDate: endDate || null,
      status,
    });
    setSending(false);
    if (result.ok) {
      setSaved(true);
    } else {
      setError(result.message);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => dialogRef.current?.showModal()}>
        <Pencil aria-hidden="true" />
        Edit internship
      </Button>
      <dialog
        ref={dialogRef}
        aria-labelledby="edit-intern-title"
        onClose={() => {
          if (saved && !mock) window.location.reload();
        }}
        className="w-[calc(100%-32px)] max-w-[480px] rounded-card border border-border bg-card p-0 text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 id="edit-intern-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
              Edit internship · {data.name}
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
              Department transfers keep earlier attendance under the previous department in reports.
            </p>
          </div>
          <button
            type="button"
            onClick={() => dialogRef.current?.close()}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>

        {saved ? (
          <div className="flex flex-col gap-4 px-6 pb-6 pt-3">
            <div role="status" className="flex items-start gap-3 rounded-btn bg-pend-bg px-4 py-3">
              <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-settled" />
              <p className="text-sm leading-[21px]">Internship updated. Audit history has been recorded.</p>
            </div>
            <div className="flex justify-end">
              <Button onClick={() => dialogRef.current?.close()}>Done</Button>
            </div>
          </div>
        ) : (
          <form noValidate onSubmit={submit}>
            <div className="grid gap-4 px-6 py-4 sm:grid-cols-2">
              {error ? (
                <div role="alert" className="flex items-start gap-2 rounded-btn border border-attn/35 bg-attn-bg px-3.5 py-2.5 text-[13px] sm:col-span-2">
                  <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attn" />
                  <p>{error}</p>
                </div>
              ) : null}
              {departments.length > 0 ? (
                <Field id="edit-intern-dept" label="Department" className="sm:col-span-2">
                  <select
                    id="edit-intern-dept"
                    value={departmentId}
                    onChange={(event) => setDepartmentId(event.target.value)}
                    className={INPUT_CLASSES}
                  >
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.id}>
                        {dept.name}
                      </option>
                    ))}
                  </select>
                </Field>
              ) : null}
              <Field id="edit-intern-hours" label="Required hours">
                <input
                  id="edit-intern-hours"
                  type="number"
                  min={1}
                  step={1}
                  value={requiredHours}
                  onChange={(event) => setRequiredHours(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field id="edit-intern-end" label="End date" optional>
                <input
                  id="edit-intern-end"
                  type="date"
                  value={endDate}
                  min={data.startDateIso}
                  onChange={(event) => setEndDate(event.target.value)}
                  className={INPUT_CLASSES}
                />
              </Field>
              <Field id="edit-intern-status" label="Internship status" className="sm:col-span-2">
                <select
                  id="edit-intern-status"
                  value={status}
                  onChange={(event) => setStatus(event.target.value as "ACTIVE" | "COMPLETED" | "CANCELLED")}
                  className={INPUT_CLASSES}
                >
                  <option value="ACTIVE">Active</option>
                  <option value="COMPLETED">Completed (Finished)</option>
                  <option value="CANCELLED">Cancelled</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
              <Button variant="outline" onClick={() => dialogRef.current?.close()}>
                Cancel
              </Button>
              <Button type="submit" aria-busy={sending}>
                {sending ? "Saving…" : "Save changes"}
              </Button>
            </div>
          </form>
        )}
      </dialog>
    </>
  );
}
