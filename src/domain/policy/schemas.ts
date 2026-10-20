/**
 * Runtime validation schemas for versioned policy JSONB columns
 * (schedule_rules, break_rules, credit_rules). Shared TypeScript types are not
 * enough at trust boundaries; validate on read and write.
 */

import { z } from "zod";

export const scheduleWindowSchema = z.object({
  startMinutes: z.number().int().min(0).max(1440),
  endMinutes: z.number().int().min(0).max(1440),
});

export const scheduleRulesSchema = z
  .array(scheduleWindowSchema)
  .refine(
    (windows) => windows.every((w) => w.endMinutes > w.startMinutes),
    { message: "schedule window end must be after start" },
  );

export const breakRuleSchema = z.object({
  requiredBreakMinutes: z.number().int().nonnegative(),
  windowStartMinutes: z.number().int().min(0).max(1440),
  windowEndMinutes: z.number().int().min(0).max(1440),
});

export const breakRulesSchema = z.array(breakRuleSchema);

export const roundingModeSchema = z.enum([
  "FLOOR",
  "CEIL",
  "NEAREST_HALF_UP",
]);

export const creditRulesSchema = z.object({
  roundingMode: roundingModeSchema,
  roundingUnitMinutes: z.number().int().positive(),
  dailyCapMinutes: z.number().int().positive(),
});

export const attendancePolicySchema = z.object({
  version: z.number().int().positive(),
  scheduleRules: scheduleRulesSchema,
  breakRules: breakRulesSchema,
  creditRules: creditRulesSchema,
});

export type AttendancePolicyInput = z.infer<typeof attendancePolicySchema>;
