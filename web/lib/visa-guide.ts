// 비자/이주 경량 가이드 데이터.
// 원칙(정직성): 이민 사실을 직접 단정하지 않고 *안정적이고 널리 알려진 개요*만 간결히 적고,
// 정확성은 각국 *공식 출처 링크*에 위임한다. 모든 페이지에 면책을 노출한다.
// 링크 URL 은 작성 시점(2026-06)에 공식 도메인에서 검증함.

export type GuideLink = { label: string; url: string };

export type VisaGuide = {
  slug: string; // /search?region= 키와 동일
  country: string; // 한국어 국가명
  flag: string;
  visaName: string; // 대표 취업 비자/재류자격
  summary: string; // 1~2문장 개요
  points: string[]; // 핵심 포인트(보수적·안정적 사실)
  official: GuideLink[]; // 공식 출처
  register?: GuideLink; // 우리 "명부검증" 신호의 공개 명부 출처(있는 경우)
  registerNote?: string;
  locationKeywords: string[]; // job.location 매칭용(소문자 부분일치)
};

export const GUIDE_DISCLAIMER =
  "이민·비자 규정은 자주 바뀝니다. 이 페이지는 이해를 돕는 개요이며 법적 조언이 아닙니다. 실제 지원 전 반드시 각국 공식 출처에서 최신 요건을 확인하세요.";

export const VISA_GUIDES: VisaGuide[] = [
  {
    slug: "uk",
    country: "영국",
    flag: "🇬🇧",
    visaName: "Skilled Worker 비자",
    summary:
      "영국에서 외국인 개발자를 채용하려면 고용주가 Home Office의 스폰서 라이선스를 보유해야 하고, 채용 시 고용주가 '스폰서십 증명서(Certificate of Sponsorship)'를 발급합니다.",
    points: [
      "고용주가 Home Office 라이선스를 가진 스폰서여야 합니다.",
      "직무가 자격 기준을 충족하고 최소 연봉 요건을 넘어야 합니다.",
      "영국 정부가 공개하는 '등록 스폰서 명부'에서 회사를 직접 확인할 수 있습니다.",
    ],
    official: [
      { label: "GOV.UK — Skilled Worker visa", url: "https://www.gov.uk/skilled-worker-visa" },
    ],
    register: {
      label: "GOV.UK — 등록 스폰서 명부(Register of licensed sponsors)",
      url: "https://www.gov.uk/government/publications/register-of-licensed-sponsors-workers",
    },
    registerNote:
      "이 사이트의 '명부검증' 배지는 회사가 위 Home Office 명부에 등재돼 있는지 대조한 결과입니다.",
    // 주의: 바닐라 "uk"는 "Fukuoka"(일본) 등에 오매칭하므로 금지. 앞 공백 " uk"로 "Remote, UK"만 안전 매칭.
    locationKeywords: ["united kingdom", "england", "london", "manchester", "edinburgh", "scotland", " uk"],
  },
  {
    slug: "us",
    country: "미국",
    flag: "🇺🇸",
    visaName: "H-1B (전문직, Specialty Occupation)",
    summary:
      "미국의 대표적인 전문직 취업 비자는 고용주가 후원하는 H-1B로, 학사 이상 학위가 필요한 전공 관련 직무에 적용됩니다. 연간 발급 한도(캡)와 추첨 절차가 있습니다.",
    points: [
      "고용주의 후원(petition)이 반드시 필요합니다.",
      "연간 한도(cap)와 전자 추첨이 있어 시기·확률 영향을 받습니다.",
      "규정·수수료가 자주 바뀌므로 USCIS 공식 안내를 확인하세요.",
    ],
    official: [
      {
        label: "USCIS — H-1B Specialty Occupations",
        url: "https://www.uscis.gov/working-in-the-united-states/h-1b-specialty-occupations",
      },
    ],
    register: {
      label: "USCIS — H-1B Employer Data Hub",
      url: "https://www.uscis.gov/tools/reports-and-studies/h-1b-employer-data-hub",
    },
    registerNote:
      "이 사이트의 '명부검증' 배지는 회사의 과거 H-1B 후원 이력(USCIS Employer Data Hub)을 대조한 결과입니다.",
    locationKeywords: [
      "united states", "usa", "san francisco", "new york", "san mateo", "seattle",
      "austin", "boston", "los angeles", "bay area", "mountain view", "palo alto",
      "chicago", "denver", " us", "remote, us",
    ],
  },
  {
    slug: "netherlands",
    country: "네덜란드",
    flag: "🇳🇱",
    visaName: "Highly Skilled Migrant (kennismigrant)",
    summary:
      "네덜란드는 IND(이민청)가 '인정 스폰서(recognised sponsor)'로 등록한 고용주만 highly skilled migrant 거주허가를 신청할 수 있습니다.",
    points: [
      "고용주가 IND 인정 스폰서로 등록돼 있어야 합니다.",
      "연령대별 최소 소득 기준을 충족해야 합니다.",
      "IND 공개 명부에서 회사가 인정 스폰서인지 확인할 수 있습니다.",
    ],
    official: [
      {
        label: "IND — Highly skilled migrant",
        url: "https://ind.nl/en/residence-permits/work/highly-skilled-migrant",
      },
    ],
    register: {
      label: "IND — 공개 인정 스폰서 명부",
      url: "https://ind.nl/en/public-register-recognised-sponsors/public-register-regular-labour-and-highly-skilled-migrants",
    },
    registerNote:
      "이 사이트의 '명부검증' 배지는 회사가 IND 인정 스폰서 명부에 있는지 대조한 결과입니다.",
    locationKeywords: ["netherlands", "amsterdam", "rotterdam", "utrecht", "hague", "eindhoven"],
  },
  {
    slug: "germany",
    country: "독일",
    flag: "🇩🇪",
    visaName: "EU Blue Card / 전문인력 취업비자",
    summary:
      "독일은 대학 학위를 가진 전문인력을 위한 EU Blue Card가 대표적입니다. 고용계약과 최소 연봉 기준을 충족하면 신청할 수 있습니다.",
    points: [
      "대학 학위(또는 인정되는 동등 자격)와 고용계약이 필요합니다.",
      "직종·연도에 따른 최소 연봉 기준이 적용됩니다.",
      "비자 절차에 연방고용청(BA) 승인이 포함될 수 있습니다.",
    ],
    official: [
      {
        label: "Make it in Germany — 전문인력 취업비자",
        url: "https://www.make-it-in-germany.com/en/visa-residence/types/work-qualified-professionals",
      },
      {
        label: "Make it in Germany — EU Blue Card",
        url: "https://www.make-it-in-germany.com/en/visa-residence/types/eu-blue-card",
      },
    ],
    locationKeywords: ["germany", "berlin", "munich", "münchen", "munchen", "hamburg", "frankfurt", "cologne", "köln", "koln", "stuttgart", "düsseldorf", "dusseldorf"],
  },
  {
    slug: "ireland",
    country: "아일랜드",
    flag: "🇮🇪",
    visaName: "Critical Skills Employment Permit",
    summary:
      "아일랜드는 IT·엔지니어링 등 부족직종을 위한 Critical Skills Employment Permit이 대표적입니다. 고용 제안과 연봉 기준을 충족해야 합니다.",
    points: [
      "직무가 Critical Skills 직종 리스트에 포함돼야 합니다.",
      "최소 연봉 기준을 충족해야 합니다(직종에 따라 상이).",
      "Critical Skills 경로는 노동시장 테스트가 면제됩니다.",
    ],
    official: [
      {
        label: "DETE — Critical Skills Employment Permit",
        url: "https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/permit-types/critical-skills-employment-permit/",
      },
      {
        label: "DETE — 취업허가 종류 전체",
        url: "https://enterprise.gov.ie/en/what-we-do/workplace-and-skills/employment-permits/",
      },
    ],
    locationKeywords: ["ireland", "dublin", "cork"],
  },
  {
    slug: "japan",
    country: "일본",
    flag: "🇯🇵",
    visaName: "기술·인문지식·국제업무 (Engineer/Specialist in Humanities/International Services)",
    summary:
      "일본의 개발 직무에는 보통 '기술·인문지식·국제업무' 재류자격이 적용됩니다. 일반적으로 고용주가 재류자격인정증명서(Certificate of Eligibility)를 신청합니다.",
    points: [
      "고용주가 재류자격인정증명서(COE) 신청을 진행하는 경우가 일반적입니다.",
      "학위 또는 관련 실무경력과 직무 관련성이 요구됩니다.",
      "세부 요건은 일본 출입국재류관리청(ISA) 공식 안내를 확인하세요.",
    ],
    official: [
      { label: "출입국재류관리청(ISA) — 영문 안내", url: "https://www.isa.go.jp/en/" },
    ],
    locationKeywords: ["japan", "tokyo", "osaka", "kyoto", "fukuoka", "yokohama", "nagoya", "sapporo", "kobe", "日本", "東京", "大阪"],
  },
];

export function getVisaGuide(slug: string): VisaGuide | undefined {
  return VISA_GUIDES.find((g) => g.slug === slug);
}

// job.location 문자열에서 해당 국가 가이드를 추정(부분일치). 없으면 undefined.
export function guideForLocation(location?: string | null): VisaGuide | undefined {
  if (!location) return undefined;
  const loc = location.toLowerCase();
  return VISA_GUIDES.find((g) => g.locationKeywords.some((k) => loc.includes(k)));
}
