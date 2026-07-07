"use client";

import { Check, Upload, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CoachResumeModal({
  open,
  initialText,
  initialFileName,
  onCommit,
  onClose,
}: {
  open: boolean;
  initialText: string;
  initialFileName: string | null;
  onCommit: (text: string, fileName: string | null) => void;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const [tab, setTab] = useState<"file" | "paste">("file");
  const [text, setText] = useState(initialText);
  const [fileName, setFileName] = useState<string | null>(initialFileName);
  const [extracting, setExtracting] = useState(false);
  const [extractError, setExtractError] = useState<string | null>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) {
      setText(initialText);
      setFileName(initialFileName);
      setTab("file");
      setExtractError(null);
      el.showModal();
    } else if (!open && el.open) {
      el.close();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  async function readFile(file: File | undefined) {
    if (!file) return;
    setExtractError(null);
    const isPdf = file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf");
    if (isPdf) {
      setExtracting(true);
      try {
        const fd = new FormData();
        fd.append("file", file);
        const res = await fetch("/api/me/coach/resume-extract", { method: "POST", body: fd });
        const data = (await res.json().catch(() => ({}))) as { text?: string; error?: string };
        if (res.ok && data.text) {
          setText(data.text);
          setFileName(file.name);
        } else {
          setExtractError(data.error ?? "PDF를 읽지 못했어요.");
        }
      } catch {
        setExtractError("PDF 업로드에 실패했어요.");
      } finally {
        setExtracting(false);
      }
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      setText(typeof reader.result === "string" ? reader.result : "");
      setFileName(file.name);
    };
    reader.readAsText(file);
  }

  return (
    <dialog
      ref={ref}
      aria-labelledby={titleId}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className="m-auto w-[min(92vw,34rem)] rounded-2xl border border-border bg-surface p-0 text-foreground shadow-lg backdrop:bg-black/40"
    >
      <div className="flex items-center justify-between border-b border-border p-5">
        <h2 id={titleId} className="text-h3 font-semibold">
          이력서 첨부 <span className="text-caption font-normal text-muted-foreground">· 저장되지 않아요</span>
        </h2>
        <button type="button" onClick={onClose} aria-label="닫기" className="text-muted-foreground hover:text-foreground">
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="space-y-3 p-5">
        <div className="flex gap-1 rounded-lg bg-surface-2 p-1">
          {([
            { key: "file", label: "파일 업로드" },
            { key: "paste", label: "직접 붙여넣기" },
          ] as const).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={cn(
                "flex-1 rounded-md px-3 py-2 text-body-sm font-medium transition-colors",
                tab === t.key ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground",
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === "paste" ? (
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              setFileName(null);
            }}
            rows={8}
            placeholder="이력서 전문을 붙여넣으세요"
            className="w-full resize-y rounded-lg border border-input bg-background px-3 py-2 text-body-sm leading-relaxed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        ) : (
          <label
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              readFile(e.dataTransfer.files?.[0]);
            }}
            className="flex cursor-pointer flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border bg-background px-4 py-10 text-center transition-colors hover:border-primary/40"
          >
            <Upload className="h-6 w-6 text-muted-foreground" aria-hidden="true" />
            <span className="text-body-sm font-semibold text-foreground">파일을 드래그하거나 클릭해서 선택</span>
            <span className="text-caption text-muted-foreground">.pdf .txt .md 지원</span>
            <span className="mt-1 inline-flex rounded-lg border border-border px-4 py-2 text-caption font-medium text-foreground">파일 선택</span>
            {fileName && (
              <span className="mt-1 inline-flex items-center gap-1.5 text-caption text-primary">
                <Check className="h-3.5 w-3.5" aria-hidden="true" />
                {fileName}
              </span>
            )}
            <span className={cn("mt-1 text-caption", extractError ? "text-destructive" : "text-muted-foreground")}>
              {extracting ? "PDF에서 텍스트 추출 중…" : extractError ? extractError : "PDF는 텍스트만 추출돼요(스캔/이미지 PDF 제외)."}
            </span>
            <input
              type="file"
              aria-label="이력서 파일 업로드"
              accept=".pdf,application/pdf,.txt,.md,.markdown,.text,text/plain"
              className="sr-only"
              onChange={(e) => {
                readFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
          </label>
        )}
      </div>

      <div className="flex justify-end gap-2 border-t border-border p-5">
        <Button type="button" variant="outline" onClick={onClose}>
          취소
        </Button>
        <Button
          type="button"
         
          onClick={() => {
            onCommit(text, fileName);
            onClose();
          }}
          disabled={text.trim().length === 0}
        >
          첨부
        </Button>
      </div>
    </dialog>
  );
}
