import { Settings2 } from "lucide-react";

import { ButtonLink } from "@/components/ui/button";
import { Card, CardHeader } from "@/components/ui/card";
import { PageHeader } from "@/components/ui/page-header";
import { StatusMark } from "@/components/ui/status-mark";
import { AddCheckpointDialog } from "@/components/views/hr/add-checkpoint-dialog";
import { CheckpointActions } from "@/components/views/hr/checkpoint-actions";
import { OfficeSettingsForm } from "@/components/views/hr/office-settings-form";
import { ExampleValuesBanner, versionRange } from "@/components/views/hr/setup-shared";
import { formatDuration, formatLongDate, formatShortDate } from "@/lib/ui/format";
import { roundingLabel, workdaysLabel } from "@/lib/ui/policy";
import type { OfficeSetupVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

const TH = "border-b border-border px-3 py-2.5 text-left text-xs font-semibold leading-4 text-muted-foreground";
const TD = "border-b border-hairline px-3 py-3 align-middle text-[13px] leading-[18px]";

export function OfficeSetupView({ data, mock }: { data: OfficeSetupVM; mock: boolean }) {
  const policy = data.activePolicy;
  const rules = policy.rules;

  return (
    <>
      <PageHeader
        title="Office and QR codes"
        subtitle="Where scans count, which codes are valid, and the rules that turn sessions into credited hours."
      />
      <ExampleValuesBanner>
        Radius, accuracy and policy numbers below are placeholders until HR confirms them and they are tested at the real
        entrance on interns&apos; phones.
      </ExampleValuesBanner>

      <div className="flex flex-wrap items-stretch gap-5">
        <Card labelledBy="office-title" className="flex shrink grow basis-[420px] flex-col">
          <CardHeader
            id="office-title"
            title="Office location"
            description={`Settings version ${data.office.settingsVersion} · new scans use it, saved scans keep the rules they were checked with`}
          />
          <OfficeSettingsForm office={data.office} mock={mock} />
        </Card>

        <Card labelledBy="policy-title" className="flex shrink grow basis-[360px] flex-col">
          <CardHeader
            id="policy-title"
            title="Attendance policy"
            description={`Version ${policy.version} · effective ${formatLongDate(policy.fromIso).replace(/^\w+, /, "")} · locked once used`}
            action={
              <ButtonLink href="/hr/setup/policies" variant="outline" size="sm">
                <Settings2 aria-hidden="true" />
                Manage versions
              </ButtonLink>
            }
          />
          <dl className="grid grid-cols-[auto_minmax(0,1fr)] gap-x-4 gap-y-2 px-5 pb-4 text-[13px] leading-[18px]">
            <dt className="text-muted-foreground">Schedule</dt>
            <dd>
              <span className="font-mono">
                {rules.start}–{rules.end}
              </span>{" "}
              <span className="text-xs text-muted-foreground">{workdaysLabel(rules.workdays)}</span>
            </dd>
            <dt className="text-muted-foreground">Break</dt>
            <dd>
              {rules.breakMinutes} min, once a day.{rules.gapCountsTowardBreak ? " A gap between sessions counts toward it." : ""}
            </dd>
            <dt className="text-muted-foreground">Daily cap</dt>
            <dd className="font-mono">{formatDuration(rules.capMinutes)}</dd>
            <dt className="text-muted-foreground">Rounding</dt>
            <dd>{roundingLabel(rules.rounding)}</dd>
            <dt className="text-muted-foreground">After midnight</dt>
            <dd>Held for review, no credit</dd>
          </dl>
          <div className="mt-auto border-t border-hairline px-5 py-4">
            <p className="text-xs font-semibold leading-4 text-muted-foreground">Versions</p>
            <ul className="mt-2 flex flex-col gap-1.5">
              {data.policies.map((version) => (
                <li key={version.version} className="flex items-center justify-between gap-3 text-[13px] leading-[18px]">
                  <span>
                    Version {version.version} <span className="text-xs text-muted-foreground">· {versionRange(version)}</span>
                  </span>
                  <StatusMark kind={{ type: "policy", value: version.state }} audience="hr" />
                </li>
              ))}
            </ul>
          </div>
        </Card>
      </div>

      <Card labelledBy="qr-title">
        <CardHeader
          id="qr-title"
          title="QR checkpoints"
          description="Printed codes at the entrance. Each holds a signed checkpoint reference, never intern details."
          action={<AddCheckpointDialog officeId={data.office.id} mock={mock} />}
        />
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[720px] border-collapse">
            <thead>
              <tr>
                <th scope="col" className={cn(TH, "pl-5")}>
                  Checkpoint
                </th>
                <th scope="col" className={TH}>
                  Action
                </th>
                <th scope="col" className={TH}>
                  Code
                </th>
                <th scope="col" className={TH}>
                  Expires
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
              {data.checkpoints.map((checkpoint) => {
                const revoked = checkpoint.status.type === "checkpoint" && checkpoint.status.value === "REVOKED";
                return (
                  <tr key={checkpoint.id} data-revoked={revoked ? "true" : undefined} className={cn(revoked && "text-muted-foreground")}>
                    <td className={cn(TD, "pl-5 font-semibold")}>{checkpoint.name}</td>
                    <td className={TD}>{checkpoint.action === "IN" ? "Time in" : "Time out"}</td>
                    <td className={cn(TD, "font-mono")}>
                      {checkpoint.action} · v{checkpoint.codeVersion}
                    </td>
                    <td className={cn(TD, "font-mono text-xs")}>
                      {checkpoint.expiresIso ? formatLongDate(checkpoint.expiresIso).replace(/^\w+, /, "") : "—"}
                    </td>
                    <td className={TD}>
                      <StatusMark
                        kind={checkpoint.status}
                        audience="hr"
                        label={revoked && checkpoint.revokedIso ? `Revoked ${formatShortDate(checkpoint.revokedIso)}` : undefined}
                      />
                    </td>
                    <td className={cn(TD, "pr-5")}>
                      {revoked ? null : (
                        <CheckpointActions
                          id={checkpoint.id}
                          label={`${checkpoint.name} ${checkpoint.action}`}
                          mock={mock}
                        />
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="px-5 py-3 text-xs leading-[18px] text-muted-foreground">
          Rotating revokes every printed copy of the old code immediately. Print and post the new one before you rotate during
          office hours.
        </p>
      </Card>
    </>
  );
}
