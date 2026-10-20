import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const STEPS = 3;

/**
 * Frame for sign-in, set password and first run: no tab bar, one scrolling
 * column. The whole page scrolls (brand band included), so on short phones
 * the keyboard can push the form up instead of covering it.
 *
 * "brand": navy band that runs up under the notch / status bar.
 * "steps": light header with the first-run step and a progress bar.
 */
export function AuthFrame({
  variant,
  step,
  children,
}: {
  variant: "brand" | "steps";
  step?: 1 | 2 | 3;
  children: ReactNode;
}) {
  return (
    <div className="app-frame overflow-hidden bg-background text-foreground">
      <main id="app-main" className="flex h-full flex-col overflow-y-auto overscroll-contain">
        {variant === "brand" ? (
          <div className="relative shrink-0 overflow-hidden bg-sidebar px-safe pt-safe">
            <svg
              aria-hidden="true"
              viewBox="0 0 390 232"
              preserveAspectRatio="xMidYMid slice"
              className="absolute inset-0 size-full fill-none stroke-sidebar-accent"
            >
              <polyline points="-20,150 195,40 410,150" strokeWidth="8" />
              <polyline points="-20,174 195,64 410,174" strokeWidth="8" />
              <polyline points="-20,198 195,88 410,198" strokeWidth="8" />
            </svg>
            <div className="relative mx-auto flex min-h-[188px] max-w-md flex-col justify-end px-6 pb-7 pt-10">
              <Image src="/brand/top-realty-logo-white.png" alt="Top Realty" width={159} height={50} priority />
              <p className="mt-2.5 text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-sidebar-foreground">
                Attendance
              </p>
            </div>
          </div>
        ) : (
          <header className="shrink-0 px-safe pt-safe">
            <div className="mx-auto flex max-w-md flex-col gap-3 px-6 pt-5">
              <div className="flex items-center justify-between gap-3">
                <Image src="/brand/top-realty-logo.png" alt="Top Realty" width={115} height={36} priority />
                {step ? (
                  <span className="text-xs font-semibold leading-4 text-muted-foreground">
                    Step {step} of {STEPS}
                  </span>
                ) : null}
              </div>
              {step ? (
                <div
                  role="progressbar"
                  aria-label="Account setup progress"
                  aria-valuemin={1}
                  aria-valuemax={STEPS}
                  aria-valuenow={step}
                  className="grid grid-cols-3 gap-1.5"
                >
                  {Array.from({ length: STEPS }, (_, index) => (
                    <span key={index} className={cn("h-1 rounded-full", index < step ? "bg-primary" : "bg-border")} />
                  ))}
                </div>
              ) : null}
            </div>
          </header>
        )}
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col px-safe">{children}</div>
      </main>
    </div>
  );
}
