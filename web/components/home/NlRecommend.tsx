"use client";

import { useEffect, useState } from "react";

import { RecommendationCard } from "@/components/recommend/RecommendationCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { RecommendResponse } from "@/lib/types";

const STORAGE_KEY = "nl-recommend-last";
const EXAMPLE = "3년차 백엔드, Go·Python, 베를린 선호, 비자 스폰서 필요";

export function NlRecommend() {
  const [text, setText] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<RecommendResponse | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) setText(saved);
  }, []);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = text.trim();
    if (!q) return;
    setLoading(true);
    setError(null);
    localStorage.setItem(STORAGE_KEY, q);
    try {
      const res = await fetch("/api/recommend-nl", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: q, top_k: 6 }),
      });
      if (res.status === 429) {
        setError("요청이 많습니다. 잠시 후 다시 시도해주세요.");
        return;
      }
      if (!res.ok) {
        setError("추천을 불러오지 못했습니다.");
        return;
      }
      setResult((await res.json()) as RecommendResponse);
    } catch {
      setError("네트워크 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5">
      <form onSubmit={submit} className="flex gap-2">
        <Input
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={EXAMPLE}
          maxLength={200}
          aria-label="자연어 프로필"
        />
        <Button type="submit" disabled={loading}>
          {loading ? "분석 중..." : "추천 받기"}
        </Button>
      </form>
      <p className="mt-2 text-caption text-muted-foreground">
        한 문장으로 적으면 AI가 프로필로 변환해 6차원 점수로 추천합니다.
      </p>

      {error && <p className="mt-4 text-body-sm text-destructive">{error}</p>}

      {result && result.recommendations.length === 0 && (
        <p className="mt-4 text-body-sm text-muted-foreground">
          조건에 맞는 추천이 없습니다. 문장을 더 구체적으로 적어보세요.
        </p>
      )}

      {result && result.recommendations.length > 0 && (
        <div className="mt-4 grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {result.recommendations.map((item, i) => (
            <RecommendationCard key={item.job.id} item={item} rank={i + 1} />
          ))}
        </div>
      )}
    </div>
  );
}
