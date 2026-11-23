"use client";

import { CheckCircle2, LogOut, Mail, ShieldOff, TriangleAlert, UserPlus, X } from "lucide-react";
import { useRef, useState, type FormEvent } from "react";

import { Button } from "@/components/ui/button";
import { Field, INPUT_CLASSES } from "@/components/ui/field";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { createHttpHrTeamApi, createMockHrTeamApi } from "@/lib/hr-team/api";
import { formatShortDate } from "@/lib/ui/format";
import { newId } from "@/lib/ui/id";
import type { HrTeamVM, HrUserRowVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-3 align-middle text-[13px] leading-[18px]";

/** HR team administration: invite HR users, resend setup links, revoke sessions, and disable/reactivate. */
export function HrTeamView({ data, mock }: { data: HrTeamVM; mock: boolean }) {
  const currentUserId = data.users.find((u) => u.isCurrentUser)?.id;
  const [api] = useState(() =>
    mock
      ? createMockHrTeamApi({ existingEmails: data.users.map((u) => u.email), currentUserId })
      : createHttpHrTeamApi(),
  );
  const [users, setUsers] = useState<HrUserRowVM[]>(data.users);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState<string | null>(null);
  const [confirmDisable, setConfirmDisable] = useState<HrUserRowVM | null>(null);

  // Invite modal state
  const inviteRef = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [inviteError, setInviteError] = useState<string | null>(null);
  const [inviting, setInviting] = useState(false);
  const [requestId, setRequestId] = useState(newId);

  const activeCount = users.filter((u) => u.status === "ACTIVE").length;

  async function submitInvite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inviting) return;
    const trimmedName = name.trim();
    const trimmedEmail = email.trim();
    if (trimmedName.length < 2) {
      setInviteError("Enter the HR team member's full name.");
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      setInviteError("Enter a valid email address.");
      return;
    }
    setInviteError(null);
    setInviting(true);
    const result = await api.inviteHrUser({
      clientRequestId: requestId,
      name: trimmedName,
      email: trimmedEmail,
    });
    setInviting(false);
    if (!result.ok) {
      setInviteError(result.message);
      return;
    }
    setUsers((current) => [
      ...current,
      {
        id: result.value.id,
        name: result.value.name,
        email: result.value.email,
        status: "PENDING",
        isCurrentUser: false,
        setupLinkSentIso: result.value.setupLinkSentIso,
      },
    ]);
    setName("");
    setEmail("");
    setRequestId(newId());
    setNoticeError(null);
    setNotice(`Invited ${result.value.name}. A setup link is on its way to ${result.value.email}.`);
    inviteRef.current?.close();
  }

  async function resendLink(user: HrUserRowVM) {
    setBusyId(user.id);
    setNoticeError(null);
    const result = await api.resendSetupLink(user.id);
    setBusyId(null);
    if (!result.ok) {
      setNoticeError(result.message);
      return;
    }
    const todayIso = new Date().toISOString().slice(0, 10);
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, setupLinkSentIso: todayIso } : item)),
    );
    setNotice(`Sent a fresh setup link to ${user.email}.`);
  }

  async function revokeSessions(user: HrUserRowVM) {
    setBusyId(user.id);
    setNoticeError(null);
    const result = await api.signOutEverywhere(user.id);
    setBusyId(null);
    if (!result.ok) {
      setNoticeError(result.message);
      return;
    }
    setNotice(`Signed ${user.name} out of all devices.`);
  }

  async function changeStatus(user: HrUserRowVM, disabled: boolean) {
    setBusyId(user.id);
    setNoticeError(null);
    const result = await api.setDisabled(user.id, disabled);
    setBusyId(null);
    setConfirmDisable(null);
    if (!result.ok) {
      setNoticeError(result.message);
      return;
    }
    setUsers((current) =>
      current.map((item) => (item.id === user.id ? { ...item, status: result.value.status } : item)),
    );
    setNotice(
      disabled
        ? `${user.name} was disabled and signed out of all devices.`
        : `${user.name} was reactivated and can sign in again.`,
    );
  }

  return (
    <>
      <PageHeader
        title="HR team"
        subtitle="People who can review corrections, manage interns, export DTR reports, and change office setup."
        actions={
          <Button onClick={() => inviteRef.current?.showModal()}>
            <UserPlus aria-hidden="true" />
            Add HR user
          </Button>
        }
      />

      {notice ? (
        <p role="status" className="flex items-center gap-2 rounded-btn bg-pend-bg px-4 py-2.5 text-[13px] leading-[19px]">
          <CheckCircle2 aria-hidden="true" className="size-4 shrink-0 text-settled" />
          {notice}
        </p>
      ) : null}

      {noticeError ? (
        <p
          role="alert"
          className="flex items-center gap-2 rounded-btn border border-attn/35 bg-attn-bg px-4 py-2.5 text-[13px] font-medium leading-[19px] text-attn"
        >
          <TriangleAlert aria-hidden="true" className="size-4 shrink-0" />
          {noticeError}
        </p>
      ) : null}

      <section aria-label="HR accounts" className="rounded-card border border-border bg-card shadow-card">
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[700px] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={cn(TH, "pl-5")}>
                  Name
                </th>
                <th scope="col" className={TH}>
                  Status
                </th>
                <th scope="col" className={TH}>
                  Last sign-in
                </th>
                <th scope="col" className={cn(TH, "pr-5 text-right")}>
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {users.map((user) => {
                const disabled = user.status === "DISABLED";
                const pending = user.status === "PENDING";
                const cannotDisable = user.isCurrentUser || (user.status === "ACTIVE" && activeCount <= 1);
                return (
                  <tr key={user.id} className={cn(disabled && "text-muted-foreground")}>
                    <td className={cn(TD, "pl-5")}>
                      <div className="flex items-center gap-2">
                        <span className="font-semibold">{user.name}</span>
                        {user.isCurrentUser ? (
                          <span className="rounded-chip bg-pend-bg px-1.5 py-px text-[11px] font-semibold text-pend">
                            You
                          </span>
                        ) : null}
                      </div>
                      <div className="text-xs text-muted-foreground">{user.email}</div>
                    </td>
                    <td className={TD}>
                      <StatusMark kind={{ type: "account", value: user.status }} audience="hr" />
                      {pending && user.setupLinkSentIso ? (
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          Link sent {formatShortDate(user.setupLinkSentIso)}
                        </div>
                      ) : null}
                    </td>
                    <td className={cn(TD, "font-mono text-xs text-muted-foreground")}>
                      {user.lastSignInLabel ?? "Never"}
                    </td>
                    <td className={cn(TD, "pr-5 text-right")}>
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {pending ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => resendLink(user)}
                            aria-busy={busyId === user.id}
                          >
                            <Mail aria-hidden="true" />
                            Resend link
                          </Button>
                        ) : null}
                        {!disabled && !user.isCurrentUser ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => revokeSessions(user)}
                            aria-busy={busyId === user.id}
                          >
                            <LogOut aria-hidden="true" />
                            Sign out
                          </Button>
                        ) : null}
                        {disabled ? (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => changeStatus(user, false)}
                            aria-busy={busyId === user.id}
                          >
                            Reactivate
                          </Button>
                        ) : (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={cannotDisable}
                            title={
                              user.isCurrentUser
                                ? "You cannot disable your own account"
                                : activeCount <= 1
                                  ? "At least one active HR account must remain"
                                  : undefined
                            }
                            onClick={() => setConfirmDisable(user)}
                            className="text-secondary hover:bg-attn-bg disabled:text-muted-foreground"
                          >
                            <ShieldOff aria-hidden="true" />
                            Disable
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs leading-[18px] text-muted-foreground">
          HR accounts are never deleted so audit history keeps who approved or changed records. At least one active HR
          account must remain at all times.
        </p>
      </section>

      <dialog
        ref={inviteRef}
        aria-labelledby="invite-hr-title"
        className="w-[calc(100%-32px)] max-w-[460px] rounded-card border border-border bg-card p-0 text-left text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <div className="flex items-start justify-between gap-3 px-6 pb-2 pt-5">
          <div>
            <h2 id="invite-hr-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
              Add HR user
            </h2>
            <p className="mt-1 text-[13px] leading-[19px] text-muted-foreground">
              We&apos;ll email a single-use setup link so they can choose their own password.
            </p>
          </div>
          <button
            type="button"
            onClick={() => inviteRef.current?.close()}
            aria-label="Close"
            className="flex size-9 shrink-0 items-center justify-center rounded-btn text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X aria-hidden="true" className="size-[18px]" />
          </button>
        </div>
        <form noValidate onSubmit={submitInvite}>
          <div className="flex flex-col gap-4 px-6 py-4">
            {inviteError ? (
              <div
                role="alert"
                className="flex items-start gap-2.5 rounded-btn border border-attn/35 bg-attn-bg px-3.5 py-2.5 text-[13px]"
              >
                <TriangleAlert aria-hidden="true" className="mt-0.5 size-4 shrink-0 text-attn" />
                <p>{inviteError}</p>
              </div>
            ) : null}
            <Field id="hr-user-name" label="Full name">
              <input
                id="hr-user-name"
                type="text"
                value={name}
                onChange={(event) => {
                  setName(event.target.value);
                  setInviteError(null);
                }}
                placeholder="Clarisse Villanueva"
                className={INPUT_CLASSES}
              />
            </Field>
            <Field id="hr-user-email" label="Work email">
              <input
                id="hr-user-email"
                type="email"
                value={email}
                onChange={(event) => {
                  setEmail(event.target.value);
                  setInviteError(null);
                }}
                placeholder="clarisse@toprealty.ph"
                className={INPUT_CLASSES}
              />
            </Field>
          </div>
          <div className="flex justify-end gap-2 border-t border-border px-6 py-4">
            <Button variant="outline" onClick={() => inviteRef.current?.close()}>
              Cancel
            </Button>
            <Button type="submit" aria-busy={inviting}>
              {inviting ? "Sending…" : "Create and send link"}
            </Button>
          </div>
        </form>
      </dialog>

      {confirmDisable ? (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="disable-hr-title"
          className="fixed inset-0 z-40 flex items-center justify-center bg-foreground/40 p-4"
        >
          <div className="w-full max-w-[440px] rounded-card border border-border bg-card p-6 text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)]">
            <h2 id="disable-hr-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
              Disable {confirmDisable.name}?
            </h2>
            <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
              They will be signed out of all devices immediately and won&apos;t be able to access the HR panel. Past
              audit records stay intact.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="outline" onClick={() => setConfirmDisable(null)}>
                Cancel
              </Button>
              <Button
                variant="secondary"
                onClick={() => changeStatus(confirmDisable, true)}
                aria-busy={busyId === confirmDisable.id}
              >
                {busyId === confirmDisable.id ? "Disabling…" : "Disable account"}
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
