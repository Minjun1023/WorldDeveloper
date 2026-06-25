import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";

// router.push 를 케이스 간 공유 목으로 캡처(비로그인 라우팅 검증용).
const { push } = vi.hoisted(() => ({ push: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ push }) }));

import { CoachChat } from "@/components/coach/CoachChat";

const jobs = [{ id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" } }];

beforeEach(() => {
  push.mockClear();
});

// 스트리밍 응답 목 — body.getReader() 로 한 청크에 전체 텍스트를 흘린다.
function streamResponse(text: string) {
  const enc = new TextEncoder();
  let sent = false;
  return {
    ok: true,
    status: 200,
    body: {
      getReader() {
        return {
          read: async () => {
            if (sent) return { done: true, value: undefined };
            sent = true;
            return { done: false, value: enc.encode(text) };
          },
        };
      },
    },
  };
}

function mockFetch(opts: { conversation?: unknown; convStatus?: number; reply?: string; extractText?: string }) {
  return vi.fn((url: string, init?: RequestInit) => {
    const u = String(url);
    if (u.includes("/api/me/coach/resume-extract")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => ({ text: opts.extractText ?? "추출된 이력서" }) });
    }
    if (u.includes("/api/me/coach/stream")) {
      return Promise.resolve(streamResponse(opts.reply ?? "ok"));
    }
    if (u.includes("/api/me/coach/conversation")) {
      if (init?.method === "DELETE") return Promise.resolve({ ok: true, status: 200, json: async () => ({ ok: true }) });
      const status = opts.convStatus ?? (opts.conversation ? 200 : 204);
      return Promise.resolve({ ok: true, status, json: async () => opts.conversation ?? {} });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ reply: opts.reply ?? "ok" }) });
  });
}

// ＋ 메뉴 → 이력서 첨부(붙여넣기) + 공고 첨부(모달 선택). 이력서 먼저(상태 안정), 그다음 공고.
async function attach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: "공고·이력서 첨부" })); // ＋
  await user.click(screen.getByRole("button", { name: "이력서 첨부" })); // 메뉴 → 이력서 모달
  await user.click(screen.getByRole("button", { name: "직접 붙여넣기" }));
  await user.type(screen.getByPlaceholderText(/이력서 전문/), "Go dev 5y");
  await user.click(screen.getByRole("button", { name: "첨부" }));
  await user.click(screen.getByRole("button", { name: "공고·이력서 첨부" })); // ＋
  await user.click(screen.getByRole("button", { name: "공고 첨부" })); // 메뉴 → 공고 모달
  await user.click(screen.getByRole("button", { name: /Backend Engineer/ })); // 리스트에서 선택(닫힘)
}

describe("CoachChat", () => {
  it("보내기 버튼은 항상 활성 — 미완성 전송 시 안내로 응답한다", async () => {
    vi.stubGlobal("fetch", mockFetch({ convStatus: 204 }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: /보내기/ });
    expect(send).toBeEnabled();
    await user.click(send);
    expect(await screen.findByText(/무엇이 궁금하신가요/)).toBeInTheDocument();
  });

  it("메시지만 입력해도 실제 답변을 받는다 (공고·이력서 없이)", async () => {
    const fetchMock = mockFetch({ reply: "일반 조언입니다." });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/메시지/), "이 회사 어때요?");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("이 회사 어때요?")).toBeInTheDocument();
    expect(await screen.findByText("일반 조언입니다.")).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream");
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.job_id).toBe("");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "이 회사 어때요?" });
  });

  it("첨부만 하고 메시지 없이 보내면 기본 질문으로 실제 답변을 받는다", async () => {
    const fetchMock = mockFetch({ convStatus: 204, reply: "이력서 평가입니다." });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await attach(user);
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("이력서 평가입니다.")).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream");
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.job_id).toBe("greenhouse:acme:1");
    expect(body.messages.at(-1).role).toBe("user");
    expect(body.messages.at(-1).content).toMatch(/이력서/);
  });

  it("한글 IME 조합 중 Enter 는 전송하지 않고, 조합이 끝난 Enter 로 전송한다", async () => {
    const fetchMock = mockFetch({ reply: "ok" });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    const box = screen.getByPlaceholderText(/메시지/);
    await user.type(box, "안녕");
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    expect(fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream")).toBeUndefined();
    fireEvent.keyDown(box, { key: "Enter" });
    await waitFor(() =>
      expect(fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream")).toBeTruthy(),
    );
  });

  it("posts and appends assistant reply", async () => {
    const fetchMock = mockFetch({ convStatus: 204, reply: "Go 경험을 위로 올리세요." });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await attach(user);
    await user.type(screen.getByPlaceholderText(/메시지/), "어떻게?");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("Go 경험을 위로 올리세요.")).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream");
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.job_id).toBe("greenhouse:acme:1");
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "어떻게?" });
  });

  it("restores a saved conversation after attaching the job", async () => {
    vi.stubGlobal("fetch", mockFetch({
      conversation: {
        job_id: "greenhouse:acme:1",
        messages: [{ role: "assistant", content: "이전 조언이에요." }],
        last_active_at: "2026-06-01T00:00:00Z",
      },
    }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await attach(user);
    await waitFor(() => expect(screen.getByText("이전 조언이에요.")).toBeInTheDocument());
  });

  it("selectSignal 변경(레일 클릭 복원)으로 대화를 fetch 하고 복원 메시지를 렌더한다", async () => {
    const fetchMock = mockFetch({
      conversation: {
        job_id: "greenhouse:acme:1",
        messages: [{ role: "assistant", content: "레일에서 복원된 상담." }],
        last_active_at: "2026-06-01T00:00:00Z",
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <CoachChat initialJobs={jobs as never} selectSignal={{ jobId: null, n: 0 }} />,
    );
    rerender(<CoachChat initialJobs={jobs as never} selectSignal={{ jobId: "greenhouse:acme:1", n: 1 }} />);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some(
          (c) => String(c[0]) === "/api/me/coach/conversation?jobId=greenhouse%3Aacme%3A1",
        ),
      ).toBe(true),
    );
    expect(await screen.findByText("레일에서 복원된 상담.")).toBeInTheDocument();
  });

  it("PDF 첨부 시 서버 추출(/resume-extract)을 호출하고 파일명을 표시한다", async () => {
    const fetchMock = mockFetch({ convStatus: 204, extractText: "추출된 이력서 텍스트" });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "공고·이력서 첨부" }));
    await user.click(screen.getByRole("button", { name: "이력서 첨부" }));
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "resume.pdf", { type: "application/pdf" });
    await user.upload(input, pdf);
    await waitFor(() =>
      expect(fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/me/coach/resume-extract"))).toBe(true),
    );
    expect(await screen.findByText("resume.pdf")).toBeInTheDocument();
  });

  it("비로그인 전송 시 로그인 페이지로 이동한다", async () => {
    vi.stubGlobal("fetch", mockFetch({ convStatus: 204 }));
    render(<CoachChat loggedIn={false} initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/메시지/), "도와줘");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(push).toHaveBeenCalledWith("/signin?callbackUrl=/coach");
  });
});
