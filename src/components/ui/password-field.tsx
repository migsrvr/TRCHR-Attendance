"use client";

import { Eye, EyeOff } from "lucide-react";
import { useState } from "react";

import { cn } from "@/lib/utils";

/** Password input with a show/hide toggle; 16px text so iPhones don't zoom in. */
export function PasswordField({
  id,
  value,
  onChange,
  autoComplete,
  invalid,
  describedBy,
}: {
  id: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  invalid?: boolean;
  describedBy?: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <div
      className={cn(
        "flex h-12 items-center rounded-btn border bg-card focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-ring",
        invalid ? "border-attn" : "border-border",
      )}
    >
      <input
        id={id}
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        autoComplete={autoComplete}
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={describedBy}
        className="phone-field h-full min-w-0 flex-1 rounded-btn bg-transparent px-3.5 text-foreground outline-none"
      />
      <button
        type="button"
        onClick={() => setVisible((current) => !current)}
        aria-label={visible ? "Hide password" : "Show password"}
        aria-pressed={visible}
        aria-controls={id}
        className="flex size-12 shrink-0 items-center justify-center rounded-btn text-muted-foreground active:bg-muted"
      >
        {visible ? <EyeOff aria-hidden="true" className="size-5" /> : <Eye aria-hidden="true" className="size-5" />}
      </button>
    </div>
  );
}
