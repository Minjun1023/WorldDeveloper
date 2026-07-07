"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { TERMS, type TermsKey } from "@/lib/terms";

type Terms = {
  tos: boolean;
  privacy: boolean;
  age14: boolean;
  marketing: boolean;
};

const INITIAL: Terms = { tos: false, privacy: false, age14: false, marketing: false };

export function TermsAgreement({ onChange }: { onChange: (requiredAccepted: boolean) => void }) {
  const [terms, setTerms] = useState<Terms>(INITIAL);
  const [openDoc, setOpenDoc] = useState<TermsKey | null>(null);

  const allChecked = terms.tos && terms.privacy && terms.age14 && terms.marketing;
  const requiredAccepted = terms.tos && terms.privacy && terms.age14;

  useEffect(() => {
    onChange(requiredAccepted);
  }, [requiredAccepted, onChange]);

  const toggle = (key: keyof Terms) => setTerms((t) => ({ ...t, [key]: !t[key] }));
  const toggleAll = () => {
    const next = !allChecked;
    setTerms({ tos: next, privacy: next, age14: next, marketing: next });
  };

  return (
    <div className="space-y-2">
      <p className="text-body-sm font-medium">서비스 이용을 위해 약관에 동의해 주세요</p>
      <div className="space-y-3 rounded-lg border border-border p-4">
        <label className="flex cursor-pointer items-center gap-2 font-medium">
          <Checkbox checked={allChecked} onCheckedChange={toggleAll} />
          <span>모두 동의합니다.</span>
        </label>

        <div className="space-y-2 border-t border-border pt-3">
          <TermsRow label="(필수) 서비스 이용약관 동의" checked={terms.tos} onToggle={() => toggle("tos")} docKey="service" onView={setOpenDoc} />
          <TermsRow label="(필수) 개인정보 수집 및 이용 동의" checked={terms.privacy} onToggle={() => toggle("privacy")} docKey="privacy" onView={setOpenDoc} />
          <TermsRow label="(선택) 마케팅 정보 수신 및 프로모션 안내 동의" checked={terms.marketing} onToggle={() => toggle("marketing")} docKey="marketing" onView={setOpenDoc} />
          <TermsRow label="만 14세 이상입니다." checked={terms.age14} onToggle={() => toggle("age14")} />
        </div>
      </div>

      <Dialog open={openDoc !== null} onOpenChange={(open) => !open && setOpenDoc(null)}>
        <DialogContent className="max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{openDoc ? TERMS[openDoc].title : ""}</DialogTitle>
          </DialogHeader>
          {openDoc && (
            <div className="space-y-4">
              {TERMS[openDoc].sections.map((s) => (
                <section key={s.heading} className="space-y-1">
                  <h3 className="text-body-sm font-semibold">{s.heading}</h3>
                  <p className="whitespace-pre-line text-body-sm text-muted-foreground">{s.body}</p>
                </section>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}

function TermsRow({
  label,
  checked,
  onToggle,
  docKey,
  onView,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  docKey?: TermsKey;
  onView?: (key: TermsKey) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2 text-body-sm">
      <label className="flex cursor-pointer items-center gap-2">
        <Checkbox checked={checked} onCheckedChange={onToggle} />
        <span>{label}</span>
      </label>
      {docKey && onView && (
        <button
          type="button"
          onClick={() => onView(docKey)}
          className="shrink-0 text-caption text-muted-foreground underline"
        >
          전체보기
        </button>
      )}
    </div>
  );
}
