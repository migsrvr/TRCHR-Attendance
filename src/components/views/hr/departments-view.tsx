"use client";

import Link from "next/link";
import { useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";
import { formatShortDate } from "@/lib/ui/format";
import type { DepartmentRowVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-3 align-middle text-[13px] leading-[18px]";
const INPUT = "h-9 w-full rounded-btn border border-border bg-card px-3 text-[13px] text-foreground aria-[invalid=true]:border-attn";

const isActive = (row: DepartmentRowVM) => row.status.type === "department" && row.status.value === "ACTIVE";

function nameError(name: string, rows: DepartmentRowVM[], exceptId?: string): string | null {
  const trimmed = name.trim();
  if (trimmed.length < 2) return "Enter a name of at least 2 characters.";
  if (trimmed.length > 60) return "Keep the name under 60 characters.";
  if (rows.some((row) => row.id !== exceptId && row.name.toLowerCase() === trimmed.toLowerCase())) return "A department already has that name.";
  return null;
}

/** Departments table with rename and reactivate, plus Add department. Nothing here deletes. */
export function DepartmentsView({ rows: initialRows, mock }: { rows: DepartmentRowVM[]; mock: boolean }) {
  const [api] = useState(() => (mock ? createMockSetupApi({ existingNames: initialRows.map((row) => row.name) }) : createHttpSetupApi()));
  const [rows, setRows] = useState(initialRows);
  const [editing, setEditing] = useState<{ id: string; name: string; error: string | null } | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [addError, setAddError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function saveRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    const error = nameError(editing.name, rows, editing.id);
    if (error) return setEditing({ ...editing, error });
    setBusy(editing.id);
    const result = await api.renameDepartment(editing.id, editing.name.trim());
    setBusy(null);
    if (!result.ok) return setEditing({ ...editing, error: result.message });
    setRows((current) => current.map((row) => (row.id === editing.id ? { ...row, name: editing.name.trim() } : row)));
    setMessage(`Renamed to ${editing.name.trim()}. Past attendance shows the new name too.`);
    setEditing(null);
  }

  async function reactivate(row: DepartmentRowVM) {
    setBusy(row.id);
    const result = await api.setDepartmentActive(row.id, true);
    setBusy(null);
    if (!result.ok) return setMessage(result.message);
    setRows((current) => current.map((item) => (item.id === row.id ? { ...item, status: { type: "department", value: "ACTIVE" }, inactiveSinceIso: undefined } : item)));
    setMessage(`${row.name} is active again and shows in the Add intern form.`);
  }

  async function add(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const error = nameError(newName, rows);
    setAddError(error);
    if (error) return document.getElementById("department-name")?.focus();
    setBusy("new");
    const result = await api.addDepartment(newName.trim());
    setBusy(null);
    if (!result.ok) return setAddError(result.message);
    setRows((current) => [
      ...current,
      { id: result.value.id, name: newName.trim(), activeInterns: 0, settingUp: 0, finished: 0, status: { type: "department", value: "ACTIVE" } },
    ]);
    setMessage(`${newName.trim()} added. It shows in the Add intern form right away.`);
    setNewName("");
  }

  return (
    <>
      <PageHeader title="Departments" subtitle="Where interns are assigned. Used for filters, the dashboard, and DTR exports." />
      {message ? (
        <p role="status" className="rounded-btn bg-pend-bg px-4 py-2.5 text-[13px] leading-[19px]">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap items-start gap-5">
        <section aria-label="Departments" className="min-w-0 shrink grow-[2] basis-[520px] rounded-card border border-border bg-card shadow-card">
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[560px] border-collapse">
              <thead>
                <tr>
                  <th scope="col" className={cn(TH, "pl-5")}>
                    Department
                  </th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    Active interns
                  </th>
                  <th scope="col" className={cn(TH, "text-right")}>
                    Finished
                  </th>
                  <th scope="col" className={TH}>
                    Status
                  </th>
                  <th scope="col" className={cn(TH, "pr-5 text-right")}>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => {
                  const active = isActive(row);
                  const renaming = editing?.id === row.id;
                  return (
                    <tr key={row.id} className={cn(!active && "text-muted-foreground")}>
                      <td className={cn(TD, "pl-5 font-semibold")}>
                        {renaming ? (
                          <form noValidate onSubmit={saveRename} className="flex flex-wrap items-center gap-2">
                            <label htmlFor={`rename-${row.id}`} className="sr-only">
                              New name for {row.name}
                            </label>
                            <input
                              id={`rename-${row.id}`}
                              autoFocus
                              value={editing.name}
                              onChange={(event) => setEditing({ ...editing, name: event.target.value, error: null })}
                              aria-invalid={editing.error ? true : undefined}
                              aria-describedby={editing.error ? `rename-${row.id}-error` : undefined}
                              className={cn(INPUT, "w-44 font-normal")}
                            />
                            <Button type="submit" size="sm" aria-busy={busy === row.id}>
                              Save
                            </Button>
                            <Button variant="ghost" size="sm" onClick={() => setEditing(null)}>
                              Cancel
                            </Button>
                            {editing.error ? (
                              <p id={`rename-${row.id}-error`} className="basis-full text-xs font-medium text-attn">
                                {editing.error}
                              </p>
                            ) : null}
                          </form>
                        ) : (
                          row.name
                        )}
                      </td>
                      <td className={cn(TD, "text-right font-mono")}>
                        {row.activeInterns}
                        {row.settingUp ? <span className="ml-1.5 font-sans text-xs text-muted-foreground">+{row.settingUp} setting up</span> : null}
                      </td>
                      <td className={cn(TD, "text-right font-mono")}>{row.finished}</td>
                      <td className={TD}>
                        <StatusMark
                          kind={row.status}
                          audience="hr"
                          label={!active && row.inactiveSinceIso ? `Inactive since ${formatShortDate(row.inactiveSinceIso)}` : undefined}
                        />
                      </td>
                      <td className={cn(TD, "pr-5 text-right")}>
                        {renaming ? null : active ? (
                          <Button variant="ghost" size="sm" onClick={() => setEditing({ id: row.id, name: row.name, error: null })}>
                            Rename
                          </Button>
                        ) : (
                          <Button variant="outline" size="sm" onClick={() => reactivate(row)} aria-busy={busy === row.id}>
                            Reactivate
                          </Button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="px-5 py-3 text-xs leading-[18px] text-muted-foreground">
            Departments can&apos;t be deleted. Deactivating hides one from new interns; past attendance keeps the department it was
            recorded under.
          </p>
        </section>

        <section aria-labelledby="add-department-title" className="min-w-0 shrink grow basis-[280px] rounded-card border border-border bg-card p-5 shadow-card">
          <h3 id="add-department-title" className="font-heading text-base font-semibold uppercase leading-[22px] tracking-[0.02em]">
            Add department
          </h3>
          <p className="mt-1 text-xs leading-[18px] text-muted-foreground">Shows up in the Add intern form right away.</p>
          <form noValidate onSubmit={add} className="mt-4 flex flex-col gap-2">
            <label htmlFor="department-name" className="text-[13px] font-semibold leading-[18px]">
              Name
            </label>
            <input
              id="department-name"
              value={newName}
              onChange={(event) => {
                setNewName(event.target.value);
                setAddError(null);
              }}
              placeholder="Property Management"
              aria-invalid={addError ? true : undefined}
              aria-describedby={addError ? "department-name-error" : "department-name-hint"}
              className={INPUT}
            />
            {addError ? (
              <p id="department-name-error" className="text-xs font-medium text-attn">
                {addError}
              </p>
            ) : (
              <p id="department-name-hint" className="text-xs text-muted-foreground">
                Names must be unique.
              </p>
            )}
            <Button type="submit" className="mt-1" aria-busy={busy === "new"}>
              {busy === "new" ? "Adding…" : "Add department"}
            </Button>
          </form>
          <div className="mt-5 border-t border-hairline pt-4">
            <p className="text-[13px] font-semibold leading-[18px]">Moving an intern?</p>
            <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
              Change their department from their profile in{" "}
              <Link href="/hr/interns" className="font-semibold text-primary hover:underline">
                Interns
              </Link>
              . Earlier days stay under the old department in reports.
            </p>
          </div>
        </section>
      </div>
    </>
  );
}
