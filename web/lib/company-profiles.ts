// 회사 디렉터리 카드의 "설명란"용 큐레이션 데이터.
// 주요/유명 회사에 한해 사람이 직접 검수한 한 줄 소개·HQ 위치·국가를 보관한다.
// (프로젝트 원칙: 추정 금지·정확도 우선 → 자동 생성이 아닌 수기 큐레이션)
// 여기에 없는 회사는 카드에서 기존 태그 기반 문구로 폴백한다.
//
// key 는 백엔드가 내려주는 회사 slug 와 정확히 일치해야 한다(대소문자 포함).
// country 는 ISO 3166-1 alpha-2 소문자(국기 이모지용). countryLabel 로 표시 코드 override(예: gb→UK).

export interface CompanyProfile {
  /** 한 줄 소개(설명란). */
  description: string;
  /** HQ/주요 거점 위치. 없으면 카드에서 website_url 로 폴백. */
  location?: string;
  /** ISO2 소문자. 있으면 카드 푸터에 국기+코드 표시. */
  country?: string;
  /** 표시 코드 override(기본은 country 대문자). 예: gb→"UK". */
  countryLabel?: string;
}

export const COMPANY_PROFILES: Record<string, CompanyProfile> = {
  // ── readdy 레퍼런스 16곳(현재 공고 유무와 무관하게 준비) ──
  stripe: {
    description: "인터넷 경제를 위한 결제 인프라를 구축하는 글로벌 테크 기업입니다.",
    location: "San Francisco / Dublin (EU HQ)",
    country: "ie",
  },
  gitlab: {
    description: "완전 원격으로 운영되는 올인원 DevOps 플랫폼 기업입니다.",
    location: "원격 우선 (전 세계)",
  },
  klarna: {
    description: "Buy Now Pay Later(BNPL)와 결제를 제공하는 유럽 대표 핀테크입니다.",
    location: "Stockholm, Sweden",
    country: "se",
  },
  spotify: {
    description: "전 세계 수억 명이 사용하는 오디오 스트리밍 플랫폼입니다.",
    location: "Stockholm, Sweden",
    country: "se",
  },
  adyen: {
    description: "글로벌 기업이 사용하는 통합 결제 플랫폼을 운영합니다.",
    location: "Amsterdam, Netherlands",
    country: "nl",
  },
  n26: {
    description: "유럽 전역에서 서비스되는 모바일 전용 디지털 뱅크입니다.",
    location: "Berlin, Germany",
    country: "de",
  },
  miro: {
    description: "분산 팀을 위한 온라인 화이트보드 협업 플랫폼입니다.",
    location: "Amsterdam, Netherlands",
    country: "nl",
  },
  deepl: {
    description: "딥러닝 기반 초정밀 번역 엔진으로 호평받는 AI 기업입니다.",
    location: "Cologne, Germany",
    country: "de",
  },
  delivery_hero: {
    description: "40개국 이상에서 푸드 딜리버리와 퀵커머스를 운영하는 글로벌 플랫폼입니다.",
    location: "Berlin, Germany",
    country: "de",
  },
  personio: {
    description: "중소·중견 기업을 위한 올인원 HR 관리 SaaS입니다.",
    location: "Munich, Germany",
    country: "de",
  },
  celonis: {
    description: "프로세스 마이닝으로 기업 운영 효율을 혁신하는 유니콘입니다.",
    location: "Munich, Germany",
    country: "de",
  },
  revolut: {
    description: "디지털 뱅킹부터 주식·암호화폐까지 아우르는 금융 슈퍼앱입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  datadog: {
    description: "클라우드 인프라 모니터링과 옵저버빌리티의 글로벌 리더입니다.",
    location: "New York / Paris",
    country: "us",
  },
  elastic: {
    description: "Elasticsearch·Kibana 등 오픈소스 검색·분석 엔진을 개발하는 기업입니다.",
    location: "Amsterdam, Netherlands (HQ)",
    country: "nl",
  },

  // ── 현재 공고 많은 / 잘 알려진 회사 추가 큐레이션 ──
  palantir: {
    description: "빅데이터 분석 플랫폼으로 정부·기업의 의사결정을 돕는 소프트웨어 기업입니다.",
    location: "Denver, USA",
    country: "us",
  },
  anthropic: {
    description: "AI 안전성을 최우선으로 대화형 AI 'Claude'를 개발하는 연구 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  airwallex: {
    description: "글로벌 비즈니스를 위한 국경 간 결제·금융 인프라를 제공하는 핀테크입니다.",
    location: "Singapore / Melbourne",
    country: "sg",
  },
  robinhood: {
    description: "수수료 없는 주식·암호화폐 거래로 개인 투자를 대중화한 핀테크입니다.",
    location: "Menlo Park, USA",
    country: "us",
  },
  reddit: {
    description: "'인터넷의 첫 페이지'로 불리는 글로벌 커뮤니티 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  toast: {
    description: "레스토랑 운영을 위한 올인원 POS·결제 플랫폼입니다.",
    location: "Boston, USA",
    country: "us",
  },
  instacart: {
    description: "북미 최대 규모의 식료품 배달·픽업 마켓플레이스입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  mongodb: {
    description: "개발자 친화적 도큐먼트 데이터베이스를 제공하는 글로벌 DB 기업입니다.",
    location: "New York, USA",
    country: "us",
  },
  clickhouse: {
    description: "실시간 분석에 특화된 초고속 컬럼형 오픈소스 데이터베이스입니다.",
    location: "Amsterdam / San Francisco",
    country: "us",
  },
  harvey: {
    description: "법률 전문가를 위한 생성형 AI 어시스턴트를 만드는 리걸테크 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  databricks: {
    description: "데이터와 AI를 통합한 레이크하우스 플랫폼을 만든 데이터 분석 리더입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  twilio: {
    description: "앱에 통신 기능을 더하는 클라우드 커뮤니케이션 API 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  discord: {
    description: "게이머와 커뮤니티를 위한 음성·채팅 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  "woven-by-toyota": {
    description: "토요타의 소프트웨어와 자율주행을 이끄는 모빌리티 테크 자회사입니다.",
    location: "Tokyo, Japan",
    country: "jp",
  },
  mistral: {
    description: "유럽을 대표하는 오픈웨이트 거대언어모델(LLM)을 개발하는 AI 기업입니다.",
    location: "Paris, France",
    country: "fr",
  },
  ServiceNow: {
    description: "기업 업무 흐름을 자동화하는 엔터프라이즈 워크플로우 SaaS입니다.",
    location: "Santa Clara, USA",
    country: "us",
  },
  lyft: {
    description: "북미에서 차량 호출·모빌리티 서비스를 운영하는 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  agoda: {
    description: "아시아 기반의 글로벌 숙박·항공 예약 플랫폼입니다.",
    location: "Singapore / Bangkok",
    country: "sg",
  },
  cursor: {
    description: "AI 페어 프로그래밍을 내장한 차세대 코드 에디터를 만드는 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  cohere: {
    description: "기업용 거대언어모델과 RAG 솔루션을 제공하는 AI 기업입니다.",
    location: "Toronto, Canada",
    country: "ca",
  },
  pinterest: {
    description: "영감과 아이디어를 발견하는 비주얼 디스커버리 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  plaid: {
    description: "금융 앱과 은행 계좌를 안전하게 연결하는 핀테크 인프라입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  dropbox: {
    description: "파일 동기화와 협업을 지원하는 클라우드 스토리지 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  "1password": {
    description: "개인과 기업을 위한 비밀번호·자격증명 관리 솔루션입니다.",
    location: "Toronto, Canada",
    country: "ca",
  },
  perplexity: {
    description: "출처를 함께 제시하는 답변형 AI 검색 엔진입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  sentry: {
    description: "애플리케이션 오류와 성능을 추적하는 개발자용 모니터링 도구입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  postman: {
    description: "API 설계·테스트·협업을 한 곳에서 처리하는 개발 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  vanta: {
    description: "보안 컴플라이언스 인증을 자동화하는 SaaS입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  mollie: {
    description: "유럽 중소상공인을 위한 간편 온라인 결제 솔루션입니다.",
    location: "Amsterdam, Netherlands",
    country: "nl",
  },
  contentful: {
    description: "여러 채널에 콘텐츠를 전달하는 헤드리스 CMS 플랫폼입니다.",
    location: "Berlin, Germany",
    country: "de",
  },
  doctolib: {
    description: "유럽 최대 규모의 의료 예약·진료 플랫폼입니다.",
    location: "Paris, France",
    country: "fr",
  },
  trustpilot: {
    description: "전 세계 소비자 리뷰를 모은 신뢰도 평가 플랫폼입니다.",
    location: "Copenhagen, Denmark",
    country: "dk",
  },
  gocardless: {
    description: "정기 결제와 계좌이체에 특화된 핀테크입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  Visa: {
    description: "전 세계를 잇는 글로벌 결제 네트워크 기업입니다.",
    location: "Foster City, USA",
    country: "us",
  },
  paypay: {
    description: "일본 최대 규모의 QR 간편결제 핀테크 앱입니다.",
    location: "Tokyo, Japan",
    country: "jp",
  },
  dataiku: {
    description: "데이터 사이언스와 머신러닝을 위한 엔터프라이즈 플랫폼입니다.",
    location: "Paris / New York",
    country: "fr",
  },
  sumup: {
    description: "소상공인을 위한 모바일 결제 단말과 금융 서비스를 제공합니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  ASOS: {
    description: "영국 기반의 글로벌 온라인 패션 리테일러입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  figma: {
    description: "브라우저에서 함께 작업하는 협업형 인터페이스 디자인 툴입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  n8n: {
    description: "코드와 노코드를 결합한 워크플로우 자동화 오픈소스 플랫폼입니다.",
    location: "Berlin, Germany",
    country: "de",
  },
  elevenlabs: {
    description: "초현실적 AI 음성 합성 기술을 만드는 기업입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  xai: {
    description: "대화형 AI 'Grok'을 개발하는 일론 머스크의 AI 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  writer: {
    description: "기업용 생성형 AI 글쓰기·업무 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  replit: {
    description: "브라우저에서 바로 개발·배포하는 협업 코딩 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  blablacar: {
    description: "유럽 최대 규모의 장거리 카풀·이동 플랫폼입니다.",
    location: "Paris, France",
    country: "fr",
  },
  "wolt-english": {
    description: "북유럽에서 시작한 음식·리테일 배달 플랫폼입니다.",
    location: "Helsinki, Finland",
    country: "fi",
  },
  Grab: {
    description: "동남아시아를 대표하는 모빌리티·배달·핀테크 슈퍼앱입니다.",
    location: "Singapore",
    country: "sg",
  },
  nium: {
    description: "글로벌 송금과 결제를 잇는 핀테크 인프라 기업입니다.",
    location: "Singapore",
    country: "sg",
  },
  scout24: {
    description: "독일 최대 부동산·자동차 온라인 마켓플레이스입니다.",
    location: "Berlin, Germany",
    country: "de",
  },
  typeform: {
    description: "대화하듯 응답을 받는 인터랙티브 폼·설문 빌더입니다.",
    location: "Barcelona, Spain",
    country: "es",
  },
  pleo: {
    description: "유럽 기업을 위한 법인카드·지출관리 핀테크입니다.",
    location: "Copenhagen, Denmark",
    country: "dk",
  },
  supabase: {
    description: "오픈소스 Firebase 대안을 표방하는 백엔드 개발 플랫폼입니다.",
    location: "원격 우선 (전 세계)",
  },
  okta: {
    description: "기업용 아이덴티티·접근 관리(IAM)의 클라우드 리더입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  twitch: {
    description: "실시간 게임·라이브 스트리밍 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  deel: {
    description: "글로벌 채용·급여·HR을 한 곳에서 처리하는 플랫폼입니다.",
    location: "원격 우선 (San Francisco)",
    country: "us",
  },
  grafanalabs: {
    description: "오픈소스 관측가능성 스택 'Grafana'를 만드는 기업입니다.",
    location: "New York / 원격",
    country: "us",
  },
  confluent: {
    description: "Apache Kafka 기반의 데이터 스트리밍 플랫폼입니다.",
    location: "Mountain View, USA",
    country: "us",
  },
  vercel: {
    description: "Next.js를 만든 프런트엔드 배포·웹 개발 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  cloudflare: {
    description: "글로벌 CDN과 엣지 보안·인프라를 제공하는 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  airbnb: {
    description: "전 세계 숙박과 체험을 잇는 글로벌 트래블 마켓플레이스입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  monzo: {
    description: "영국의 모바일 전용 디지털 뱅크입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  algolia: {
    description: "사이트와 앱을 위한 호스티드 검색·디스커버리 API입니다.",
    location: "Paris / San Francisco",
    country: "fr",
  },
  wise: {
    description: "국경 간 송금을 저렴하고 투명하게 만든 핀테크입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },

  // ── 위치가 지역명(Europe/Global/Remote 등)으로만 집계되어 국기가 안 잡히던 회사들 ──
  //    실제 본사를 웹 출처로 확인해 큐레이션(추정 금지·정확도 우선).
  synthesia: {
    description: "텍스트로 AI 아바타 영상을 생성하는 생성형 영상 플랫폼입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  improbable: {
    description: "대규모 가상세계·시뮬레이션 인프라를 개발하는 테크 기업입니다.",
    location: "London, UK",
    country: "gb",
    countryLabel: "UK",
  },
  wayflyer: {
    description: "이커머스 브랜드를 위한 매출 기반 자금조달을 제공하는 핀테크입니다.",
    location: "Dublin, Ireland",
    country: "ie",
  },
  montecarlodata: {
    description: "데이터 신뢰성을 모니터링하는 데이터 옵저버빌리티 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  alpaca: {
    description: "개발자를 위한 주식·암호화폐 거래 API를 제공하는 핀테크입니다.",
    location: "San Mateo, USA",
    country: "us",
  },
  railway: {
    description: "코드를 손쉽게 클라우드에 배포하는 인프라 플랫폼입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  thumbtack: {
    description: "지역 서비스 전문가와 고객을 연결하는 마켓플레이스입니다.",
    location: "San Francisco, USA",
    country: "us",
  },
  coreweave: {
    description: "GPU 클라우드로 AI·머신러닝 컴퓨팅 인프라를 제공하는 기업입니다.",
    location: "Livingston, NJ",
    country: "us",
  },
  verkada: {
    description: "클라우드 기반 CCTV·출입통제 등 물리 보안 플랫폼 기업입니다.",
    location: "San Mateo, CA",
    country: "us",
  },
  crusoe: {
    description: "남는 에너지로 AI·클라우드 컴퓨팅을 돌리는 인프라 기업입니다.",
    location: "San Francisco, USA",
    country: "us",
  },

  // ── 누락 보강: 노출 회사 한 줄 소개(수기 검수, 공고 많은 순). 정확히 아는 곳만 추가. ──
  affirm: { description: "분할 납부(BNPL)와 결제를 제공하는 미국 핀테크입니다.", location: "San Francisco, USA", country: "us" },
  intercom: { description: "고객 지원·메시징(AI 에이전트 Fin)을 제공하는 SaaS 기업입니다.", location: "San Francisco / Dublin", country: "us" },
  scaleai: { description: "AI 모델 학습용 데이터 라벨링·평가를 제공하는 기업입니다.", location: "San Francisco, USA", country: "us" },
  appier: { description: "아시아 기반의 AI 마케팅·의사결정 SaaS 기업입니다.", location: "Taipei, Taiwan", country: "tw" },
  graphcore: { description: "AI 가속기(IPU)를 만드는 영국 반도체 기업입니다.", location: "Bristol, UK", country: "gb" },
  brex: { description: "스타트업·기업용 법인카드와 지출관리를 제공하는 핀테크입니다.", location: "San Francisco, USA", country: "us" },
  gleanwork: { description: "기업용 AI 검색·어시스턴트를 제공하는 기업입니다.", location: "Mountain View, USA", country: "us" },
  coinbase: { description: "미국 대표 암호화폐 거래소이자 디지털 자산 플랫폼입니다.", location: "Remote (USA)", country: "us" },
  drata: { description: "보안 컴플라이언스(SOC 2 등)를 자동화하는 SaaS 기업입니다.", location: "San Diego, USA", country: "us" },
  sigmacomputing: { description: "클라우드 데이터 웨어하우스용 BI·분석 도구입니다.", location: "San Francisco, USA", country: "us" },
  upstart: { description: "AI 신용평가로 대출을 중개하는 핀테크입니다.", location: "San Mateo, USA", country: "us" },
  moneyforward: { description: "일본의 가계·기업 재무 관리 SaaS를 제공하는 핀테크입니다.", location: "Tokyo, Japan", country: "jp" },
  chime: { description: "수수료 없는 모바일 뱅킹을 제공하는 미국 네오뱅크입니다.", location: "San Francisco, USA", country: "us" },
  sofi: { description: "대출·투자·뱅킹을 아우르는 미국 종합 핀테크입니다.", location: "San Francisco, USA", country: "us" },
  baseten: { description: "머신러닝 모델 배포·서빙 인프라를 제공하는 기업입니다.", location: "San Francisco, USA", country: "us" },
  ramp: { description: "법인카드와 지출·경비 자동화를 제공하는 핀테크입니다.", location: "New York, USA", country: "us" },
  temporaltechnologies: { description: "내구성 있는 워크플로 실행 오픈소스·플랫폼 기업입니다.", location: "Seattle, USA", country: "us" },
  fal: { description: "생성형 AI(이미지·영상) 추론 인프라를 제공합니다.", location: "San Francisco, USA", country: "us" },
  bitpanda: { description: "유럽의 암호화폐·자산 투자 플랫폼입니다.", location: "Vienna, Austria", country: "at" },
  deepgram: { description: "음성 인식(STT) AI API를 제공하는 기업입니다.", location: "San Francisco, USA", country: "us" },
  justworks: { description: "중소기업용 인사·급여(PEO) SaaS입니다.", location: "New York, USA", country: "us" },
  gusto: { description: "중소기업용 급여·인사·복지 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  samsara: { description: "차량·장비를 연결하는 IoT 운영 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  amplitude: { description: "제품 사용 행동 분석(Analytics) SaaS입니다.", location: "San Francisco, USA", country: "us" },
  oscar: { description: "기술 기반의 미국 건강보험 기업입니다.", location: "New York, USA", country: "us" },
  mercor: { description: "AI로 채용·인재 매칭을 하는 기업입니다.", location: "San Francisco, USA", country: "us" },
  benchling: { description: "생명과학 R&D를 위한 클라우드 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  betterment: { description: "자동화 자산관리(로보어드바이저) 핀테크입니다.", location: "New York, USA", country: "us" },
  checkr: { description: "AI 기반 채용 신원조회(백그라운드 체크) 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  asana: { description: "팀 업무·프로젝트 관리 SaaS입니다.", location: "San Francisco, USA", country: "us" },
  chainguard: { description: "컨테이너 이미지·소프트웨어 공급망 보안 기업입니다.", location: "Remote (USA)", country: "us" },
  faire: { description: "지역 소매점과 브랜드를 잇는 도매 마켓플레이스입니다.", location: "San Francisco, USA", country: "us" },
  abnormalsecurity: { description: "AI 기반 이메일 보안 기업입니다.", location: "San Francisco, USA", country: "us" },
  fireworksai: { description: "생성형 AI 모델 추론·서빙 플랫폼입니다.", location: "San Mateo, USA", country: "us" },
  freetrade: { description: "영국의 수수료 없는 주식 투자 앱입니다.", location: "London, UK", country: "gb" },
  cribl: { description: "관측성 데이터(로그·텔레메트리) 파이프라인 기업입니다.", location: "San Francisco, USA", country: "us" },
  lendable: { description: "영국의 소비자 대출 핀테크입니다.", location: "London, UK", country: "gb" },
  fivetran: { description: "자동화 데이터 통합(ELT) 파이프라인 기업입니다.", location: "Oakland, USA", country: "us" },
  cresta: { description: "콜센터·CX를 위한 생성형 AI 기업입니다.", location: "San Francisco, USA", country: "us" },
  nextdoor: { description: "동네 이웃 기반 소셜 네트워크입니다.", location: "San Francisco, USA", country: "us" },
  patreon: { description: "창작자가 팬에게 후원받는 멤버십 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  airtable: { description: "스프레드시트·데이터베이스 결합형 협업 SaaS입니다.", location: "San Francisco, USA", country: "us" },
  singlestore: { description: "실시간 분석용 분산 데이터베이스입니다.", location: "San Francisco, USA", country: "us" },
  multiverse: { description: "영국의 견습·직무교육(에듀테크) 기업입니다.", location: "London, UK", country: "gb" },
  angellist: { description: "스타트업 투자·운영을 돕는 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  fireblocks: { description: "기관용 디지털 자산 보안·인프라 기업입니다.", location: "New York, USA", country: "us" },
  rubrik: { description: "데이터 보안·백업·복구 기업입니다.", location: "Palo Alto, USA", country: "us" },
  modal: { description: "서버리스 GPU·AI 컴퓨트 인프라를 제공합니다.", location: "New York, USA", country: "us" },
  semgrep: { description: "코드 정적분석·보안(SAST) 도구입니다.", location: "San Francisco, USA", country: "us" },
  mavenclinic: { description: "여성·가족 건강을 위한 디지털 헬스케어입니다.", location: "New York, USA", country: "us" },
  catawiki: { description: "유럽의 수집품 경매 마켓플레이스입니다.", location: "Amsterdam, Netherlands", country: "nl" },
  planetscale: { description: "서버리스 MySQL(Vitess 기반) 데이터베이스입니다.", location: "San Francisco, USA", country: "us" },
  paddle: { description: "SaaS를 위한 결제·세금·구독 관리(MoR) 플랫폼입니다.", location: "London, UK", country: "gb" },
  mixpanel: { description: "제품·사용자 행동 분석 SaaS입니다.", location: "San Francisco, USA", country: "us" },
  wolt: { description: "핀란드 기반의 음식·물류 배달 플랫폼입니다.", location: "Helsinki, Finland", country: "fi" },
  highnote: { description: "카드 발급(이슈잉) 인프라를 제공하는 핀테크입니다.", location: "San Francisco, USA", country: "us" },
  "thought-machine": { description: "클라우드 네이티브 코어뱅킹 플랫폼입니다.", location: "London, UK", country: "gb" },
  outreach: { description: "영업 참여(Sales Engagement) SaaS입니다.", location: "Seattle, USA", country: "us" },
  bitbank: { description: "일본의 암호화폐 거래소입니다.", location: "Tokyo, Japan", country: "jp" },
  anyscale: { description: "Ray 기반 AI·분산 컴퓨팅 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  carta: { description: "비상장 주식·지분(캡테이블) 관리 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  runpod: { description: "GPU 클라우드(AI 학습·추론) 인프라를 제공합니다.", location: "Remote (USA)", country: "us" },
  pendo: { description: "제품 분석·사용자 온보딩 SaaS입니다.", location: "Raleigh, USA", country: "us" },
  astronomer: { description: "Apache Airflow 기반 데이터 오케스트레이션 기업입니다.", location: "New York, USA", country: "us" },
  airbyte: { description: "오픈소스 데이터 통합(ELT) 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  quantexa: { description: "의사결정 인텔리전스(데이터·AI) 기업입니다.", location: "London, UK", country: "gb" },
  infisical: { description: "오픈소스 시크릿(비밀키) 관리 기업입니다.", location: "San Francisco, USA", country: "us" },
  betterup: { description: "직장인 코칭·멘탈 헬스 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  squarespace: { description: "웹사이트·온라인 스토어 제작 플랫폼입니다.", location: "New York, USA", country: "us" },
  form3: { description: "은행·핀테크용 클라우드 결제 처리 플랫폼입니다.", location: "London, UK", country: "gb" },
  finix: { description: "결제 처리·인프라를 제공하는 핀테크입니다.", location: "San Francisco, USA", country: "us" },
  flexport: { description: "글로벌 물류·화물 운송(디지털 포워더) 기업입니다.", location: "San Francisco, USA", country: "us" },
  fullstory: { description: "디지털 경험 분석(세션 리플레이) SaaS입니다.", location: "Atlanta, USA", country: "us" },
  salesloft: { description: "영업 참여(Sales Engagement) 플랫폼입니다.", location: "Atlanta, USA", country: "us" },
  marshmallow: { description: "영국의 자동차 보험 핀테크입니다.", location: "London, UK", country: "gb" },
  mercari: { description: "일본 최대의 중고거래 마켓플레이스입니다.", location: "Tokyo, Japan", country: "jp" },
  beamery: { description: "AI 기반 인재 채용·관리(Talent) SaaS입니다.", location: "London, UK", country: "gb" },
  assemblyai: { description: "음성 인식·이해 AI API를 제공합니다.", location: "San Francisco, USA", country: "us" },
  imbue: { description: "추론 능력에 집중하는 AI 연구·개발 기업입니다.", location: "San Francisco, USA", country: "us" },
  descript: { description: "AI 기반 오디오·비디오 편집 도구입니다.", location: "San Francisco, USA", country: "us" },
  decagon: { description: "고객 지원용 AI 에이전트를 만드는 기업입니다.", location: "San Francisco, USA", country: "us" },
  billcom: { description: "중소기업용 청구·지급(AP/AR) 자동화 핀테크입니다.", location: "San Jose, USA", country: "us" },
  voodoo: { description: "프랑스의 하이퍼캐주얼 모바일 게임 기업입니다.", location: "Paris, France", country: "fr" },
  gongio: { description: "영업 대화 분석(Revenue Intelligence) AI SaaS입니다.", location: "San Francisco, USA", country: "us" },
  marqeta: { description: "카드 발급(이슈잉) API를 제공하는 핀테크입니다.", location: "Oakland, USA", country: "us" },
  vannevarlabs: { description: "국가안보·정보 분석용 AI를 만드는 미국 기업입니다.", location: "Remote (USA)", country: "us" },
  ledger: { description: "하드웨어 암호화폐 지갑을 만드는 프랑스 기업입니다.", location: "Paris, France", country: "fr" },
  circleci: { description: "CI/CD(지속적 통합·배포) 개발자 플랫폼입니다.", location: "San Francisco, USA", country: "us" },
  moderntreasury: { description: "자금 이동·결제 운영(Payment Ops) 핀테크입니다.", location: "San Francisco, USA", country: "us" },
  pagerduty: { description: "장애 대응·온콜(인시던트) 관리 SaaS입니다.", location: "San Francisco, USA", country: "us" },
};

/** ISO2(소문자/대문자) → 국기 이모지. 유효하지 않으면 빈 문자열. */
export function flagEmoji(iso2?: string): string {
  if (!iso2 || iso2.length !== 2) return "";
  return iso2
    .toUpperCase()
    .replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

/** 회사 slug 의 큐레이션 프로필(없으면 undefined). */
export function companyProfile(slug: string): CompanyProfile | undefined {
  return COMPANY_PROFILES[slug];
}
