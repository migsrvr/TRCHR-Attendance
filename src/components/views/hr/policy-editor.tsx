"use client";

import { CheckCircle2 } from "lucide-react";
import { useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { PolicyExample } from "@/components/views/hr/policy-example";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";
import { formatDuration, formatShortDate } from "@/lib/ui/format";
import {
  changedFields,
  parseDuration,
  ROUNDING_OPTIONS,
  roundingLabel,
  validatePolicy,
  WEEKDAYS,
  type PolicyRules,
  type Rounding,
} from "@/lib/ui/policy";
import type { PolicyVersionVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TIME = "h-9 rounded-btn border border-border bg-card px-2.5 font-mono text-[13px] text-foreground";
const ROW = "grid gap-3 border-b border-hairline py-4 last:border-b-0 sm:grid-cols-[160px_minmax(0,1fr)]";

function RowLabel({ title, hint }: { title: string; hint?: string }) {
  return (
    <div>
      <p className="text-[13px] font-semibold leading-[18px]">{title}</p>
      {hint ? <p className="mt-0.5 text-xs leading-[18px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

/** Draft editor: every field updates the worked example, and changes from the base version are marked. */
export function PolicyEditor({
  draft,
  base,
  example,
  mock,
}: {
  draft: PolicyVersionVM;
  base: PolicyVersionVM | null;
  example: { start: string; end: string }[];
  mock: boolean;
}) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const [rules, setRules] = useState<PolicyRules>(draft.rules);
  const [capText, setCapText] = useState(formatDuration(draft.rules.capMinutes));
  const [fromIso, setFromIso] = useState(draft.fromIso);
  const [state, setState] = useState<{ kind: "idle" | "saving" | "publishing" | "saved" | "published" } | { kind: "error"; message: string }>({ kind: "idle" });
  const confirmRef = useRef<HTMLDialogElement>(null);

  const cap = parseDuration(capText);
  const current: PolicyRules = { ...rules, capMinutes: cap ?? 0 };
  const errors = validatePolicy(current);
  const valid = Object.keys(errors).length === 0;
  const changes = base ? changedFields(base.rules, current) : [];
  const update = (patch: Partial<PolicyRules>) => {
    setRules((previous) => ({ ...previous, ...patch }));
    if (state.kind !== "idle") setState({ kind: "idle" });
  };
  const was = (field: keyof PolicyRules, text: string) =>
    base && changes.includes(field) ? (
      <span className="rounded-chip bg-pend-bg px-1.5 py-0.5 text-xs font-medium text-pend">Changed · was {text}</span>
    ) : null;

  async function save() {
    if (!valid) return;
    setState({ kind: "saving" });
    const result = await api.savePolicyDraft({ version: draft.version, fromIso, rules: current });
    setState(result.ok ? { kind: "saved" } : { kind: "error", message: result.message });
  }

  async function publish() {
    setState({ kind: "publishing" });
    const saved = await api.savePolicyDraft({ version: draft.version, fromIso, rules: current });
    const result = saved.ok ? await api.publishPolicy(draft.version) : saved;
    confirmRef.current?.close();
    setState(result.ok ? { kind: "published" } : { kind: "error", message: result.message });
  }

  if (state.kind === "published") {
    return (
      <div role="status" className="m-5 flex items-start gap-3 rounded-btn bg-pend-bg px-4 py-3">
        <CheckCircle2 aria-hidden="true" className="mt-0.5 size-[18px] shrink-0 text-settled" />
        <p className="text-sm leading-[21px]">
          Version {draft.version} is published and locked. Office days from {formatShortDate(fromIso)} use it; earlier days keep
          their version.
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-3 px-5 pb-2 pt-5">
        <div>
          <h3 className="font-heading text-base font-semibold uppercase leading-[22px] tracking-[0.02em]">Version {draft.version} · draft</h3>
          <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
            {base ? `Copied from version ${base.version} · ` : ""}
            {changes.length === 0 ? "no changes yet" : `${changes.length} change${changes.length === 1 ? "" : "s"} so far`}
          </p>
        </div>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          Applies from
          <input type="date" value={fromIso} onChange={(event) => setFromIso(event.target.value)} className={TIME} />
        </label>
      </div>

      <div className="px-5">
        <div className={ROW}>
          <RowLabel title="Schedule" hint="Only time inside these hours counts." />
          <div className="flex flex-col gap-2">
            <div role="group" aria-label="Workdays" className="flex flex-wrap gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((index) => {
                const day = WEEKDAYS[index]!;
                const on = rules.workdays.includes(index);
                return (
                  <button
                    key={day}
                    type="button"
                    aria-pressed={on}
                    onClick={() =>
                      update({ workdays: on ? rules.workdays.filter((value) => value !== index) : [...rules.workdays, index].sort() })
                    }
                    className={cn(
                      "h-8 min-w-11 rounded-btnsm border px-2 text-xs font-semibold",
                      on ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card text-muted-foreground",
                    )}
                  >
                    {day}
                  </button>
                );
              })}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <input type="time" aria-label="Start" value={rules.start} onChange={(event) => update({ start: event.target.value })} className={TIME} />
              to
              <input type="time" aria-label="End" value={rules.end} onChange={(event) => update({ end: event.target.value })} className={TIME} />
              {was("start", rules.start) ?? was("end", rules.end)}
            </div>
            {errors.workdays || errors.schedule ? <p className="text-xs font-medium text-attn">{errors.workdays ?? errors.schedule}</p> : null}
          </div>
        </div>

        <div className={ROW}>
          <RowLabel title="Break" hint="Deducted once a day, never twice." />
          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <input
                type="number"
                aria-label="Break minutes"
                value={rules.breakMinutes}
                onChange={(event) => update({ breakMinutes: Number(event.target.value) })}
                className={cn(TIME, "w-20")}
              />
              minutes, taken between
              <input
                type="time"
                aria-label="Break window start"
                value={rules.breakWindow.start}
                onChange={(event) => update({ breakWindow: { ...rules.breakWindow, start: event.target.value } })}
                className={TIME}
              />
              and
              <input
                type="time"
                aria-label="Break window end"
                value={rules.breakWindow.end}
                onChange={(event) => update({ breakWindow: { ...rules.breakWindow, end: event.target.value } })}
                className={TIME}
              />
            </div>
            <label className="flex items-center gap-2 text-[13px] leading-[18px]">
              <input
                type="checkbox"
                checked={rules.gapCountsTowardBreak}
                onChange={(event) => update({ gapCountsTowardBreak: event.target.checked })}
                className="size-4 accent-primary"
              />
              A gap between scanned sessions in that window counts toward the break
            </label>
            {errors.breakMinutes || errors.breakWindow ? (
              <p className="text-xs font-medium text-attn">{errors.breakMinutes ?? errors.breakWindow}</p>
            ) : null}
          </div>
        </div>

        <div className={ROW}>
          <RowLabel title="Daily cap" />
          <div className="flex flex-col gap-1">
            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <input
                type="text"
                aria-label="Daily cap"
                value={capText}
                onChange={(event) => {
                  setCapText(event.target.value);
                  if (state.kind !== "idle") setState({ kind: "idle" });
                }}
                aria-invalid={errors.capMinutes ? true : undefined}
                className={cn(TIME, "w-24 aria-[invalid=true]:border-attn")}
              />
              credited at most per day
              {base ? was("capMinutes", formatDuration(base.rules.capMinutes)) : null}
            </div>
            {errors.capMinutes ? <p className="text-xs font-medium text-attn">{errors.capMinutes}</p> : null}
          </div>
        </div>

        <div className={ROW}>
          <RowLabel title="Rounding" hint="Applied once to each day's total." />
          <div className="flex flex-wrap items-center gap-2">
            <select
              aria-label="Rounding"
              value={rules.rounding}
              onChange={(event) => update({ rounding: event.target.value as Rounding })}
              className={cn(TIME, "font-sans")}
            >
              {ROUNDING_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {base ? was("rounding", `“${roundingLabel(base.rules.rounding)}”`) : null}
          </div>
        </div>

        <div className={ROW}>
          <RowLabel title="After midnight" />
          <p className="text-[13px] leading-[19px] text-muted-foreground">
            Sessions that end on the next day are held for review with no credit. This can&apos;t be changed in this release.
          </p>
        </div>
      </div>

      <div className="px-5 pb-4">
        <PolicyExample rules={current} sessions={example} />
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2 border-t border-hairline px-5 py-4">
        <p className="mr-auto min-w-0 basis-full text-xs leading-[18px] text-muted-foreground sm:basis-auto sm:max-w-sm">
          Once published, version {draft.version} is locked. Days before {formatShortDate(fromIso)} keep version{" "}
          {base?.version ?? draft.version - 1}.
        </p>
        {state.kind === "saved" ? (
          <span role="status" className="text-[13px] font-medium text-settled">
            Draft saved
          </span>
        ) : null}
        <Button variant="outline" onClick={save} disabled={!valid} aria-busy={state.kind === "saving"}>
          {state.kind === "saving" ? "Saving…" : "Save draft"}
        </Button>
        <Button onClick={() => confirmRef.current?.showModal()} disabled={!valid}>
          Publish version {draft.version}
        </Button>
        {state.kind === "error" ? (
          <p role="alert" className="basis-full text-right text-xs text-attn">
            {state.message}
          </p>
        ) : null}
      </div>

      <dialog
        ref={confirmRef}
        aria-labelledby="publish-title"
        className="w-[calc(100%-32px)] max-w-[440px] rounded-card border border-border bg-card p-6 text-foreground shadow-[0_12px_32px_rgb(var(--foreground)/0.18)] backdrop:bg-foreground/40"
      >
        <h2 id="publish-title" className="font-heading text-lg font-bold uppercase leading-6 tracking-[0.01em]">
          Publish version {draft.version}?
        </h2>
        <p className="mt-2 text-sm leading-[21px] text-muted-foreground">
          It applies to office days from {formatShortDate(fromIso)} and can&apos;t be edited afterwards. Past days are never
          recalculated.
        </p>
        <div className="mt-5 flex flex-wrap justify-end gap-2">
          <Button variant="outline" onClick={() => confirmRef.current?.close()}>
            Cancel
          </Button>
          <Button onClick={publish} aria-busy={state.kind === "publishing"}>
            {state.kind === "publishing" ? "Publishing…" : "Publish and lock"}
          </Button>
        </div>
      </dialog>
    </>
  );
}
