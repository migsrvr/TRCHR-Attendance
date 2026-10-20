import { Check } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";

/**
 * Layout for a first-run permission screen: content at the top, actions at
 * the bottom. On short phones the actions follow the content and scroll.
 */
export function FirstRunStep({ children, actions }: { children: ReactNode; actions: ReactNode }) {
  return (
    <div className="flex flex-1 flex-col gap-5 px-6 pb-safe-or-4 pt-6">
      {children}
      <div className="mt-auto flex flex-col gap-2 pt-1">{actions}</div>
    </div>
  );
}

export function FirstRunHeading({ title, body }: { title: string; body: string }) {
  return (
    <div>
      <h1 className="font-heading text-[26px] font-bold uppercase leading-8 tracking-[0.01em]">{title}</h1>
      <p className="mt-1.5 text-[15px] leading-[23px]">{body}</p>
    </div>
  );
}

/** What the permission will and won't be used for, said before the phone asks. */
export function PromiseList({ items }: { items: string[] }) {
  return (
    <ul className="flex flex-col gap-3 rounded-card border border-border bg-card p-4">
      {items.map((item) => (
        <li key={item} data-promise className="grid grid-cols-[20px_minmax(0,1fr)] gap-3 text-sm leading-5">
          <Check aria-hidden="true" className="mt-px size-[18px] text-accent" strokeWidth={2.25} />
          {item}
        </li>
      ))}
    </ul>
  );
}

/**
 * The 160px circle at the top of each permission screen. `needs` is the
 * screen's full height with the circle (measured at 375px wide, plus a
 * margin); below that the circle is left out so the buttons stay in view.
 */
export function FirstRunHero({ needs, children }: { needs: number; children: ReactNode }) {
  return (
    <div
      aria-hidden="true"
      className="first-run-hero flex shrink-0 items-end justify-center"
      style={{ "--hero-needs": `${needs}px` } as CSSProperties}
    >
      {children}
    </div>
  );
}
