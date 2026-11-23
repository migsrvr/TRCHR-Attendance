/**
 * Offline Jev evaluation harness (Master Document §6, Technical Design §14).
 *
 * Evaluates anonymized HR-labeled correction cases for category accuracy,
 * completeness usefulness, and latency before enabling live Jev in pilot.
 *
 * Usage: npx tsx scripts/eval-jev.ts [path/to/labeled-cases.json]
 */

import { readFileSync } from "node:fs";

import type { CorrectionReasonCategory } from "@prisma/client";

import { buildMinimizedJevContext } from "../src/worker/context";
import { callTypeSafeJev, type JevCategory } from "../src/worker/jev-client";

interface LabeledCase {
  readonly id: string;
  readonly expectedCategory: JevCategory;
  readonly expectedComplete: boolean;
  readonly reasonCategory: CorrectionReasonCategory;
  readonly explanation: string;
  readonly hasExistingSession: boolean;
  readonly hasRecordedTimeIn: boolean;
  readonly hasRecordedTimeOut: boolean;
  readonly proposesTimeIn: boolean;
  readonly proposesTimeOut: boolean;
}

const DEFAULT_SAMPLE_CASES: readonly LabeledCase[] = [
  {
    id: "case-1",
    expectedCategory: "missed_clock_out",
    expectedComplete: true,
    reasonCategory: "MISSED_CLOCK_OUT",
    explanation: "Client walkthrough with Marketing lead ran past 6 PM and I forgot to scan OUT at the lobby.",
    hasExistingSession: true,
    hasRecordedTimeIn: true,
    hasRecordedTimeOut: false,
    proposesTimeIn: false,
    proposesTimeOut: true,
  },
  {
    id: "case-2",
    expectedCategory: "technical_issue",
    expectedComplete: true,
    reasonCategory: "TECHNICAL_ISSUE",
    explanation: "Phone GPS accuracy stayed at 80m indoors near reception; guard on duty saw me arrive at 09:00.",
    hasExistingSession: false,
    hasRecordedTimeIn: false,
    hasRecordedTimeOut: false,
    proposesTimeIn: true,
    proposesTimeOut: true,
  },
  {
    id: "case-3",
    expectedCategory: "other",
    expectedComplete: false,
    reasonCategory: "OTHER",
    explanation: "Forgot to scan.",
    hasExistingSession: false,
    hasRecordedTimeIn: false,
    hasRecordedTimeOut: false,
    proposesTimeIn: true,
    proposesTimeOut: true,
  },
];

async function main() {
  const inputPath = process.argv[2];
  const cases: readonly LabeledCase[] = inputPath
    ? (JSON.parse(readFileSync(inputPath, "utf8")) as LabeledCase[])
    : DEFAULT_SAMPLE_CASES;

  let correctCategory = 0;
  const latencies: number[] = [];

  for (const item of cases) {
    const ctx = buildMinimizedJevContext({
      requestVersion: 1,
      reasonCategory: item.reasonCategory,
      explanation: item.explanation,
      comments: [],
      facts: {
        hasExistingSession: item.hasExistingSession,
        hasRecordedTimeIn: item.hasRecordedTimeIn,
        hasRecordedTimeOut: item.hasRecordedTimeOut,
        proposesTimeIn: item.proposesTimeIn,
        proposesTimeOut: item.proposesTimeOut,
      },
    });

    const start = performance.now();
    const { result, modelVersion, stubbed } = await callTypeSafeJev(ctx);
    const elapsedMs = Math.round(performance.now() - start);
    latencies.push(elapsedMs);

    const matched = result.category === item.expectedCategory;
    if (matched) correctCategory += 1;

    console.log(
      JSON.stringify({
        id: item.id,
        modelVersion,
        stubbed,
        expectedCategory: item.expectedCategory,
        predictedCategory: result.category,
        categoryScore: result.categoryScore,
        detailsScore: result.detailsScore,
        matched,
        elapsedMs,
      }),
    );
  }

  latencies.sort((a, b) => a - b);
  const p95 = latencies[Math.min(latencies.length - 1, Math.floor(latencies.length * 0.95))] ?? 0;
  console.log(
    JSON.stringify({
      summary: {
        total: cases.length,
        categoryAccuracy: Number((correctCategory / Math.max(1, cases.length)).toFixed(3)),
        p95LatencyMs: p95,
      },
    }),
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
