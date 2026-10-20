import Link from "next/link";
import type { ButtonHTMLAttributes, ComponentProps } from "react";

import { cn } from "@/lib/utils";

type Variant = "primary" | "secondary" | "accent" | "outline" | "ghost";
type Size = "sm" | "md" | "lg";

const BASE =
  "inline-flex select-none items-center justify-center gap-2 whitespace-nowrap font-medium transition-colors disabled:pointer-events-none disabled:opacity-50 [&_svg]:size-4 [&_svg]:shrink-0";

const SIZES: Record<Size, string> = {
  sm: "h-8 rounded-btnsm px-3 text-xs",
  md: "h-9 rounded-btn px-4 text-sm",
  // Phone primary actions: 48px tall, comfortably above the 44px touch minimum.
  lg: "h-12 rounded-btn px-5 text-[15px] font-semibold [&_svg]:size-[18px]",
};

const VARIANTS: Record<Variant, string> = {
  primary: "bg-primary text-primary-foreground shadow-card hover:bg-primary/90 active:bg-primary/85",
  secondary: "bg-secondary text-secondary-foreground shadow-card hover:bg-secondary/90 active:bg-secondary/85",
  accent: "bg-accent font-semibold text-accent-foreground shadow-card hover:bg-accent/90 active:bg-accent/85",
  outline: "border border-border bg-card text-foreground shadow-card hover:bg-muted active:bg-muted",
  ghost: "text-foreground hover:bg-muted active:bg-muted",
};

interface StyleProps {
  variant?: Variant;
  size?: Size;
}

export function buttonClasses({ variant = "primary", size = "md" }: StyleProps = {}, className?: string) {
  return cn(BASE, SIZES[size], VARIANTS[variant], className);
}

export function Button({
  variant,
  size,
  className,
  type = "button",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & StyleProps) {
  return <button type={type} className={buttonClasses({ variant, size }, className)} {...props} />;
}

export function ButtonLink({ variant, size, className, ...props }: ComponentProps<typeof Link> & StyleProps) {
  return <Link className={buttonClasses({ variant, size }, className)} {...props} />;
}
