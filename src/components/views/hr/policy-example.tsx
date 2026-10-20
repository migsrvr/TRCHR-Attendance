import { formatDuration } from "@/lib/ui/format";
import { creditDay, roundingLabel, type PolicyRules } from "@/lib/ui/policy";

/** How the rules credit one sample day, step by step. */
export function PolicyExample({ rules, sessions }: { rules: PolicyRules; sessions: { start: string; end: string }[] }) {
  const credit = creditDay(sessions, rules);
  const rows: [string, string][] = [
    ["Inside schedule", formatDuration(credit.inside)],
    [
      credit.gapInWindow && rules.gapCountsTowardBreak
        ? `Break still owed (${credit.gapInWindow}-min gap ${credit.breakOwed ? "covers part of it" : "covers it"})`
        : "Break deducted",
      formatDuration(credit.breakOwed),
    ],
  ];
  if (credit.capped) rows.push([`Capped at ${formatDuration(rules.capMinutes)}`, formatDuration(credit.beforeRounding)]);
  if (rules.rounding !== "none") rows.push([roundingLabel(rules.rounding), formatDuration(credit.credited)]);

  return (
    <div className="rounded-btn bg-background px-4 py-3">
      <p className="text-xs font-semibold leading-4 text-muted-foreground">Worked example with these rules</p>
      <dl className="mt-2 grid grid-cols-[minmax(0,1fr)_auto] gap-x-4 gap-y-1 text-[13px] leading-[19px]">
        <dt className="col-span-2 font-mono text-xs text-muted-foreground">
          Sessions {sessions.map((session) => `${session.start}–${session.end}`).join(" and ")}
        </dt>
        {rows.map(([label, value]) => (
          <div key={label} className="contents">
            <dt>{label}</dt>
            <dd className="text-right font-mono">{value}</dd>
          </div>
        ))}
        <dt className="border-t border-hairline pt-1 font-semibold">Credited</dt>
        <dd className="border-t border-hairline pt-1 text-right font-mono font-semibold">{formatDuration(credit.credited)}</dd>
      </dl>
    </div>
  );
}
