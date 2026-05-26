# 약관 전체보기 모달 구현 계획

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 회원가입 약관 항목의 `전체보기` 클릭 시 해당 약관 전문을 모달(팝업)로 표시한다. 약관 본문은 베타용 샘플 표준 문구.

**Architecture:** 프론트 전용. 신규 `Dialog`(네이티브 `<dialog>` 접근성 모달) + `lib/terms.ts`(약관 3종 콘텐츠) + `TermsAgreement` 개편(전체보기→모달, 인라인 disclosure 제거). 동의/게이팅 로직 무변경.

**Tech Stack:** Next.js/TS, Tailwind(토큰 surface/border/primary/muted-foreground, text-h3/body-sm/caption), lucide-react(X). 검증: typecheck/build + 라이브.

**관련 설계:** `docs/superpowers/specs/2026-05-26-terms-fullview-modal-design.md`. 작업 공간: 격리 워크트리 `worktree-terms-fullview-modal`.

---

## 파일 구조

```
web/lib/terms.ts                         (신규) 약관 3종 콘텐츠 + 타입
web/components/ui/dialog.tsx             (신규) 네이티브 dialog 접근성 모달
web/components/auth/TermsAgreement.tsx   (수정) 전체보기 → 모달
```

---

## Task 1: 약관 콘텐츠 (`web/lib/terms.ts`)

**Files:**
- Create: `web/lib/terms.ts`

- [ ] **Step 1: 작성**

```ts
export type TermsKey = "service" | "privacy" | "marketing";

export type TermsDoc = {
  title: string;
  sections: { heading: string; body: string }[];
};

// 베타용 샘플 표준 문구. 정식 출시 시 법무 검토 후 교체.
export const TERMS: Record<TermsKey, TermsDoc> = {
  service: {
    title: "서비스 이용약관",
    sections: [
      {
        heading: "제1조 (목적)",
        body: "본 약관은 WorldDeveloper(이하 \"회사\")가 제공하는 채용·커리어 관련 서비스(이하 \"서비스\")의 이용과 관련하여 회사와 회원 간의 권리, 의무 및 책임사항을 규정함을 목적으로 합니다.",
      },
      {
        heading: "제2조 (이용계약의 성립)",
        body: "이용계약은 회원이 본 약관에 동의하고 회사가 정한 절차에 따라 가입을 신청한 후, 회사가 이를 승낙함으로써 성립합니다. 회사는 이메일 인증 등 본인 확인 절차를 요구할 수 있습니다.",
      },
      {
        heading: "제3조 (서비스의 제공 및 변경)",
        body: "회사는 채용공고 검색, 맞춤 추천, 지원 관리 등의 서비스를 제공합니다. 회사는 운영상·기술상의 필요에 따라 제공하는 서비스의 전부 또는 일부를 변경할 수 있으며, 변경 시 사전에 공지합니다.",
      },
      {
        heading: "제4조 (회원의 의무)",
        body: "회원은 타인의 정보를 도용하거나 허위 정보를 등록해서는 안 되며, 관련 법령과 본 약관을 준수하여야 합니다. 계정 및 비밀번호 관리 책임은 회원에게 있습니다.",
      },
      {
        heading: "제5조 (계약 해지)",
        body: "회원은 언제든지 서비스 내 메뉴 또는 고객센터를 통해 이용계약 해지(회원 탈퇴)를 요청할 수 있으며, 회사는 관련 법령이 정한 바에 따라 이를 처리합니다.",
      },
      {
        heading: "부칙 (베타 안내)",
        body: "본 서비스는 베타 단계로 개인적 용도로 제공됩니다. 본 약관은 샘플 문구이며 정식 출시 시 변경될 수 있습니다.",
      },
    ],
  },
  privacy: {
    title: "개인정보 수집 및 이용 동의",
    sections: [
      {
        heading: "1. 수집하는 개인정보 항목",
        body: "필수: 이메일 주소, 비밀번호(암호화 저장), 표시 이름(닉네임).\n서비스 이용 과정에서 접속 로그, 기기·브라우저 정보가 자동으로 생성·수집될 수 있습니다.",
      },
      {
        heading: "2. 수집 및 이용 목적",
        body: "회원 식별 및 가입 의사 확인, 이메일 인증, 서비스 제공 및 맞춤 공고 추천, 공지사항 전달 및 문의 응대.",
      },
      {
        heading: "3. 보유 및 이용 기간",
        body: "회원 탈퇴 시 수집된 개인정보를 지체 없이 파기합니다. 다만 관련 법령에 따라 보존이 필요한 경우 해당 법령이 정한 기간 동안 보관합니다.",
      },
      {
        heading: "4. 동의 거부 권리 및 불이익",
        body: "귀하는 개인정보 수집·이용 동의를 거부할 권리가 있습니다. 다만 필수 항목에 동의하지 않을 경우 회원가입 및 서비스 이용이 제한됩니다.",
      },
      {
        heading: "부칙 (베타 안내)",
        body: "본 동의 내용은 베타 운영 기준의 샘플 문구이며, 정식 출시 시 개인정보 처리방침으로 보완·변경될 수 있습니다.",
      },
    ],
  },
  marketing: {
    title: "마케팅 정보 수신 동의 (선택)",
    sections: [
      {
        heading: "1. 수신 목적",
        body: "신규 기능, 이벤트, 채용 추천, 프로모션 등 회원에게 유익한 정보를 안내하기 위함입니다.",
      },
      {
        heading: "2. 수신 방법",
        body: "회원이 제공한 이메일 등 연락 수단을 통해 발송됩니다.",
      },
      {
        heading: "3. 선택 동의 안내",
        body: "본 동의는 선택 사항입니다. 동의하지 않아도 회원가입 및 서비스 이용에는 아무런 제한이 없습니다.",
      },
      {
        heading: "4. 동의 철회",
        body: "마케팅 수신 동의는 언제든지 서비스 설정 또는 수신 메일의 수신 거부 링크를 통해 철회할 수 있습니다.",
      },
    ],
  },
};
```

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음

```bash
git add web/lib/terms.ts
git commit -m "feat(web-auth): 약관 콘텐츠 모듈 (서비스/개인정보/마케팅 샘플)"
```

---

## Task 2: Dialog 모달 컴포넌트 (`web/components/ui/dialog.tsx`)

**Files:**
- Create: `web/components/ui/dialog.tsx`

- [ ] **Step 1: 작성**

```tsx
"use client";

import { X } from "lucide-react";
import { useEffect, useRef } from "react";

import { cn } from "@/lib/utils";

export function Dialog({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (open && !el.open) el.showModal();
    else if (!open && el.open) el.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => {
        if (e.target === ref.current) onClose();
      }}
      className={cn(
        "m-auto w-[min(92vw,32rem)] rounded-lg border border-border bg-surface p-0 text-foreground shadow-lg",
        "backdrop:bg-black/40",
      )}
    >
      <div className="flex items-center justify-between border-b border-border p-4">
        <h2 className="text-h3 font-semibold">{title}</h2>
        <button
          type="button"
          onClick={onClose}
          aria-label="닫기"
          className="text-muted-foreground hover:text-foreground"
        >
          <X className="h-5 w-5" />
        </button>
      </div>
      <div className="max-h-[60vh] overflow-y-auto p-4">{children}</div>
      <div className="flex justify-end border-t border-border p-4">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md bg-primary px-4 py-2 text-body-sm font-medium text-primary-foreground hover:opacity-90"
        >
          닫기
        </button>
      </div>
    </dialog>
  );
}
```

참고: 네이티브 `<dialog>`의 `close` 이벤트(`onClose`)는 Esc 포함 모든 닫힘에서 발생 → 상태 동기화. 버튼/백드롭도 `onClose` 호출 → effect가 `el.close()`(중복 무해). 모달 표시 중 배경은 네이티브가 inert 처리.

- [ ] **Step 2: 타입체크 + 커밋**

Run: `cd web && npm run typecheck`
Expected: 에러 없음 (lucide X 존재, HTMLDialogElement 타입 OK)

```bash
git add web/components/ui/dialog.tsx
git commit -m "feat(web-ui): Dialog 접근성 모달 (네이티브 dialog)"
```

---

## Task 3: TermsAgreement — 전체보기 → 모달

**Files:**
- Modify: `web/components/auth/TermsAgreement.tsx`

- [ ] **Step 1: 전체 교체**

```tsx
"use client";

import { useEffect, useState } from "react";

import { Checkbox } from "@/components/ui/checkbox";
import { Dialog } from "@/components/ui/dialog";
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
          <Checkbox checked={allChecked} onChange={toggleAll} />
          <span>모두 동의합니다.</span>
        </label>

        <div className="space-y-2 border-t border-border pt-3">
          <TermsRow label="(필수) 서비스 이용약관 동의" checked={terms.tos} onToggle={() => toggle("tos")} docKey="service" onView={setOpenDoc} />
          <TermsRow label="(필수) 개인정보 수집 및 이용 동의" checked={terms.privacy} onToggle={() => toggle("privacy")} docKey="privacy" onView={setOpenDoc} />
          <TermsRow label="(선택) 마케팅 정보 수신 및 프로모션 안내 동의" checked={terms.marketing} onToggle={() => toggle("marketing")} docKey="marketing" onView={setOpenDoc} />
          <TermsRow label="만 14세 이상입니다." checked={terms.age14} onToggle={() => toggle("age14")} />
        </div>
      </div>

      <Dialog
        open={openDoc !== null}
        onClose={() => setOpenDoc(null)}
        title={openDoc ? TERMS[openDoc].title : ""}
      >
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
        <Checkbox checked={checked} onChange={onToggle} />
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
```

- [ ] **Step 2: 타입체크 + 빌드 + 커밋**

Run: `cd web && npm run typecheck && npm run build`
Expected: 성공, `/signup` 빌드

```bash
git add web/components/auth/TermsAgreement.tsx
git commit -m "feat(web-auth): 약관 전체보기 → 모달(전문 표시)"
```

---

## Task 4: 라이브 검증 (워크트리 스택, 격리 DB)

- [ ] 격리 DB `devjobs_wt2` 생성 → 백엔드(8081)+웹(3100) 기동.
- [ ] `/signup` 약관 섹션:
  - "(필수) 서비스 이용약관 동의" 行 `전체보기` → 모달 "서비스 이용약관" 제목 + 제1~5조/부칙 본문.
  - "(필수) 개인정보 ..." `전체보기` → "개인정보 수집 및 이용 동의" 본문.
  - "(선택) 마케팅 ..." `전체보기` → "마케팅 정보 수신 동의 (선택)" 본문.
  - Esc / 백드롭 클릭 / X / "닫기" 버튼 각각 닫힘.
  - 모달 열고 닫아도 체크박스 상태·필수 게이팅 무영향. 만14세 행엔 전체보기 없음.
- [ ] `/signin` 무변경 확인. 검증 후 스택 종료 + `devjobs_wt2` DROP.

> 단위 검증 없음(프론트). typecheck/build 필수, 라이브 권장.

---

## Self-Review (작성자 체크)

- **스펙 커버리지**: 모달(T2) ✓, 콘텐츠 3종(T1) ✓, 전체보기→모달 배선(T3) ✓, 인라인 disclosure 제거(T3) ✓, 게이팅 무변경(T3 로직 동일) ✓.
- **플레이스홀더**: 약관 본문은 의도된 샘플(스펙 명시). 그 외 완전 코드.
- **타입 일관성**: `TermsKey`(terms.ts) ↔ `openDoc: TermsKey|null` ↔ `onView:(k:TermsKey)=>void` ↔ `TERMS[openDoc]` 일치. `Dialog` props(open/onClose/title/children) ↔ 호출부 일치. `setOpenDoc` 를 `onView`로 직접 전달(시그니처 `(k:TermsKey)=>void` 호환).
- **회귀 주의**: 마스터/필수 게이팅(requiredAccepted/onChange) 무변경. 백엔드·`/signin`·CredentialsForm 무관.
