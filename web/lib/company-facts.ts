// 회사 사실(직원 규모·업종·설립연도·본사) — Wikidata(CC0) 에서 보강한 데이터.
// scripts/enrich_companies_wikidata.py 로 생성하고, 정직성을 위해 사람이 git diff 로 검수한다.
// (추정 금지: 신뢰 매칭만 채택. 없는 회사는 사실 패널을 표시하지 않는다.)

export interface CompanyFacts {
  /** Wikidata QID(출처 링크·검수용). */
  wikidataId: string;
  /** 직원 수(특정 시점 추정치). */
  employees?: number | null;
  /** 직원 수 기준 연도. */
  employeesYear?: string | null;
  /** 업종(영문 라벨, 표시 시 한국어 매핑). */
  industry?: string | null;
  /** 설립 연도. */
  founded?: string | null;
  /** 본사 도시. */
  hq?: string | null;
  /** 본사 국가. */
  country?: string | null;
  /** 공식 웹사이트. */
  website?: string | null;
}

export const COMPANY_FACTS: Record<string, CompanyFacts> = {
  "adyen": { wikidataId: "Q4686934", industry: "mobile payment industry", founded: "2006", hq: "Amsterdam", country: "Netherlands", website: "https://www.adyen.com/" },
  "affirm": { wikidataId: "Q65085822", industry: "fintech", founded: "2012", hq: "San Francisco", country: "United States", website: "https://www.affirm.com/" },
  "airbnb": { wikidataId: "Q63327", employees: 5597, employeesYear: "2020", industry: "tourism industry", founded: "2008", hq: "New York City", country: "United States", website: "https://www.airbnb.com/" },
  "airbyte": { wikidataId: "Q136502716", industry: "software industry" },
  "airtable": { wikidataId: "Q23016614", founded: "2012", website: "https://airtable.com" },
  "airwallex": { wikidataId: "Q62493969", industry: "business-to-business", founded: "2015", hq: "Hong Kong", website: "https://www.airwallex.com/" },
  "algolia": { wikidataId: "Q17150241", founded: "2012", hq: "Paris", country: "France", website: "http://www.algolia.com" },
  "amplitude": { wikidataId: "Q81969219", country: "United States", website: "https://amplitude.com/" },
  "angellist": { wikidataId: "Q4762034", founded: "2010", hq: "San Francisco", country: "United States", website: "https://angel.co/" },
  "anyscale": { wikidataId: "Q116413452", industry: "software industry", hq: "San Francisco", country: "United States", website: "https://www.anyscale.com/" },
  "appier": { wikidataId: "Q56272861", industry: "technology industry", founded: "2012", hq: "Taipei", website: "https://www.appier.com/" },
  "asos": { wikidataId: "Q211951", industry: "clothing industry", founded: "2000", hq: "London", country: "United Kingdom", website: "https://www.asos.com" },
  "beamery": { wikidataId: "Q116675044", website: "https://beamery.com/" },
  "benchling": { wikidataId: "Q63417942", founded: "2012", hq: "San Francisco", country: "United States", website: "https://www.benchling.com/" },
  "betterup": { wikidataId: "Q106143931", founded: "2013", hq: "San Francisco", country: "United States", website: "https://www.betterup.com/" },
  "bitbank": { wikidataId: "Q107411730", founded: "2014", hq: "Tokyo", country: "Japan", website: "http://bitcoinbank.co.jp/" },
  "bitpanda": { wikidataId: "Q109391386", industry: "fintech", founded: "2014", hq: "Vienna", country: "Austria", website: "https://www.bitpanda.com/en" },
  "brex": { wikidataId: "Q60741065", industry: "fintech", founded: "2017", hq: "San Francisco", country: "United States", website: "http://brex.com/" },
  "celonis": { wikidataId: "Q63725648", hq: "Munich", country: "Germany", website: "https://www.celonis.com/" },
  "chime": { wikidataId: "Q85752013", industry: "financial services", founded: "2013", hq: "San Francisco", country: "United States", website: "http://chime.com/" },
  "circleci": { wikidataId: "Q38922434", industry: "software development", founded: "2011", hq: "San Francisco", country: "United States", website: "https://circleci.com/" },
  "cohere": { wikidataId: "Q110363143", founded: "2019", hq: "Toronto", country: "Canada", website: "https://cohere.com/" },
  "coinbase": { wikidataId: "Q16972754", employees: 1249, employeesYear: "2020", industry: "Bitcoin", founded: "2012", hq: "San Francisco", country: "United States", website: "https://www.coinbase.com" },
  "confluent": { wikidataId: "Q94758727", hq: "Mountain View", country: "United States", website: "http://www.confluent.io/" },
  "contentful": { wikidataId: "Q18348837", founded: "2011", hq: "Berlin", country: "Germany", website: "https://www.contentful.com" },
  "coreweave": { wikidataId: "Q121875386", founded: "2017", hq: "Roseland", country: "United States", website: "https://www.coreweave.com/" },
  "cribl": { wikidataId: "Q125148774", country: "United States", website: "https://cribl.io" },
  "databricks": { wikidataId: "Q18350420", employees: 4000, employeesYear: "2022", industry: "software industry", founded: "2013", hq: "San Francisco", country: "United States", website: "http://databricks.com/" },
  "datadog": { wikidataId: "Q16248637", industry: "IT performance management", founded: "2010", hq: "New York City", country: "United States", website: "https://www.datadoghq.com/" },
  "dataiku": { wikidataId: "Q24940442", industry: "software industry", founded: "2013", hq: "Paris", country: "France", website: "http://www.dataiku.com/" },
  "deepgram": { wikidataId: "Q115770008", hq: "San Francisco", country: "United States", website: "https://deepgram.com/" },
  "discord": { wikidataId: "Q30753174", founded: "2012", hq: "San Francisco", country: "United States", website: "https://discordapp.com/company" },
  "dropbox": { wikidataId: "Q142539", industry: "cloud storage", founded: "2007", country: "United States", website: "https://www.dropbox.com" },
  "elastic": { wikidataId: "Q22074922", industry: "software industry", founded: "2012", hq: "Mountain View", country: "United States", website: "https://www.elastic.co" },
  "figma": { wikidataId: "Q138548226", industry: "software industry", founded: "2012", hq: "San Francisco", country: "United States", website: "https://figma.com" },
  "finix": { wikidataId: "Q140050410", industry: "fintech", founded: "2015", hq: "San Francisco", country: "United States", website: "https://finix.com" },
  "fireblocks": { wikidataId: "Q108896760", industry: "fintech", founded: "2018", hq: "Tel Aviv", country: "Israel", website: "https://www.fireblocks.com/" },
  "fivetran": { wikidataId: "Q109827378", country: "United States", website: "https://fivetran.com" },
  "flexport": { wikidataId: "Q23016856", employees: 2082, employeesYear: "2026", founded: "2013", hq: "San Francisco", country: "United States", website: "https://www.flexport.com" },
  "freetrade": { wikidataId: "Q65065185", industry: "fintech", founded: "2015", website: "https://freetrade.io/" },
  "gitlab": { wikidataId: "Q55589254", founded: "2011", hq: "San Francisco", country: "United States", website: "https://about.gitlab.com/company/" },
  "gocardless": { wikidataId: "Q111418549", industry: "fintech", country: "United Kingdom", website: "https://gocardless.com/" },
  "graphcore": { wikidataId: "Q38251361", industry: "semiconductor industry", founded: "2016", hq: "Bristol", website: "https://www.graphcore.ai/" },
  "gusto": { wikidataId: "Q20540697", industry: "human resource management", founded: "2011", hq: "San Francisco", country: "United States", website: "https://gusto.com" },
  "improbable": { wikidataId: "Q50079115", industry: "video game industry", founded: "2012", hq: "London", country: "United Kingdom", website: "https://www.improbable.io/" },
  "instacart": { wikidataId: "Q22909236", industry: "retail", founded: "2012", hq: "San Francisco", country: "United States", website: "https://instacart.com/" },
  "intercom": { wikidataId: "Q48965215", founded: "2011", country: "United States", website: "http://www.intercom.com/" },
  "ledger": { wikidataId: "Q65770312", employees: 700, industry: "fintech", founded: "2011", hq: "Paris", country: "France", website: "https://www.ledger.com/" },
  "lyft": { wikidataId: "Q17077936", industry: "taxi service", founded: "2013", hq: "San Francisco", country: "United States", website: "https://www.lyft.com/" },
  "marqeta": { wikidataId: "Q97498243", industry: "fintech", founded: "2010", hq: "Oakland", country: "United States", website: "https://www.marqeta.com/" },
  "mercari": { wikidataId: "Q21019721", industry: "e-commerce", founded: "2013", hq: "Tokyo", country: "Japan", website: "http://mercari.jp/" },
  "mixpanel": { wikidataId: "Q25048114", industry: "analytics", founded: "2009", hq: "San Francisco", country: "United States", website: "http://mixpanel.com" },
  "mongodb": { wikidataId: "Q4546965", employees: 5640, employeesYear: "2025", industry: "software industry", founded: "2007", hq: "New York City", country: "United States", website: "https://www.mongodb.com/" },
  "monzo": { wikidataId: "Q25206290", industry: "financial services", founded: "2015", hq: "United Kingdom", country: "United Kingdom", website: "https://monzo.com" },
  "n26": { wikidataId: "Q27479372", employees: 1500, employeesYear: "2021", industry: "financial services", founded: "2013", hq: "Berlin", country: "Germany", website: "https://n26.com/" },
  "nextdoor": { wikidataId: "Q7021239", employees: 704, employeesYear: "2022", founded: "2011", hq: "San Francisco", country: "United States", website: "https://nextdoor.com/" },
  "nium": { wikidataId: "Q43080755", hq: "Singapore", website: "https://www.nium.com/" },
  "pagerduty": { wikidataId: "Q48989804", industry: "information technology", founded: "2009", hq: "San Francisco", country: "United States", website: "http://www.pagerduty.com" },
  "palantir": { wikidataId: "Q2047336", employees: 2920, employeesYear: "2021", industry: "data analytics software industry", founded: "2003", hq: "Palo Alto", country: "United States", website: "https://www.palantir.com/" },
  "paypay": { wikidataId: "Q56348149", founded: "2018", hq: "Chiyoda", country: "Japan", website: "https://about.paypay.ne.jp/" },
  "pinterest": { wikidataId: "Q255381", founded: "2010", hq: "Palo Alto", country: "United States", website: "https://www.pinterest.com/" },
  "plaid": { wikidataId: "Q30610132", industry: "fintech", founded: "2013", hq: "San Francisco", country: "United States", website: "https://plaid.com/" },
  "postman": { wikidataId: "Q105538901", founded: "2013", country: "India", website: "https://www.postman.com" },
  "reddit": { wikidataId: "Q111759432", founded: "2005", hq: "San Francisco", country: "United States", website: "https://www.redditinc.com/" },
  "replit": { wikidataId: "Q60768699", hq: "San Francisco", country: "United States", website: "https://repl.it" },
  "robinhood": { wikidataId: "Q18155123", industry: "financial services", founded: "2013", hq: "Palo Alto", country: "United States", website: "https://www.robinhood.com" },
  "rubrik": { wikidataId: "Q55632076", employees: 2500, employeesYear: "2022", industry: "computer storage media", founded: "2013", hq: "Palo Alto", country: "United States", website: "https://www.rubrik.com/" },
  "salesloft": { wikidataId: "Q7404299", founded: "2011", hq: "Atlanta", country: "United States", website: "http://www.salesloft.com/" },
  "semgrep": { wikidataId: "Q124512828", website: "https://semgrep.dev/" },
  "servicenow": { wikidataId: "Q7455653", employees: 10371, employeesYear: "2019", industry: "enterprise software", founded: "2004", hq: "Santa Clara", country: "United States", website: "https://www.servicenow.com" },
  "singlestore": { wikidataId: "Q15275385", founded: "2013", hq: "San Francisco", country: "United States", website: "http://www.memsql.com/" },
  "spotify": { wikidataId: "Q689141", founded: "2006", website: "https://www.spotify.com" },
  "squarespace": { wikidataId: "Q7582097", founded: "2004", hq: "New York City", country: "United States", website: "https://www.squarespace.com" },
  "stripe": { wikidataId: "Q7624104", employees: 8000, employeesYear: "2022", industry: "financial services", founded: "2010", hq: "San Francisco", country: "United States", website: "https://stripe.com" },
  "sumup": { wikidataId: "Q30589666", industry: "fintech", founded: "2011", hq: "London", country: "United Kingdom", website: "https://www.sumup.com/" },
  "synthesia": { wikidataId: "Q117322900", founded: "2017", hq: "London", country: "United Kingdom", website: "https://www.synthesia.io" },
  "thought-machine": { wikidataId: "Q120972962", country: "United Kingdom", website: "https://www.thoughtmachine.net/" },
  "thumbtack": { wikidataId: "Q7798846", founded: "2009", hq: "San Francisco", country: "United States", website: "http://www.thumbtack.com/" },
  "trustpilot": { wikidataId: "Q7848226", founded: "2007", hq: "Copenhagen", country: "Denmark", website: "https://www.trustpilot.com/" },
  "twilio": { wikidataId: "Q7858039", industry: "Voice over IP", founded: "2008", hq: "San Francisco", country: "United States", website: "http://www.twilio.com/" },
  "twitch": { wikidataId: "Q4555537", founded: "2011", hq: "San Francisco", country: "United States", website: "https://www.twitch.tv/" },
  "verkada": { wikidataId: "Q106059747", hq: "San Mateo", country: "United States", website: "https://verkada.com/" },
  "visa": { wikidataId: "Q328840", employees: 31600, employeesYear: "2024", industry: "financial services", founded: "1958", hq: "San Francisco", country: "United States", website: "https://corporate.visa.com/" },
  "wayflyer": { wikidataId: "Q131425534", industry: "banking system", hq: "Dublin" },
  "woven-by-toyota": { wikidataId: "Q105653997", industry: "automotive industry", founded: "2021", hq: "Chūō", country: "Japan", website: "https://www.woven-planet.global/" },
};
