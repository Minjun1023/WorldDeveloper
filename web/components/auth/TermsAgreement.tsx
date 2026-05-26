"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";

type Terms = {
  tos: boolean;
  privacy: boolean;
  age14: boolean;
  marketing: boolean;
};

const INITIAL: Terms = { tos: false, privacy: false, age14: false, marketing: false };

export function TermsAgreement({ onChange }: { onChange: (requiredAccepted: boolean) => void }) {
  const [terms, setTerms] = useState<Terms>(INITIAL);

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
          <Checkbox checked={allChecked} onChange={toggleAll} />
          <span>모두 동의합니다.</span>
        </label>

        <div className="space-y-2 border-t border-border pt-3">
          <TermsRow label="(필수) 서비스 이용약관 동의" checked={terms.tos} onToggle={() => toggle("tos")} withLink />
          <TermsRow label="(필수) 개인정보 수집 및 이용 동의" checked={terms.privacy} onToggle={() => toggle("privacy")} withLink />
          <TermsRow label="(선택) 마케팅 정보 수신 및 프로모션 안내 동의" checked={terms.marketing} onToggle={() => toggle("marketing")} withLink />
          <TermsRow label="만 14세 이상입니다." checked={terms.age14} onToggle={() => toggle("age14")} />
        </div>
      </div>
    </div>
  );
}

function TermsRow({
  label,
  checked,
  onToggle,
  withLink = false,
}: {
  label: string;
  checked: boolean;
  onToggle: () => void;
  withLink?: boolean;
}) {
  const [open, setOpen] = useState(false);
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2 text-body-sm">
        <label className="flex cursor-pointer items-center gap-2">
          <Checkbox checked={checked} onChange={onToggle} />
          <span>{label}</span>
        </label>
        {withLink && (
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-expanded={open}
            className="shrink-0 text-caption text-muted-foreground underline"
          >
            전체보기
          </button>
        )}
      </div>
      {open && (
        <p className="pl-6 text-caption text-muted-foreground">
          약관 전문은 준비 중이에요. 정식 오픈 시 제공됩니다.
        </p>
      )}
    </div>
  );
}
