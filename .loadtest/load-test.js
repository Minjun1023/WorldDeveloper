import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

const BASE = __ENV.BASE || 'http://host.docker.internal:8080';
const errors = new Rate('errors');

const COMPANIES = ['databricks','coreweave','mistral','reddit','toast','sumup','verkada','palantir'];
const QUERIES = ['backend','frontend','python','react','data engineer','golang','devops',''];
const REGIONS = ['us','germany','japan','uk',''];
const SORTS = ['relevance','recent','salary','newest'];
const pick = a => a[Math.floor(Math.random()*a.length)];

export const options = {
  scenarios: { mixed: { executor: 'constant-vus', vus: 50, duration: '60s' } },
  thresholds: {
    http_req_failed: ['rate<0.01'],
    'http_req_duration{name:search}': ['p(95)<500','p(99)<1000'],
    'http_req_duration{name:company-jobs}': ['p(95)<500'],
  },
};

export default function () {
  const headers = { 'Accept-Encoding': 'gzip' };
  const r = Math.random();
  if (r < 0.7) { // 70% 검색
    const url = `${BASE}/api/v1/jobs?q=${encodeURIComponent(pick(QUERIES))}&region=${pick(REGIONS)}&sort=${pick(SORTS)}&page=${1+Math.floor(Math.random()*5)}&page_size=12`;
    const res = http.get(url, { headers, tags: { name: 'search' } });
    errors.add(!check(res, { 'search 200': x => x.status === 200 }));
  } else if (r < 0.82) { // 12% 회사 목록
    const res = http.get(`${BASE}/api/v1/companies`, { headers, tags: { name: 'companies-list' } });
    errors.add(!check(res, { 'companies 200': x => x.status === 200 }));
  } else { // 18% 회사별 공고(페이징)
    const res = http.get(`${BASE}/api/v1/companies/${pick(COMPANIES)}/jobs?page=${1+Math.floor(Math.random()*3)}&page_size=12`, { headers, tags: { name: 'company-jobs' } });
    errors.add(!check(res, { 'company-jobs 200': x => x.status === 200 }));
  }
  sleep(Math.random()*0.5 + 0.2);
}
