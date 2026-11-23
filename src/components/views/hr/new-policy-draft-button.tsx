"use client";

import { Plus } from "lucide-react";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { createHttpSetupApi, createMockSetupApi } from "@/lib/setup/api";

/** Creates a new editable draft copied from the latest published policy version. */
export function NewPolicyDraftButton({
  fromVersion,
  mock,
}: {
  fromVersion: number;
  mock: boolean;
}) {
  const [api] = useState(() => (mock ? createMockSetupApi() : createHttpSetupApi()));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleCreate() {
    if (busy) return;
    setBusy(true);
    setError(null);
    const result = await api.createPolicyDraft("default", fromVersion);
    setBusy(false);
    if (result.ok) {
      window.location.assign(`/hr/setup/policies?version=${result.value.version}`);
    } else {
      setError(result.message);
    }
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button variant="outline" size="sm" onClick={handleCreate} aria-busy={busy}>
        <Plus aria-hidden="true" />
        {busy ? "Creating draft…" : `New draft from v${fromVersion}`}
      </Button>
      {error ? (
        <p role="alert" className="text-xs text-attn">
          {error}
        </p>
      ) : null}
    </div>
  );
}
