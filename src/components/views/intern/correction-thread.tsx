"use client";

import { ArrowUp } from "lucide-react";
import { useState, type FormEvent } from "react";

import { createHttpCorrectionsApi, createMockCorrectionsApi } from "@/lib/corrections/api";
import type { CorrectionMessageVM } from "@/lib/ui/view-models";
import { cn } from "@/lib/utils";

/** Conversation between the intern and HR, with a reply box while the request is open. */
export function CorrectionThread({
  correctionId,
  messages,
  canReply,
  mock,
  emphasize = false,
}: {
  correctionId: string;
  messages: CorrectionMessageVM[];
  canReply: boolean;
  mock: boolean;
  /** HR asked for more information: draw attention to the reply box. */
  emphasize?: boolean;
}) {
  const [api] = useState(() => (mock ? createMockCorrectionsApi() : createHttpCorrectionsApi()));
  const [items, setItems] = useState(messages);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (sending) return;
    const body = draft.trim();
    if (!body) {
      setError("Write a message first.");
      return;
    }
    setSending(true);
    setError(null);
    const result = await api.reply(correctionId, body);
    setSending(false);
    if (result.ok) {
      setItems((current) => [...current, { id: result.value.id, author: "intern", name: "You", atLabel: "Just now", body }]);
      setDraft("");
    } else {
      setError(result.message);
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-xs font-semibold uppercase leading-4 tracking-[0.08em] text-muted-foreground">Conversation</h2>
      <ol className="flex flex-col gap-3">
        {items.map((message) => {
          const mine = message.author === "intern";
          return (
            <li
              key={message.id}
              className={cn(
                "max-w-[86%] px-3 py-2.5",
                mine
                  ? "self-end rounded-[14px_14px_4px_14px] bg-pend-bg"
                  : "self-start rounded-[14px_14px_14px_4px] border border-border bg-card",
              )}
            >
              {message.label ? <p className="mb-0.5 text-xs font-semibold leading-4 text-pend">{message.label}</p> : null}
              <p className="whitespace-pre-line text-sm leading-5">{message.body}</p>
              <p className={cn("mt-1 text-[11px] leading-[14px] text-muted-foreground", mine && "text-right")}>
                {message.name} · {message.atLabel}
              </p>
            </li>
          );
        })}
      </ol>

      {canReply ? (
        <form onSubmit={send} className="flex flex-col gap-1.5">
          <label htmlFor="reply" className="sr-only">
            Add details for HR
          </label>
          <div className="flex items-end gap-2">
            <textarea
              id="reply"
              rows={2}
              value={draft}
              onChange={(event) => {
                setDraft(event.target.value);
                setError(null);
              }}
              placeholder="Add details for HR"
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? "reply-error" : undefined}
              className={cn(
                "phone-field min-h-12 flex-1 resize-none rounded-btn border bg-card px-3.5 py-2.5 leading-[22px] text-foreground",
                emphasize ? "border-2 border-attn" : "border-border",
              )}
            />
            <button
              type="submit"
              aria-label="Send reply"
              aria-busy={sending}
              className="flex size-12 shrink-0 items-center justify-center rounded-btn bg-primary text-primary-foreground active:bg-primary/85"
            >
              <ArrowUp aria-hidden="true" className="size-5" />
            </button>
          </div>
          {error ? (
            <p id="reply-error" role="alert" className="text-xs font-medium leading-[18px] text-attn">
              {error}
            </p>
          ) : null}
        </form>
      ) : null}
    </section>
  );
}
