import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

// WithdrawSection 이 useRouter 를 쓰므로 mock (앱 라우터 미마운트 에러 방지).
vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));

import { ProfileEditor } from "@/components/profile/ProfileEditor";

function routeFetch({ exists = false }: { exists?: boolean } = {}) {
  return vi.fn((url: string, init?: RequestInit) => {
    if (url === "/api/me/profile" && init?.method === "PUT") {
      return Promise.resolve({ ok: true, json: () => Promise.resolve({}) });
    }
    if (url === "/api/me/profile") {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve(
            exists
              ? { exists: true, profile: { skills: ["python"], seniority: "senior", remote_preference: "any", preferred_locations: [] } }
              : { exists: false },
          ),
      });
    }
    if (url === "/api/recommend") {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ total_candidates: 10, returned: 0, recommendations: [] }),
      });
    }
    return Promise.reject(new Error(`unexpected ${url}`));
  });
}

afterEach(() => vi.unstubAllGlobals());

describe("ProfileEditor", () => {
  it("shows the full-page step wizard when no profile exists, and saves after walking the steps", async () => {
    const f = routeFetch({ exists: false });
    vi.stubGlobal("fetch", f);
    render(<ProfileEditor />);

    // 프로필 없음 → 폼 대신 전면 위저드 (1번 질문). 폼의 저장 버튼은 없어야 한다.
    expect(await screen.findByText("어떤 기술 스택을 쓰시나요?")).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "저장" })).not.toBeInTheDocument();

    // 다음으로 시니어리티 스텝 → 답변 카드 클릭 시 자동 진행
    await userEvent.click(screen.getByRole("button", { name: "다음" }));
    expect(await screen.findByText("지금 레벨은 어디쯤인가요?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /시니어/ }));
    expect(await screen.findByText("경력은 몇 년차인가요?")).toBeInTheDocument();

    // 남은 스텝은 '다음'으로 통과 → 요약 → 저장
    for (const title of [
      "어디에서 일하고 싶으세요?",
      "원격과 이주, 어느 쪽인가요?",
      "희망 연봉이 있나요?",
      "한두 문장으로 소개해 주세요",
      "준비 끝! 이렇게 반영돼요",
    ]) {
      await userEvent.click(screen.getByRole("button", { name: "다음" }));
      expect(await screen.findByText(title)).toBeInTheDocument();
    }
    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    const putCall = f.mock.calls.find(
      (c) => c[0] === "/api/me/profile" && (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    // 저장 후 위저드가 닫히고 폼으로 전환된다.
    expect(await screen.findByText("저장됐어요.")).toBeInTheDocument();
  });

  it("falls back to the plain form when the wizard skip link is clicked", async () => {
    vi.stubGlobal("fetch", routeFetch({ exists: false }));
    render(<ProfileEditor />);

    expect(await screen.findByText("어떤 기술 스택을 쓰시나요?")).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "단계 없이 폼으로 한 번에 작성하기" }));

    expect(await screen.findByLabelText("기술 스택")).toBeInTheDocument();
    expect(screen.queryByText("어떤 기술 스택을 쓰시나요?")).not.toBeInTheDocument();
  });

  it("keeps the plain form (no wizard) when a profile already exists, and saves via PUT", async () => {
    const f = routeFetch({ exists: true });
    vi.stubGlobal("fetch", f);
    render(<ProfileEditor />);

    await screen.findByLabelText("기술 스택"); // 로드 완료 후 폼 렌더
    expect(screen.queryByText("어떤 기술 스택을 쓰시나요?")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "저장" }));

    const putCall = f.mock.calls.find(
      (c) => c[0] === "/api/me/profile" && (c[1] as RequestInit | undefined)?.method === "PUT",
    );
    expect(putCall).toBeTruthy();
    expect(await screen.findByText("저장됐어요.")).toBeInTheDocument();
  });
});
