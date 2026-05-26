# 약관 전체보기 모달 — 설계

작성일: 2026-05-26
브랜치: `worktree-terms-fullview-modal` (격리 워크트리, origin/main=c8195ee 기반)
상태: 검토 대기

## 1. 개요 / 목표

회원가입 약관 동의 항목의 `전체보기` 클릭 시, 현재의 인라인 "준비 중" 안내 대신 **해당 약관 전문을 모달(팝업)** 로 표시한다. 약관 본문은 베타용 **샘플 표준 문구**(한국어)를 제공한다. 약관 동의 체크/게이팅 로직은 무변경.

## 2. 범위

**포함**
- 접근성 모달 컴포넌트(`Dialog`, 네이티브 `<dialog>` 기반): Esc/백드롭/버튼 닫기.
- 약관 콘텐츠 모듈(`lib/terms.ts`): 서비스 이용약관 / 개인정보 수집·이용 / 마케팅 정보 수신 3종 샘플 문구.
- `TermsAgreement`: `전체보기` → 해당 문서 모달 오픈(인라인 disclosure 제거). 읽기 전용 + 닫기.

**제외**
- 모달 내 "동의" 버튼(체크는 기존 체크박스로만), 약관 버전 관리/백엔드 저장, 별도 라우트 페이지, 법무 검토(샘플 문구는 추후 보완), 로그인/회원가입 폼의 다른 변경.

## 3. Dialog 컴포넌트 (`web/components/ui/dialog.tsx`, 신규, 클라이언트)

- 네이티브 `<dialog>` + ref: `open` true → `showModal()`(모달, 백드롭, Esc, 포커스 트랩 기본 제공), false → `close()`.
- props: `open: boolean`, `onClose: () => void`, `title: string`, `children`.
- 닫기 경로: (1) 헤더 X 버튼, (2) 하단 "닫기" 버튼, (3) Esc(네이티브 `close` 이벤트→onClose), (4) 백드롭 클릭(`onClick`에서 `e.target === dialogEl`이면 onClose). 모두 `onClose` 호출(상태 null) → effect가 `close()` (idempotent).
- 스타일: 토큰 사용 — `bg-surface border-border rounded-lg shadow-lg`, `backdrop:bg-black/40`, 폭 `min(92vw,32rem)`, 본문 `max-h-[60vh] overflow-y-auto`. 헤더(제목+X)/본문/푸터(닫기) 구분선.
- 아이콘: lucide `X`.

## 4. 약관 콘텐츠 (`web/lib/terms.ts`, 신규)

```ts
export type TermsKey = "service" | "privacy" | "marketing";
export type TermsDoc = { title: string; sections: { heading: string; body: string }[] };
export const TERMS: Record<TermsKey, TermsDoc> = { ... };
```
- `service`: 서비스 이용약관(목적/이용계약/서비스 제공·변경/회원 의무/해지/베타 안내).
- `privacy`: 개인정보 수집·이용(수집 항목/목적/보유기간/거부 권리/베타 안내).
- `marketing`: 마케팅 정보 수신(목적/방법/선택 동의/철회).
- 베타용 대표 초안(한국어). 본문은 `whitespace-pre-line` 렌더(줄바꿈 `\n` 허용).

## 5. TermsAgreement 변경 (`web/components/auth/TermsAgreement.tsx`)

- `openDoc` 상태(`TermsKey | null`) 추가. 인라인 `open` disclosure 및 placeholder 문구 **제거**.
- `TermsRow`의 `withLink` → `docKey?: TermsKey` + `onView?: (k) => void`로 교체. `전체보기` 클릭 → `onView(docKey)`(체크박스 토글과 독립).
- 행 매핑: tos→service, privacy→privacy, marketing→marketing. 만14세 행은 docKey 없음(전체보기 없음, 기존 유지).
- 하단에 `<Dialog open={openDoc!==null} onClose={()=>setOpenDoc(null)} title={openDoc?TERMS[openDoc].title:""}>` 렌더 — `TERMS[openDoc].sections` 를 heading/body로 표시.
- 마스터/필수 게이팅(`requiredAccepted`, `onChange`) 로직 **무변경**.

## 6. 에러 / 엣지

- `openDoc=null`이면 Dialog `open=false`(렌더는 되나 닫힘). title은 빈 문자열.
- Esc/백드롭/X/닫기 모두 동일하게 `onClose`로 수렴 → 상태 null. 중복 호출 무해(idempotent).
- 모달 열림 중 배경 폼 스크롤: 네이티브 모달이 inert 처리. 본문 길면 모달 내부만 스크롤.
- 다크모드: 토큰 기반이라 자동.

## 7. 검증

- `cd web && npm run typecheck && npm run build` 성공.
- 라이브(워크트리 스택, 격리 DB): `/signup`에서 각 `전체보기` → 모달 열림(서비스/개인정보/마케팅 제목·본문), Esc/백드롭/닫기로 닫힘, 체크박스 동작·게이팅 무영향, `/signin` 무변경.

## 8. 미해결 / 미래

- 약관 정식 문구·법무 검토, 버전/일자 표기, 모달 내 "동의하고 닫기" 버튼, 동의 이력 백엔드 저장, 약관 전용 페이지(SEO).
