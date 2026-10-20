import { formatDuration, formatShortDate } from "@/lib/ui/format";
import { hoursProgress } from "@/lib/ui/hours";

/** Credited internship hours against the requirement, with what's left and the pace needed. */
export function HoursProgress({
  creditedMinutes,
  requiredMinutes,
  endDateIso,
  workdaysLeft,
}: {
  creditedMinutes: number;
  requiredMinutes: number;
  endDateIso?: string;
  workdaysLeft?: number;
}) {
  const progress = hoursProgress({ creditedMinutes, requiredMinutes, workdaysLeft });

  return (
    <div>
      <p className="flex items-baseline gap-1.5">
        <span className="font-heading text-[32px] font-bold leading-9 tabular-nums">{formatDuration(creditedMinutes)}</span>
        <span className="text-[13px] text-muted-foreground">of {Math.round(requiredMinutes / 60)}h</span>
      </p>
      <div
        role="progressbar"
        aria-label="Internship hours credited"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        className="mt-2.5 h-2 overflow-hidden rounded-full bg-track"
      >
        <div className="h-full rounded-full bg-settled" style={{ width: `${progress.percent}%` }} />
      </div>
      <div className="mt-2 flex justify-between gap-3 text-xs leading-[18px] text-muted-foreground">
        <span>
          <span className="font-mono font-semibold text-foreground">{formatDuration(progress.remainingMinutes)}</span> left
        </span>
        {endDateIso ? <span>Ends {formatShortDate(endDateIso)}</span> : null}
      </div>
      {progress.pacePerWorkdayMinutes ? (
        <p className="mt-2.5 border-t border-hairline pt-2.5 text-[13px] leading-[19px]">
          About <span className="font-mono font-semibold">{formatDuration(progress.pacePerWorkdayMinutes)}</span> a workday
          to finish on time.
        </p>
      ) : null}
    </div>
  );
}
