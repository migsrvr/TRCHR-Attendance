import { RefreshCw } from "lucide-react";

import { Button, ButtonLink } from "@/components/ui/button";
import { BlockedNotice } from "@/components/views/shared/blocked-notice";
import { PermissionHelp } from "@/components/views/shared/permission-help";
import type { BlockedCopy } from "@/lib/ui/scan-copy";

/** Camera or location can't be used. Shows the steps for the intern's phone. */
export function ScanBlockedView({ copy, onRetry }: { copy: BlockedCopy; onRetry: () => void }) {
  return (
    <div className="flex min-h-full flex-col gap-3.5 p-4 pb-safe-or-4">
      <BlockedNotice copy={copy} />

      <PermissionHelp copy={copy} />

      <div className="mt-auto flex flex-col gap-2 pt-2">
        <Button size="lg" className="w-full" onClick={onRetry}>
          <RefreshCw aria-hidden="true" />
          {copy.primary}
        </Button>
        <ButtonLink size="lg" variant="outline" className="w-full font-medium" href="/corrections/new">
          Request a correction instead
        </ButtonLink>
      </div>
    </div>
  );
}
