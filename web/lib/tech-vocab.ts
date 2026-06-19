// 기술 스택 자동완성용 큐레이션 사전. 공고 태그/본문이 영문이라 매칭을 위해 영문 표준 표기로 둔다.
// 완전 망라가 아니라 흔한 항목 중심 — 사용자는 자유 입력도 가능(Enter).
export const TECH_VOCAB: string[] = [
  // languages
  "Python", "JavaScript", "TypeScript", "Java", "Kotlin", "Go", "Rust", "C++", "C#", "C",
  "Ruby", "PHP", "Swift", "Scala", "Elixir", "Clojure", "Haskell", "Dart", "R", "MATLAB", "SQL",
  // frontend
  "React", "Next.js", "Vue", "Nuxt", "Angular", "Svelte", "Solid", "Redux", "Tailwind CSS",
  "HTML", "CSS", "Sass", "Webpack", "Vite", "Storybook", "React Native", "Flutter",
  // backend / frameworks
  "Node.js", "Express", "NestJS", "Django", "FastAPI", "Flask", "Spring", "Spring Boot",
  "Rails", "Laravel", "Gin", ".NET", "GraphQL", "gRPC", "REST",
  // data / ML
  "PyTorch", "TensorFlow", "Keras", "scikit-learn", "Pandas", "NumPy", "Spark", "Hadoop",
  "Airflow", "dbt", "Kafka", "Flink", "Snowflake", "Databricks", "MLflow", "LLM", "NLP",
  "Computer Vision", "Machine Learning", "Deep Learning", "Data Engineering",
  // databases
  "PostgreSQL", "MySQL", "MongoDB", "Redis", "Elasticsearch", "Cassandra", "DynamoDB",
  "SQLite", "ClickHouse", "Neo4j", "pgvector",
  // infra / devops / cloud
  "AWS", "GCP", "Azure", "Kubernetes", "Docker", "Terraform", "Ansible", "Helm", "Pulumi",
  "Jenkins", "GitHub Actions", "GitLab CI", "ArgoCD", "Prometheus", "Grafana", "Linux", "Nginx",
  "Kafka Streams", "RabbitMQ", "Serverless", "Microservices",
  // misc
  "Git", "Bash", "WebSockets", "OAuth", "CI/CD", "Datadog", "Sentry",
  // enterprise / platforms / gamedev / design (백엔드 추출 vocab 준거; firmware는 검색 UX상 제외)
  "Salesforce", "ServiceNow", "SAP", "ABAP", "Shopify", "Figma", "Unity", "Unreal Engine",
];
