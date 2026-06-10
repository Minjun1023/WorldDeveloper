from dev_jobs_core.filter import is_dev_role


def test_keeps_engineering_titles():
    assert is_dev_role("Senior Backend Engineer")
    assert is_dev_role("Software Developer")
    assert is_dev_role("DevOps / SRE")
    assert is_dev_role("Machine Learning Engineer")


def test_keeps_strong_signals_without_word_engineer():
    # 'engineer' 단어가 없어도 강한 개발 신호면 keep
    assert is_dev_role("Site Reliability (SRE)")
    assert is_dev_role("Data Scientist, Search")
    assert is_dev_role("AI Research Scientist - DAIR")
    assert is_dev_role("Senior Software Architect")
    assert is_dev_role("Softwareentwickler (m/w/d)")  # 독일어


def test_keeps_generic_x_engineer_and_architect():
    # strong/deny 에 안 걸린 'X Engineer'/architect 는 keep
    assert is_dev_role("Security Engineer")
    assert is_dev_role("Platform Engineer")
    assert is_dev_role("Cloud Architect")
    assert is_dev_role("Engineering Manager")          # bare manager 아님
    assert is_dev_role("Analytics Engineer")           # 'analyst' 아님(analytics)


def test_software_wins_over_solutions_team_name():
    # 팀명이 'Solutions Engineering' 이어도 software 신호가 있으면 keep
    assert is_dev_role("Senior Software Engineer II, Ads Data Solutions Engineering")


def test_drops_presales_and_non_software_engineers():
    assert not is_dev_role("Senior Solutions Engineer - Mid Market")
    assert not is_dev_role("Principal Solution Engineer, Enterprise")
    assert not is_dev_role("Sales Engineer")
    assert not is_dev_role("Data Center Mechanical Engineer")
    assert not is_dev_role("Data Center Electrical Engineer")
    assert not is_dev_role("Field Engineer")


def test_drops_sales_legal_recruiting():
    assert not is_dev_role("Account Executive (Sales)")
    assert not is_dev_role("Commercial Account Exec")
    assert not is_dev_role("Technical Recruiter")
    assert not is_dev_role("Recruitment Consultant (m/w/d)")
    assert not is_dev_role("Litigation Counsel")
    assert not is_dev_role("Associate Product Counsel")


def test_drops_finance_accounting_ops():
    assert not is_dev_role("Director, Technical Revenue Accounting")
    assert not is_dev_role("Senior Indirect Tax Analyst")
    assert not is_dev_role("Accounts Receivable Analyst")
    assert not is_dev_role("Finanzbuchhalter (m/w/d)")   # 독일어 회계
    assert not is_dev_role("Analyst, FP&A- Ads")
    assert not is_dev_role("Operations Manager")


def test_drops_comms_creative_pm_design():
    assert not is_dev_role("Communications Manager, Enterprise")
    assert not is_dev_role("Creative Lead, Photo")
    assert not is_dev_role("Copy Lead, Enterprise")
    assert not is_dev_role("Product Manager")
    assert not is_dev_role("Senior Product Designer")
    assert not is_dev_role("Senior Project Manager")
    assert not is_dev_role("Bilingual Staff Technical Program Manager")


def test_drops_misc_non_dev():
    assert not is_dev_role("Virtual Assistant Panelist")
    assert not is_dev_role("Strategic Sourcing Analyst")
    assert not is_dev_role("AI Strategy Consultant, Frontier Tech")
    assert not is_dev_role("Privacy Response Analyst II")
    assert not is_dev_role("Kundenberater (m/w/d) Bankkaufmann")


def test_precision_first_drops_bare_analyst():
    # 정밀도 우선: 개발 신호 없는 'Analyst' 는 drop (이전 recall-first 와 정책 변경)
    assert not is_dev_role("Data Analyst")


def test_drops_solutions_architect_presales():
    # #34: 라이브에서 'Solutions/Solution Architect' 통과분이 대부분 프리세일즈/
    #      전문서비스(Partner/Delivery/Customer/Public Sector). 정밀도 우선 drop.
    assert not is_dev_role("Solutions Architect")
    assert not is_dev_role("Senior Solutions Architect")
    assert not is_dev_role("Partner Solutions Architect")
    assert not is_dev_role("Delivery Solutions Architect - Public Sector")
    assert not is_dev_role("Customer Solutions Architect")
    assert not is_dev_role("Solution Architect - Voice")
    assert not is_dev_role("Technical Solution Architect")


def test_keeps_real_architect_titles():
    # 단, 진짜 개발/인프라 architect 는 keep (solution(s) 한정 deny 라야 함)
    assert is_dev_role("Senior Software Architect")   # STRONG(software)
    assert is_dev_role("Cloud Architect")             # rule3 generic architect
    assert is_dev_role("Data Architect")
    assert is_dev_role("Principal Architect, Platform")


def test_drops_support_value_customer_network_engineers():
    # #34: rule3(generic engineer) 로 새던 비SW 엔지니어 버킷
    assert not is_dev_role("Technical Support Engineer")
    assert not is_dev_role("Senior Support Engineer | Remote | US")
    assert not is_dev_role("Production Support Engineer II")
    assert not is_dev_role("Value Engineer")
    assert not is_dev_role("Lead Applied Value Engineer | Healthcare")
    assert not is_dev_role("Senior Customer Engineer, Web3")
    assert not is_dev_role("Team Lead, Customer Engineering")
    assert not is_dev_role("Network Engineer")
    assert not is_dev_role("Senior Network Engineer")
    assert not is_dev_role("Implementation Engineer")


def test_drops_strategist_presales_account():
    # #34
    assert not is_dev_role("AI Deployment Strategist, AI4Engineering - EMEA")
    assert not is_dev_role("Technical Account Manager")
    assert not is_dev_role("Presales Engineer, EMEA")


def test_strong_signal_still_wins_over_new_deny():
    # STRONG(software/developer/ml 등) 은 새 deny 보다 우선 → 진짜 SWE 보호
    assert is_dev_role("Developer Support Engineer")
    assert is_dev_role("Machine Learning Engineer, Customer Support Engineering")
    assert is_dev_role("Senior Manager, Solutions Architecture, AI & Developer Platform")


def test_keeps_japanese_dev_titles():
    assert is_dev_role("ソフトウェアエンジニア（バックエンド）")
    assert is_dev_role("機械学習エンジニア")
    assert is_dev_role("バックエンドエンジニア")
    assert is_dev_role("フロントエンドエンジニア")
    assert is_dev_role("インフラエンジニア")   # generic 'エンジニア' via rule 3
    assert is_dev_role("QAエンジニア")
    assert is_dev_role("プログラマー")


def test_drops_japanese_non_dev_titles():
    assert not is_dev_role("営業マネージャー")
    assert not is_dev_role("セールスエンジニア")      # 영업/프리세일즈
    assert not is_dev_role("採用コンサルタント")
    assert not is_dev_role("人事スペシャリスト")
    assert not is_dev_role("事業開発マネージャー")     # business dev != software dev
    assert not is_dev_role("マーケティング担当")
    assert not is_dev_role("カスタマーサポート")


def test_english_filter_unchanged_after_japanese():
    # 회귀: 영어 판정 불변
    assert is_dev_role("Senior Backend Engineer")
    assert is_dev_role("Security Engineer")
    assert not is_dev_role("Sales Engineer")
    assert not is_dev_role("Customer Success Manager")
