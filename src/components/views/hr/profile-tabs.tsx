"use client";

import { useState, type ReactNode } from "react";

import { TabList, tabPanelProps } from "@/components/ui/tab-list";

type ProfileTab = "attendance" | "corrections" | "assignments";

/** The profile's records card. Panels are rendered on the server and passed in. */
export function ProfileTabs({
  correctionCount,
  panels,
}: {
  correctionCount: number;
  panels: Record<ProfileTab, ReactNode>;
}) {
  const [active, setActive] = useState<ProfileTab>("attendance");

  return (
    <section aria-label="Records" className="min-w-0 shrink grow-[2] basis-[560px] overflow-hidden rounded-card border border-border bg-card shadow-card">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3">
        <TabList
          label="Profile sections"
          idBase="profile"
          active={active}
          onChange={setActive}
          tabs={[
            { id: "attendance", label: "Attendance" },
            { id: "corrections", label: "Corrections", count: correctionCount },
            { id: "assignments", label: "Assignment history" },
          ]}
        />
        {active === "attendance" ? <span className="text-xs font-medium text-muted-foreground">Last 7 days</span> : null}
      </div>
      <div {...tabPanelProps("profile", active)}>{panels[active]}</div>
    </section>
  );
}
