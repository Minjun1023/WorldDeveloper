import { NextResponse } from "next/server";

import { extractResumeText } from "@/lib/pdf";
import { getSessionToken } from "@/lib/session-server";

// PDF 텍스트 추출은 Node 런타임에서(unpdf). 추출 결과는 저장하지 않고 응답으로만 반환 —
// 클라이언트가 코치 호출 시 이력서 텍스트로 함께 보낸다.
export const runtime = "nodejs";

const MAX_BYTES = 5 * 1024 * 1024; // 5MB

export async function POST(req: Request) {
  if (!(await getSessionToken())) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  const form = await req.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "파일이 없어요." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "파일이 너무 커요 (최대 5MB)." }, { status: 413 });
  }
  try {
    const text = await extractResumeText(await file.arrayBuffer());
    if (!text) {
      return NextResponse.json(
        { error: "PDF에서 텍스트를 찾지 못했어요. 스캔/이미지 PDF는 텍스트를 복사해 붙여넣어 주세요." },
        { status: 422 },
      );
    }
    return NextResponse.json({ text });
  } catch {
    return NextResponse.json({ error: "PDF를 읽지 못했어요." }, { status: 422 });
  }
}
