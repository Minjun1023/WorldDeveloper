# 회원가입 카드 재설계 (Manyfast 스타일) — 설계

작성일: 2026-05-26
브랜치: `worktree-auth-signup-validation` (기존 회원가입 폼 위에 적층, PR #3)
상태: 검토 대기

## 1. 개요 / 목표

회원가입 페이지(`/signup`)를 참고 이미지(Manyfast)처럼 **중앙 카드 + 라벨-위/입력-아래 + 약관 동의 섹션** 레이아웃으로 재설계한다. 방금 구현한 기능(이름 실시간 중복확인, 이메일 형식/중복 확인, 비번 요건 체크리스트, 비번 확인 일치, 눈 토글, 제출 게이팅)은 **모두 유지**하고 새 카드 디자인 안에 통합한다. 약관 동의는 **UI만**(체크박스 게이팅), 백엔드 저장 없음. 로그인(`/signin`)은 무변경.

## 2. 범위

**포함**
- `/signup` 카드 레이아웃: 로고 마크 + 헤딩 "환영합니다. 계정을 만들어 주세요." + 푸터 "로그인 화면으로 이동" 링크.
- register 폼: 각 필드에 **라벨**(이름/이메일/비밀번호/비밀번호 확인) 추가, 기존 실시간 확인·체크리스트·눈 토글·일치검사 유지.
- **약관 동의 섹션**(신규 컴포넌트, UI만): 모두 동의(마스터) + 필수 2개(이용약관·개인정보) + 선택(마케팅) + 필수(만 14세). `전체보기`는 플레이스홀더.
- 제출 게이팅에 **필수 약관 3개 동의** 조건 추가.
- 간단한 `Checkbox` UI 컴포넌트 추가.

**제외**
- 로그인 페이지 재설계(무변경), 약관 전문/모달/`전체보기` 실제 동작, 동의 내역 백엔드/DB 저장, 마케팅 수신 처리, 백엔드 변경 일체(register API 그대로).

## 3. 디자인 시스템 (기존 토큰 사용)

- `Card`(`components/ui/card.tsx`): `bg-surface border-border rounded-lg shadow-sm`. 직접 div로 카드 구성하거나 Card 사용.
- 색: `--primary`(#4f46e5), `--success`, `--destructive`, `--muted-foreground`, `--surface`, `--surface-2`, `--border`. radius 0.5rem.
- 텍스트 유틸: `text-display`/`text-h3`/`text-body-sm`/`text-caption`(기존 사용 중). 라벨은 `text-body-sm font-medium`.
- 로고 마크: 별도 자산 없음 → lucide 아이콘(`Code2`)을 `text-primary h-8 w-8` 중앙 배치(브랜드 글리프 대용).

## 4. 페이지 레이아웃 (`web/app/(auth)/signup/page.tsx`)

중앙 정렬 카드. 기존 전역 레이아웃(nav/footer)은 유지, main 안에 카드 렌더.

```
<div className="mx-auto max-w-md py-10">
  <div className="rounded-lg border border-border bg-surface shadow-sm p-8 space-y-6">
    [로고 아이콘 중앙]
    <h1 className="text-h3 font-bold text-center">환영합니다. 계정을 만들어 주세요.</h1>
    <CredentialsForm mode="register" />
    <p className="text-center text-body-sm">
      <Link href="/signin" className="font-medium underline">로그인 화면으로 이동</Link>
    </p>
  </div>
</div>
```
(클래스는 구현 시 기존 패턴에 맞게 미세 조정)

## 5. Checkbox 컴포넌트 (`web/components/ui/checkbox.tsx`, 신규)

- 접근성 위해 네이티브 `<input type="checkbox">` 기반. `accent-[color] / accent-primary` 스타일, `h-4 w-4 rounded`. `id` 전달 → 라벨 연결.
- props: `React.InputHTMLAttributes<HTMLInputElement>`(checked/onChange/id 등 패스스루) + className 머지. `forwardRef` 또는 단순 함수형.

## 6. TermsAgreement 컴포넌트 (`web/components/auth/TermsAgreement.tsx`, 신규, 클라이언트)

- 내부 상태: `tos`(필수), `privacy`(필수), `age14`(필수), `marketing`(선택) 4개 boolean.
- props: `onChange(requiredAccepted: boolean)` — 필수 3개(tos·privacy·age14) 모두 true일 때 true 통지. `useEffect`로 값 변할 때 부모에 전달.
- **모두 동의** 마스터: 표시 checked = (tos&&privacy&&age14&&marketing). 클릭 시 → 새 값으로 4개 전부 set(전부 true면 끄기, 아니면 켜기).
- 항목 행: 체크박스 + 라벨 + (필수/선택 접두). 우측에 `전체보기`(필수 2개·선택 1개에) — `<button type="button">`, 현재 no-op 플레이스홀더(추후 모달/페이지). 만14세는 `전체보기` 없음.
- 레이아웃: 제목 "서비스 이용을 위해 약관에 동의해 주세요" + 테두리 박스(`border rounded-lg p-4 space-y-3`), 마스터 아래 구분선(`border-t`).
- 라벨 문구: "(필수) 서비스 이용약관 동의", "(필수) 개인정보 수집 및 이용 동의", "(선택) 마케팅 정보 수신 및 프로모션 안내 동의", "만 14세 이상입니다".

## 7. CredentialsForm 변경 (`web/components/auth/CredentialsForm.tsx`)

shared 로직(state/useEffect/submit/availMsg/registered 뷰)은 유지. **register 모드 JSX만** 라벨 + 약관 추가, login 모드 JSX는 무변경.

- register 상태 추가: `const [termsOk, setTermsOk] = useState(false);`
- 게이팅: register 분기에 `&& termsOk` 추가 → `!pending && (mode==="login" || (namePass && emailPass && pwValid && pwMatch && termsOk))`.
- register 필드: 각 입력 위 `<label htmlFor>` + 입력에 매칭 `id`(reg-name/reg-email/reg-password/reg-confirm). 기존 실시간 메시지·체크리스트·눈토글 그대로.
- 제출 버튼 위에 `<TermsAgreement onChange={setTermsOk} />` 렌더(register-only).
- 버튼 문구 "계정 만들기"(register) — 현재 "가입하기"에서 변경(참고 이미지 일치). login은 "로그인" 유지.
- 비활성 시 회색(기존 Button disabled 스타일이 이미 처리).

## 8. 에러 / 엣지

- 약관 미동의 시 버튼 비활성(메시지 없이 회색). 게이팅이 1차 방어.
- 마스터 체크 ↔ 개별 체크 동기화: 개별을 모두 켜면 마스터 자동 on, 하나라도 끄면 off.
- `전체보기` 플레이스홀더는 클릭해도 동작 없음(접근성: `aria-label`은 생략 가능, 버튼 텍스트로 충분). 추후 연결.
- login 모드/`/signin`/백엔드/register API: 변경 없음(회귀 금지).

## 9. 검증

- `cd web && npm run typecheck && npm run build` 성공.
- 라이브(워크트리 스택): `/signup` 카드 렌더, 로고/헤딩/푸터, 라벨 표시, 실시간 확인·체크리스트·눈토글 유지, 약관 마스터↔개별 동기화, 필수 미동의 시 "계정 만들기" 비활성 → 전부 충족 시 활성, 가입 end-to-end. `/signin` 무변경 확인.

## 10. 미해결 / 미래

- `전체보기` 약관 전문(모달/페이지), 동의 내역·마케팅 수신여부 백엔드 저장(마이그레이션), 약관 버전 관리. 로그인 페이지 동일 카드 스타일 통일(원하면 후속).
