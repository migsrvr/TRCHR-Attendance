/**
 * Policy explanations shown beside DTR rows, transcribed from the canvas DTR
 * preview. The calculation engine will produce these; only
 * src/lib/ui/queries/* may import this file.
 */

export const DTR_NOTES: Record<string, Record<string, string>> = {
  "ana-reyes": {
    "2026-10-02": "Capped at schedule",
    "2026-10-06": "59-min gap · 1 min break added",
    "2026-10-14": "Capped at schedule",
  },
};

export const DTR_POLICY_LABEL = "policy v2";
