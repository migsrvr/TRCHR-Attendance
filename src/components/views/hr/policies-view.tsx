import Link from "next/link";

import { Card } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { ExampleValuesBanner, versionRange } from "@/components/views/hr/setup-shared";
import { PolicyEditor } from "@/components/views/hr/policy-editor";
import { PolicyExample } from "@/components/views/hr/policy-example";
import { formatDuration, formatShortDate } from "@/lib/ui/format";
import { roundingLabel, workdaysLabel } from "@/lib/ui/policy";
import type { PoliciesVM, PolicyVersionVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const STATE_WORD = { DRAFT: "draft", ACTIVE: "active", SUPERSEDED: "superseded" } as const;

function versionMeta(version: PolicyVersionVM): string {
  if (version.state === "DRAFT") return `Starts ${formatShortDate(version.fromIso)}, ${version.fromIso.slice(0, 4)} · editing`;
  const sessions = `${version.sessionsUsing.toLocaleString("en-US")} sessions`;
  return version.state === "ACTIVE" ? `${versionRange(version)} · ${sessions}` : `${versionRange(version)} · locked`;
}

function LockedDetails({ version, example }: { version: PolicyVersionVM; example: PoliciesVM["example"] }) {
  const rules = version.rules;
  return (
    <>
      <div className="px-5 pb-2 pt-5">
        <h3 className="font-heading text-base font-semibold uppercase leading-[22px] tracking-[0.02em]">
          Version {version.version} · {STATE_WORD[version.state]}
        </h3>
        <p className="mt-1 text-xs leading-[18px] text-muted-foreground">
          {versionRange(version)} · used by {version.sessionsUsing.toLocaleString("en-US")} sessions, so it&apos;s locked
        </p>
      </div>
      <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-6 gap-y-2.5 px-5 py-4 text-[13px] leading-[19px]">
        <dt className="text-muted-foreground">Schedule</dt>
        <dd>
          <span className="font-mono">
            {rules.start}–{rules.end}
          </span>{" "}
          · {workdaysLabel(rules.workdays)}
        </dd>
        <dt className="text-muted-foreground">Break</dt>
        <dd>
          {rules.breakMinutes} min between {rules.breakWindow.start} and {rules.breakWindow.end}.{" "}
          {rules.gapCountsTowardBreak ? "A gap between sessions counts toward it." : "Gaps don't count toward it."}
        </dd>
        <dt className="text-muted-foreground">Daily cap</dt>
        <dd className="font-mono">{formatDuration(rules.capMinutes)}</dd>
        <dt className="text-muted-foreground">Rounding</dt>
        <dd>{roundingLabel(rules.rounding)}</dd>
        <dt className="text-muted-foreground">After midnight</dt>
        <dd>Held for review, no credit</dd>
      </dl>
      <div className="px-5 pb-5">
        <PolicyExample rules={rules} sessions={example} />
      </div>
    </>
  );
}

export function PoliciesView({ data, mock }: { data: PoliciesVM; mock: boolean }) {
  return (
    <>
      <PageHeader
        title="Attendance policies"
        subtitle="The rules that turn sessions into credited hours. A version locks once any attendance uses it."
      />
      <ExampleValuesBanner>These numbers are placeholders until HR confirms the office&apos;s real schedule, break and rounding rules.</ExampleValuesBanner>

      <div className="flex flex-wrap items-start gap-5">
        <Card labelledBy="versions-title" className="shrink grow basis-[280px]">
          <div className="px-5 pb-3 pt-5">
            <h3 id="versions-title" className="font-heading text-base font-semibold uppercase leading-[22px] tracking-[0.02em]">
              Versions
            </h3>
          </div>
          <nav aria-label="Policy versions">
            <ul>
              {data.versions.map((version) => {
                const current = version.version === data.selected.version;
                return (
                  <li key={version.version}>
                    <Link
                      href={`/hr/setup/policies?version=${version.version}`}
                      aria-current={current ? "page" : undefined}
                      className={cn(
                        "flex items-center justify-between gap-3 border-t border-hairline px-5 py-3 hover:bg-muted",
                        current && "bg-muted",
                      )}
                    >
                      <span className="min-w-0">
                        <span className="block text-[13px] font-semibold leading-[18px] text-foreground">Version {version.version}</span>
                        <span className="block text-xs leading-[18px] text-muted-foreground">{versionMeta(version)}</span>
                      </span>
                      <StatusMark kind={{ type: "policy", value: version.state }} audience="hr" />
                    </Link>
                  </li>
                );
              })}
            </ul>
          </nav>
          <p className="border-t border-hairline px-5 py-3 text-xs leading-[18px] text-muted-foreground">
            Each office day keeps the version it started under. Publishing never recalculates past days.
          </p>
        </Card>

        <section aria-label={`Version ${data.selected.version}`} className="min-w-0 shrink grow-[2] basis-[560px] rounded-card border border-border bg-card shadow-card">
          {data.selected.state === "DRAFT" ? (
            <PolicyEditor draft={data.selected} base={data.base} example={data.example} mock={mock} />
          ) : (
            <LockedDetails version={data.selected} example={data.example} />
          )}
        </section>
      </div>
    </>
  );
}
