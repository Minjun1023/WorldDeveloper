import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn() }) }));

import { CoachChat } from "@/components/coach/CoachChat";

const jobs = [{ id: "greenhouse:acme:1", title: "Backend Engineer", company: { slug: "acme", display_name: "Acme" } }];

// 공고 선택 시 GET /api/me/coach/conversation 발생 → URL로 분기.
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
    // POST /api/me/coach (reply)
    return Promise.resolve({ ok: true, status: 200, json: async () => ({ reply: opts.reply ?? "ok" }) });
  });
}

// 모달에서 공고 선택 + 이력서 붙여넣기 → '첨부 완료'로 커밋.
async function attach(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole("button", { name: /첨부/ })); // 모달 열기
  await user.click(screen.getByRole("button", { name: "직접 붙여넣기" })); // 파일이 기본이므로 붙여넣기 탭으로
  await user.selectOptions(screen.getByRole("combobox"), "greenhouse:acme:1");
  await user.type(screen.getByPlaceholderText(/이력서 전문/), "Go dev 5y");
  await user.click(screen.getByRole("button", { name: "첨부 완료" }));
}

describe("CoachChat", () => {
  it("보내기 버튼은 항상 활성 — 미완성 전송 시 안내로 응답한다", async () => {
    vi.stubGlobal("fetch", mockFetch({ convStatus: 204 }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    const send = screen.getByRole("button", { name: /보내기/ });
    expect(send).toBeEnabled(); // 어느 상황에서도 활성
    await user.click(send); // 공고·이력서·메시지 모두 없이 전송 → 안내
    expect(await screen.findByText(/무엇이 궁금하신가요/)).toBeInTheDocument();
  });

  it("메시지만 입력해도 실제 답변을 받는다 (공고·이력서 없이)", async () => {
    const fetchMock = mockFetch({ reply: "일반 조언입니다." });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.type(screen.getByPlaceholderText(/메시지/), "이 회사 어때요?");
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("이 회사 어때요?")).toBeInTheDocument(); // 내 메시지
    expect(await screen.findByText("일반 조언입니다.")).toBeInTheDocument(); // 실제 답변
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream");
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.job_id).toBe(""); // 공고 없이 전송
    expect(body.messages.at(-1)).toEqual({ role: "user", content: "이 회사 어때요?" });
  });

  it("첨부만 하고 메시지 없이 보내면 기본 질문으로 실제 답변을 받는다", async () => {
    const fetchMock = mockFetch({ convStatus: 204, reply: "이력서 평가입니다." });
    vi.stubGlobal("fetch", fetchMock);
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await attach(user); // 공고 + 이력서 첨부, 메시지는 비움
    await user.click(screen.getByRole("button", { name: /보내기/ }));
    expect(await screen.findByText("이력서 평가입니다.")).toBeInTheDocument();
    const postCall = fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream");
    const body = JSON.parse((postCall![1] as RequestInit).body as string);
    expect(body.job_id).toBe("greenhouse:acme:1");
    // 메시지 없이 보냈으므로 기본 질문이 user 메시지로 자동 주입된다.
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
    // 조합 중(IME) Enter → 전송 안 함(끝글자 잔류 방지)
    fireEvent.keyDown(box, { key: "Enter", isComposing: true });
    expect(fetchMock.mock.calls.find((c) => String(c[0]) === "/api/me/coach/stream")).toBeUndefined();
    // 조합 확정 후 Enter → 전송
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
        jobId: "greenhouse:acme:1",
        messages: [{ role: "assistant", content: "이전 조언이에요." }],
        lastActiveAt: "2026-06-01T00:00:00Z",
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
        jobId: "greenhouse:acme:1",
        messages: [{ role: "assistant", content: "레일에서 복원된 상담." }],
        lastActiveAt: "2026-06-01T00:00:00Z",
      },
    });
    vi.stubGlobal("fetch", fetchMock);
    const { rerender } = render(
      <CoachChat initialJobs={jobs as never} selectSignal={{ jobId: null, n: 0 }} />,
    );
    // 레일에서 해당 공고를 클릭한 것처럼 signal 변경(같은 jobId 재선택도 반영되도록 n 증가).
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

  it("일반 퀵 질문 칩은 입력창을 채운다", async () => {
    vi.stubGlobal("fetch", mockFetch({ convStatus: 204 }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "내 이력서에서 부족한 점은?" }));
    expect(screen.getByPlaceholderText(/메시지/)).toHaveValue("내 이력서에서 부족한 점은?");
  });

  it("공고 전용 퀵 질문 칩은 공고 미첨부 시 입력창을 채우지 않는다 (첨부 모달 경로)", async () => {
    // 회귀: 공고 없이 '이 공고에 맞는 키워드는?'을 그대로 보내 환각을 유발하던 경로 차단.
    vi.stubGlobal("fetch", mockFetch({ convStatus: 204 }));
    render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: "이 공고에 맞는 키워드는?" }));
    expect(screen.getByPlaceholderText(/메시지/)).toHaveValue(""); // setInput 대신 openAttach 분기
  });

  it("PDF 첨부 시 서버 추출(/resume-extract)을 호출하고 파일명을 표시한다", async () => {
    const fetchMock = mockFetch({ convStatus: 204, extractText: "추출된 이력서 텍스트" });
    vi.stubGlobal("fetch", fetchMock);
    const { container } = render(<CoachChat initialJobs={jobs as never} />);
    const user = userEvent.setup();
    await user.click(screen.getByRole("button", { name: /첨부/ }));
    await user.click(screen.getByRole("button", { name: "파일 업로드" })); // 파일 업로드 탭(기본)
    const input = container.querySelector('input[type="file"]') as HTMLInputElement;
    const pdf = new File([new Uint8Array([37, 80, 68, 70])], "resume.pdf", { type: "application/pdf" });
    await user.upload(input, pdf);
    await waitFor(() =>
      expect(
        fetchMock.mock.calls.some((c) => String(c[0]).includes("/api/me/coach/resume-extract")),
      ).toBe(true),
    );
    expect(await screen.findByText("resume.pdf")).toBeInTheDocument();
  });
});
