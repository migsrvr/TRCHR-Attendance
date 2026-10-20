"use client";

import { useState } from "react";

import { periodRange, type DtrPeriod } from "@/lib/ui/dtr";
import { cn } from "@/lib/utils";

const OPTIONS: { value: DtrPeriod; label: string }[] = [
  { value: "first", label: "1st–15th" },
  { value: "second", label: "16th–end" },
  { value: "custom", label: "Custom" },
];

const INPUT = "h-9 w-full rounded-btn border border-border bg-card px-3 text-[13px] text-foreground aria-[invalid=true]:border-attn";

/**
 * Period radios drawn as a segmented control, plus From/To dates. Picking a
 * half fills its dates for the month in From; editing a date switches to
 * Custom. Works without JavaScript too: the server derives halves from From.
 */
export function PeriodFields({
  period: initialPeriod,
  from: initialFrom,
  to: initialTo,
  error,
}: {
  period: DtrPeriod;
  from: string;
  to: string;
  error: string | null;
}) {
  const [period, setPeriod] = useState(initialPeriod);
  const [from, setFrom] = useState(initialFrom);
  const [to, setTo] = useState(initialTo);

  function choose(next: DtrPeriod) {
    setPeriod(next);
    if (next !== "custom" && from) {
      const range = periodRange(next, from);
      setFrom(range.from);
      setTo(range.to);
    }
  }

  return (
    <fieldset className="flex flex-col gap-2.5">
      <legend className="mb-2 text-[13px] font-semibold leading-[18px]">Period</legend>
      <div className="flex gap-1 rounded-btn bg-muted p-1">
        {OPTIONS.map((option) => (
          <label
            key={option.value}
            className={cn(
              "flex h-[30px] flex-1 cursor-pointer items-center justify-center rounded-btnsm text-[13px] has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-ring",
              period === option.value ? "bg-card font-semibold text-foreground shadow-card" : "font-medium text-muted-foreground",
            )}
          >
            <input
              type="radio"
              name="period"
              value={option.value}
              checked={period === option.value}
              onChange={() => choose(option.value)}
              className="sr-only"
            />
            {option.label}
          </label>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          From
          <input
            type="date"
            name="from"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              setPeriod("custom");
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "dtr-range-error" : undefined}
            className={INPUT}
          />
        </label>
        <label className="flex flex-col gap-1 text-xs font-medium text-muted-foreground">
          To
          <input
            type="date"
            name="to"
            value={to}
            onChange={(event) => {
              setTo(event.target.value);
              setPeriod("custom");
            }}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? "dtr-range-error" : undefined}
            className={INPUT}
          />
        </label>
      </div>
      {error ? (
        <p id="dtr-range-error" role="alert" className="text-xs font-medium leading-[18px] text-attn">
          {error}
        </p>
      ) : null}
    </fieldset>
  );
}
