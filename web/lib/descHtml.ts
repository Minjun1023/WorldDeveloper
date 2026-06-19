// 공고 상세 설명 HTML에서 '제목:'만 남은 고아 헤딩을 제거한다.
// 배경: ETL이 EEO/개인정보 등 보일러플레이트 문단을 걷어낼 때 그 제목(예: "개인정보 및 AI
// 가이드라인:")만 남으면, 본문이 잘린 듯 보이거나(끝) 엉뚱한 다음 문단을 가리킨다(중간).
// ETL에서도 고치지만, 이미 캐시된 번역 등 기존 데이터에는 남아 있으므로 표시 단계에서도 방어한다.
//
// 고아 판정: 텍스트가 ':' 로 끝나는 짧은 라벨 헤딩(<p>/<hN>, 굵게 가능)이
//   (a) 바로 뒤에 빈/공백 문단이 오거나(본문 없이 떠 있음), (b) 문서 끝에 있을 때.
const LABEL =
  "<(p|h[1-4])>\\s*(?:<(?:strong|b|em|i)>)?\\s*[^<>]{0,79}:(?:\\s|&nbsp;|\\u00a0)*(?:</(?:strong|b|em|i)>)?\\s*</\\1>";
const EMPTY_P = "<p>(?:\\s|&nbsp;|\\u00a0|<br\\s*/?>)*</p>";

export function stripOrphanHeadings(html: string): string {
  if (!html) return html;
  let out = html;
  for (let i = 0; i < 4; i++) {
    const before = out;
    // (a) 빈 문단이 바로 뒤따르는 라벨 헤딩 = 본문 없는 고아 → 헤딩 제거
    out = out.replace(new RegExp(`${LABEL}\\s*(?=${EMPTY_P})`, "i"), "");
    // (b) 남은 빈 문단 정리
    out = out.replace(new RegExp(`\\s*${EMPTY_P}\\s*`, "ig"), "\n");
    // (c) 문서 끝의 라벨 헤딩 제거
    out = out.replace(new RegExp(`\\s*${LABEL}\\s*$`, "i"), "");
    if (out === before) break;
  }
  return out.trim();
}
