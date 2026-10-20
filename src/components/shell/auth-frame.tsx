import Image from "next/image";
import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

const STEPS = 3;

const SIGN_IN_PANEL = {
  title: "Scans, hours and corrections in one place",
  body: "Interns scan the office QR codes. You review the exceptions and export the DTR.",
};

/**
 * Frame for sign-in, set password and first run: no tab bar, one scrolling
 * column. The whole page scrolls (brand band included), so on short phones
 * the keyboard can push the form up instead of covering it.
 *
 * "brand": on phones, a navy band that runs up under the notch / status bar;
 *   from 768px, a navy panel beside the form (HR's desktop sign-in).
 * "steps": light header with the first-run step and a progress bar.
 */
export function AuthFrame({
  variant,
  step,
  panel = SIGN_IN_PANEL,
  children,
}: {
  variant: "brand" | "steps";
  step?: 1 | 2 | 3;
  /** Copy for the desktop brand panel. */
  panel?: { title: string; body: string };
  children: ReactNode;
}) {
  const brand = variant === "brand";

  return (
    <div className="app-frame overflow-hidden bg-background text-foreground">
      <main
        id="app-main"
        className={cn("flex h-full flex-col overflow-y-auto overscroll-contain", brand && "md:flex-row")}
      >
        {brand ? (
          <>
            <div className="relative shrink-0 overflow-hidden bg-sidebar px-safe pt-safe md:hidden">
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

            <section className="relative hidden min-h-full flex-1 basis-1/2 flex-col justify-between gap-12 overflow-hidden bg-sidebar p-12 text-sidebar-foreground md:flex">
              <Image src="/brand/top-realty-logo-white.png" alt="Top Realty" width={200} height={63} />
              <div className="relative max-w-[440px]">
                <p className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-sidebar-foreground/80">
                  HR Attendance
                </p>
                <p className="mt-3 font-heading text-[44px] font-bold uppercase leading-[50px] tracking-[0.01em] text-white">
                  {panel.title}
                </p>
                <p className="mt-4 text-base leading-[25px]">{panel.body}</p>
              </div>
              <svg
                aria-hidden="true"
                viewBox="0 0 560 160"
                preserveAspectRatio="xMidYMax slice"
                className="absolute inset-x-0 bottom-0 h-40 w-full fill-none stroke-sidebar-accent"
              >
                <polyline points="-20,160 280,40 580,160" strokeWidth="10" />
                <polyline points="-20,190 280,70 580,190" strokeWidth="10" />
                <polyline points="-20,220 280,100 580,220" strokeWidth="10" />
              </svg>
              <p className="relative text-xs leading-4 text-sidebar-foreground/80">Top Realty office · Asia/Manila</p>
            </section>
          </>
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
        <div
          className={cn(
            "mx-auto flex w-full max-w-md flex-1 flex-col px-safe",
            brand && "md:mx-0 md:max-w-none md:basis-1/2 md:items-center md:justify-center md:py-12",
          )}
        >
          <div className={cn("flex flex-1 flex-col", brand && "md:w-full md:max-w-[448px] md:flex-none")}>{children}</div>
        </div>
      </main>
    </div>
  );
}
