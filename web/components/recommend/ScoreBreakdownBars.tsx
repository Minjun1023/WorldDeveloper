"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, XAxis, YAxis } from "recharts";

import type { ScoreBreakdown } from "@/lib/types";

const DIMS: { key: keyof ScoreBreakdown; label: string; color: string }[] = [
  { key: "stack", label: "스택", color: "var(--score-stack)" },
  { key: "visa", label: "비자", color: "var(--score-visa)" },
  { key: "location", label: "지역", color: "var(--score-location)" },
  { key: "seniority", label: "레벨", color: "var(--score-seniority)" },
  { key: "salary", label: "연봉", color: "var(--score-salary)" },
  { key: "semantic", label: "의미", color: "var(--score-semantic)" },
];

export function ScoreBreakdownBars({ score }: { score: ScoreBreakdown }) {
  const data = DIMS.map((d) => ({
    label: d.label,
    value: Math.round((score[d.key] as number) * 100),
    color: d.color,
  }));

  return (
    <ResponsiveContainer width="100%" height={140}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
        <XAxis type="number" domain={[0, 100]} hide />
        <YAxis
          type="category"
          dataKey="label"
          width={32}
          tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
          axisLine={false}
          tickLine={false}
        />
        <Bar dataKey="value" radius={[0, 3, 3, 0]} label={{ position: "right", fontSize: 11, fill: "var(--muted-foreground)" }}>
          {data.map((d) => (
            <Cell key={d.label} fill={d.color} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
