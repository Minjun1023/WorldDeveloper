import { extractText, getDocumentProxy } from "unpdf";

// 백엔드 코치 가드(이력서 20k자)와 정합.
export const MAX_RESUME_CHARS = 20_000;

// PDF 추출 텍스트에 섞이는 NUL 문자(이스케이프 모호성 피해 런타임 생성).
const NUL = String.fromCharCode(0);

// PDF 바이트 → 텍스트(페이지 병합). 스캔/이미지 PDF는 텍스트가 없어 빈 문자열.
// 서버(Node)에서만 호출 — unpdf 는 worker 없이 동작하는 serverless 빌드를 사용한다.
export async function extractResumeText(data: ArrayBuffer): Promise<string> {
  const pdf = await getDocumentProxy(new Uint8Array(data));
  const { text } = await extractText(pdf, { mergePages: true });
  const merged = Array.isArray(text) ? text.join("\n") : text;
  return merged.split(NUL).join("").trim().slice(0, MAX_RESUME_CHARS);
}
