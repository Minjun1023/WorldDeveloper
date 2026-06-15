// 선호 지역 자동완성용 큐레이션 사전. 추천 엔진이 공고의 영문 location 문자열에 부분일치로
// 매칭하므로(예: "Berlin, Germany"), 한글이 아니라 영문 도시·국가명으로 둔다. 자유 입력도 가능.
// 우리가 다루는 목적국의 주요 테크 허브 도시 + 국가명.
export const LOCATION_VOCAB: string[] = [
  // countries (국가 단위 선호)
  "United States", "United Kingdom", "Germany", "Netherlands", "Japan", "Canada",
  "Singapore", "Ireland", "France", "Spain", "Switzerland", "Sweden", "Australia",
  "Denmark", "Norway", "Finland", "Portugal", "Belgium", "Austria", "Poland",
  // United States
  "San Francisco", "New York", "Seattle", "Austin", "Boston", "Los Angeles", "Chicago", "Remote - US",
  // United Kingdom
  "London", "Manchester", "Edinburgh", "Cambridge",
  // Germany
  "Berlin", "Munich", "Hamburg", "Frankfurt",
  // Netherlands
  "Amsterdam", "Rotterdam", "Eindhoven",
  // Japan
  "Tokyo", "Osaka", "Kyoto",
  // Canada
  "Toronto", "Vancouver", "Montreal",
  // others
  "Dublin", "Paris", "Barcelona", "Madrid", "Zurich", "Geneva", "Stockholm", "Lisbon",
  "Sydney", "Melbourne", "Copenhagen", "Helsinki", "Oslo", "Vienna", "Warsaw",
];
