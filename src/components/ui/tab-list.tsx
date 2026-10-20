"use client";

import { useRef, type KeyboardEvent } from "react";

import { cn } from "@/lib/utils";

export interface TabItem<Id extends string> {
  id: Id;
  label: string;
  count?: number;
}

/**
 * Segmented WAI-ARIA tabs: the active tab is the only one in the tab order,
 * arrow keys and Home/End move between tabs. Each tab controls
 * `${idBase}-panel`, which the caller renders with `tabPanelProps`.
 */
export function TabList<Id extends string>({
  label,
  idBase,
  tabs,
  active,
  onChange,
}: {
  label: string;
  idBase: string;
  tabs: readonly TabItem<Id>[];
  active: Id;
  onChange: (id: Id) => void;
}) {
  const refs = useRef<Partial<Record<Id, HTMLButtonElement | null>>>({});

  function onKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(event.key)) return;
    event.preventDefault();
    const index = tabs.findIndex((tab) => tab.id === active);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? tabs.length - 1
          : (index + (event.key === "ArrowRight" ? 1 : -1) + tabs.length) % tabs.length;
    const id = tabs[next]!.id;
    onChange(id);
    refs.current[id]?.focus();
  }

  return (
    <div role="tablist" aria-label={label} className="inline-flex flex-wrap gap-1 rounded-btn bg-muted p-1">
      {tabs.map((tab) => (
        <button
          key={tab.id}
          ref={(node) => {
            refs.current[tab.id] = node;
          }}
          type="button"
          role="tab"
          id={`${idBase}-tab-${tab.id}`}
          aria-controls={`${idBase}-panel`}
          aria-selected={active === tab.id}
          tabIndex={active === tab.id ? 0 : -1}
          onClick={() => onChange(tab.id)}
          onKeyDown={onKeyDown}
          className={cn(
            "inline-flex h-[30px] items-center gap-1.5 rounded-btnsm px-3 text-[13px]",
            active === tab.id
              ? "bg-card font-semibold text-foreground shadow-card"
              : "font-medium text-muted-foreground hover:text-foreground",
          )}
        >
          {tab.label}
          {tab.count !== undefined ? (
            <span className="font-mono text-xs font-medium text-muted-foreground">{tab.count}</span>
          ) : null}
        </button>
      ))}
    </div>
  );
}

export function tabPanelProps(idBase: string, active: string) {
  return { role: "tabpanel", id: `${idBase}-panel`, "aria-labelledby": `${idBase}-tab-${active}` } as const;
}
