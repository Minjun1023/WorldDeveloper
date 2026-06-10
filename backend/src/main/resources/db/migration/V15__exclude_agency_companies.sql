-- 채용 에이전시/인력파견사 식별. 라이브 잡/회사 쿼리에서 NOT is_agency(slug) 로 제외한다.
-- 보수적 패턴(인력파견·채용중개 용어) + 명시 덴리스트. 순수 IMMUTABLE 함수라 새로 수집되는
-- 에이전시도 자동 적용된다(저장 플래그·ETL 변경 불필요). 리스트 갱신은 CREATE OR REPLACE 로.
-- 일반 'consulting'/'interim' 은 정상 소프트웨어 회사 오탐 위험이라 패턴에서 제외했다.
CREATE OR REPLACE FUNCTION is_agency(text) RETURNS boolean
LANGUAGE sql IMMUTABLE AS $$
  SELECT $1 = ANY (ARRAY['angeheuert-gmbh', 'talenthafen-gmbh', 's-rensen-consulting-gmbh'])
      OR $1 ~ '(personalberatung|personaldienst|personalvermittlung|personalservice|zeitarbeit|recruitment|recruiting|staffing|headhunt|personalmanagement|hr-consult)';
$$;
