import type { BlockedCopy } from "@/lib/ui/scan-copy";

/** Step lists for turning a permission back on, or for leaving an in-app browser. */
export function PermissionHelp({ copy }: { copy: Pick<BlockedCopy, "help" | "inAppSteps"> }) {
  return (
    <>
      {copy.inAppSteps ? (
        <section className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold leading-5">Open in your browser</h2>
          <ol className="mt-2.5 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5">
            {copy.inAppSteps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ) : null}
      {copy.help.map((help) => (
        <section key={help.browser} className="rounded-card border border-border bg-card p-4">
          <h2 className="text-sm font-semibold leading-5">{help.browser}</h2>
          <ol className="mt-2.5 flex list-decimal flex-col gap-1.5 pl-5 text-sm leading-5">
            {help.steps.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      ))}
    </>
  );
}
