"use client";

import { useCallback, useEffect, useState } from "react";

import { CoachChat } from "@/components/coach/CoachChat";
import { CoachConversationRail, type ConversationSummary } from "@/components/coach/CoachConversationRail";

export function CoachShell({ loggedIn, initialJobId }: { loggedIn: boolean; initialJobId: string | null }) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId);
  // 레일 선택을 CoachChat 에 전달하기 위한 신호값(같은 jobId 재선택도 반영되게 nonce 포함).
  const [selectSignal, setSelectSignal] = useState<{ jobId: string | null; n: number }>({ jobId: initialJobId, n: 0 });

  const reload = useCallback(() => {
    if (!loggedIn) return;
    fetch("/api/me/coach/conversations")
      .then((r) => (r.ok ? r.json() : { items: [] }))
      .then((d) => setItems(Array.isArray(d?.items) ? d.items : []))
      .catch(() => setItems([]));
  }, [loggedIn]);

  useEffect(() => {
    reload();
  }, [reload]);

  const select = (jobId: string | null) => {
    setActiveJobId(jobId);
    setSelectSignal((s) => ({ jobId, n: s.n + 1 }));
  };

  const remove = (jobId: string) => {
    setItems((xs) => xs.filter((x) => x.jobId !== jobId)); // 낙관적
    fetch(`/api/me/coach/conversation?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => {});
    if (activeJobId === jobId) select(null);
  };

  return (
    <div className="flex flex-col gap-6 lg:flex-row lg:gap-8">
      {loggedIn && (
        <CoachConversationRail
          items={items}
          activeJobId={activeJobId}
          onSelect={(id) => select(id)}
          onNew={() => select(null)}
          onDelete={remove}
        />
      )}
      <div className="min-w-0 flex-1">
        <CoachChat
          loggedIn={loggedIn}
          selectSignal={selectSignal}
          onConversationSaved={reload}
          onActiveJobChange={setActiveJobId}
        />
      </div>
    </div>
  );
}
