import { CoachChat } from "@/components/coach/CoachChat";

export const dynamic = "force-dynamic";

// 페이지는 즉시 렌더 — picker 공고(저장/추천)는 CoachChat 이 클라이언트에서 비동기로 불러온다.
// (과거엔 서버에서 추천을 await 해 AI 가 느리면 페이지 진입이 최대 8s 막혔다.)
export default function CoachPage() {
  return <CoachChat />;
}
