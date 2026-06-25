"use client";

import { useCallback, useEffect, useState } from "react";

import { CoachChat } from "@/components/coach/CoachChat";
import { CoachConversationRail, CoachRailReopen, type ConversationSummary } from "@/components/coach/CoachConversationRail";

const RAIL_KEY = "coach.railOpen";

export function CoachShell({ loggedIn, initialJobId }: { loggedIn: boolean; initialJobId: string | null }) {
  const [items, setItems] = useState<ConversationSummary[]>([]);
  const [activeJobId, setActiveJobId] = useState<string | null>(initialJobId);
  const [selectSignal, setSelectSignal] = useState<{ jobId: string | null; n: number }>({ jobId: initialJobId, n: 0 });
  const [railOpen, setRailOpen] = useState(true);

  useEffect(() => {
    try {
      if (localStorage.getItem(RAIL_KEY) === "0") setRailOpen(false);
    } catch {
      /* 무시 → 기본 열림 */
    }
  }, []);
  const setRail = useCallback((open: boolean) => {
    setRailOpen(open);
    try {
      localStorage.setItem(RAIL_KEY, open ? "1" : "0");
    } catch {
      /* 무시 */
    }
  }, []);

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
    setItems((xs) => xs.filter((x) => x.job_id !== jobId));
    fetch(`/api/me/coach/conversation?jobId=${encodeURIComponent(jobId)}`, { method: "DELETE" }).catch(() => {});
    if (activeJobId === jobId) select(null);
  };

  return (
    <div className="flex h-[calc(100dvh-61px)] overflow-hidden">
      {loggedIn && railOpen && (
        <CoachConversationRail
          items={items}
          activeJobId={activeJobId}
          onSelect={(id) => select(id)}
          onNew={() => select(null)}
          onDelete={remove}
          onCollapse={() => setRail(false)}
        />
      )}
      <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {loggedIn && !railOpen && <CoachRailReopen onExpand={() => setRail(true)} />}
        <CoachChat
          loggedIn={loggedIn}
          selectSignal={selectSignal}
          onConversationSaved={reload}
          onActiveJobChange={setActiveJobId}
        />
      </main>
    </div>
  );
}
