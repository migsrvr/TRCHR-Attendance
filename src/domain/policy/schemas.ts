/**
 * Runtime validation schemas for versioned policy JSONB columns
 * (schedule_rules, break_rules, credit_rules). Shared TypeScript types are not
 * enough at trust boundaries; validate on read and write.
 */

import { z } from "zod";

import type { AttendancePolicy, RoundingMode } from "@/domain/calculation/types";

export const scheduleWindowSchema = z
  .object({
    startMinutes: z.number().int().min(0).max(1440),
    endMinutes: z.number().int().min(0).max(1440),
  })
  .strict()
  .refine((w) => w.endMinutes > w.startMinutes, {
    message: "schedule window end must be after start",
  });

export const workdaysSchema = z
  .array(z.number().int().min(0).max(6))
  .min(1)
  .max(7)
  .refine((days) => new Set(days).size === days.length, {
    message: "workdays must be unique",
  });

export const scheduleRulesObjectSchema = z
  .object({
    workdays: workdaysSchema,
    windows: z.array(scheduleWindowSchema).min(1),
  })
  .strict();

export const scheduleRulesSchema = z.union([
  z.array(scheduleWindowSchema).min(1),
  scheduleRulesObjectSchema,
]);

export const breakRuleSchema = z
  .object({
    requiredBreakMinutes: z.number().int().min(0).max(240),
    windowStartMinutes: z.number().int().min(0).max(1440),
    windowEndMinutes: z.number().int().min(0).max(1440),
    gapCountsTowardBreak: z.boolean().optional().default(true),
  })
  .strict()
  .refine((b) => b.windowEndMinutes > b.windowStartMinutes, {
    message: "break window end must be after start",
  });

export const breakRulesSchema = z.array(breakRuleSchema);

export const roundingModeSchema = z.enum(["NONE", "FLOOR", "CEIL", "NEAREST_HALF_UP"]);

export const creditRulesSchema = z
  .object({
    roundingMode: roundingModeSchema,
    roundingUnitMinutes: z.number().int().positive().max(60),
    dailyCapMinutes: z.number().int().positive().max(1440),
  })
  .strict()
  .refine(
    (c) =>
      c.roundingMode === "NONE" || c.dailyCapMinutes % c.roundingUnitMinutes === 0,
    {
      message: "dailyCapMinutes must be divisible by roundingUnitMinutes so rounding cannot exceed the cap",
    },
  );

export const attendancePolicySchema = z.object({
  version: z.number().int().positive(),
  scheduleRules: scheduleRulesSchema,
  breakRules: breakRulesSchema,
  creditRules: creditRulesSchema,
});

export type AttendancePolicyInput = z.infer<typeof attendancePolicySchema>;

/** Parse stored Prisma JSONB columns into a normalized AttendancePolicy. */
export function parseStoredPolicy(row: {
  readonly version: number;
  readonly scheduleRules: unknown;
  readonly breakRules: unknown;
  readonly creditRules: unknown;
}): AttendancePolicy {
  const parsed = attendancePolicySchema.parse(row);
  const windows = Array.isArray(parsed.scheduleRules)
    ? parsed.scheduleRules
    : parsed.scheduleRules.windows;
  const workdays = Array.isArray(parsed.scheduleRules)
    ? [1, 2, 3, 4, 5]
    : parsed.scheduleRules.workdays;

  return {
    version: parsed.version,
    workdays,
    scheduleRules: windows,
    breakRules: parsed.breakRules,
    creditRules: parsed.creditRules,
  };
}

/** Map UI rounding presets into canonical CreditRules rounding settings. */
export function uiRoundingToCreditRounding(
  preset: "none" | "down5" | "down15" | "nearest15",
): { roundingMode: RoundingMode; roundingUnitMinutes: number } {
  switch (preset) {
    case "down5":
      return { roundingMode: "FLOOR", roundingUnitMinutes: 5 };
    case "down15":
      return { roundingMode: "FLOOR", roundingUnitMinutes: 15 };
    case "nearest15":
      return { roundingMode: "NEAREST_HALF_UP", roundingUnitMinutes: 15 };
    default:
      return { roundingMode: "NONE", roundingUnitMinutes: 1 };
  }
}

export function creditRoundingToUiRounding(
  mode: RoundingMode,
  unit: number,
): "none" | "down5" | "down15" | "nearest15" {
  if (mode === "FLOOR" && unit === 5) return "down5";
  if (mode === "FLOOR" && unit === 15) return "down15";
  if (mode === "NEAREST_HALF_UP" && unit === 15) return "nearest15";
  return "none";
}
