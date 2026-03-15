export interface SkillArrays {
  tech_stack: string[];
  languages: string[];
  frameworks: string[];
  cloud: string[];
  databases: string[];
  tools: string[];
}

const MAX_ITEMS_PER_ARRAY = 30;

const CANONICAL_MAP: Record<string, { canonical: string; bucket: keyof SkillArrays }> = {
  // Cloud
  "amazon web services": { canonical: "AWS", bucket: "cloud" },
  "aws": { canonical: "AWS", bucket: "cloud" },
  "google cloud platform": { canonical: "GCP", bucket: "cloud" },
  "google cloud": { canonical: "GCP", bucket: "cloud" },
  "gcp": { canonical: "GCP", bucket: "cloud" },
  "microsoft azure": { canonical: "Azure", bucket: "cloud" },
  "azure": { canonical: "Azure", bucket: "cloud" },

  // Languages
  "js": { canonical: "JavaScript", bucket: "languages" },
  "javascript": { canonical: "JavaScript", bucket: "languages" },
  "ts": { canonical: "TypeScript", bucket: "languages" },
  "typescript": { canonical: "TypeScript", bucket: "languages" },
  "golang": { canonical: "Go", bucket: "languages" },
  "go lang": { canonical: "Go", bucket: "languages" },
  "go": { canonical: "Go", bucket: "languages" },
  "py": { canonical: "Python", bucket: "languages" },
  "python": { canonical: "Python", bucket: "languages" },
  "c sharp": { canonical: "C#", bucket: "languages" },
  "c#": { canonical: "C#", bucket: "languages" },
  "java": { canonical: "Java", bucket: "languages" },

  // Databases
  "postgres": { canonical: "PostgreSQL", bucket: "databases" },
  "postgresql": { canonical: "PostgreSQL", bucket: "databases" },
  "mongo": { canonical: "MongoDB", bucket: "databases" },
  "mongodb": { canonical: "MongoDB", bucket: "databases" },
  "dynamo": { canonical: "DynamoDB", bucket: "databases" },
  "dynamodb": { canonical: "DynamoDB", bucket: "databases" },
  "aurora": { canonical: "Aurora", bucket: "databases" },
  "aurora rds": { canonical: "Aurora", bucket: "databases" },
  "rds": { canonical: "RDS", bucket: "databases" },
  "mysql": { canonical: "MySQL", bucket: "databases" },
  "redis": { canonical: "Redis", bucket: "databases" },
  "elasticsearch": { canonical: "Elasticsearch", bucket: "databases" },

  // Frameworks
  "spring boot": { canonical: "Spring Boot", bucket: "frameworks" },
  "spring framework": { canonical: "Spring", bucket: "frameworks" },
  "spring": { canonical: "Spring", bucket: "frameworks" },
  "nodejs": { canonical: "Node.js", bucket: "frameworks" },
  "node js": { canonical: "Node.js", bucket: "frameworks" },
  "node.js": { canonical: "Node.js", bucket: "frameworks" },
  "reactjs": { canonical: "React", bucket: "frameworks" },
  "react.js": { canonical: "React", bucket: "frameworks" },
  "react": { canonical: "React", bucket: "frameworks" },
  "nextjs": { canonical: "Next.js", bucket: "frameworks" },
  "next js": { canonical: "Next.js", bucket: "frameworks" },
  "next.js": { canonical: "Next.js", bucket: "frameworks" },
  "django": { canonical: "Django", bucket: "frameworks" },
  "fastapi": { canonical: "FastAPI", bucket: "frameworks" },
  "nest": { canonical: "NestJS", bucket: "frameworks" },
  "nestjs": { canonical: "NestJS", bucket: "frameworks" },
  "ruby on rails": { canonical: "Ruby on Rails", bucket: "frameworks" },
  "rails": { canonical: "Ruby on Rails", bucket: "frameworks" },

  // Tools
  "k8s": { canonical: "Kubernetes", bucket: "tools" },
  "kubernetes": { canonical: "Kubernetes", bucket: "tools" },
  "docker": { canonical: "Docker", bucket: "tools" },
  "terraform": { canonical: "Terraform", bucket: "tools" },
  "git": { canonical: "Git", bucket: "tools" },
  "github actions": { canonical: "GitHub Actions", bucket: "tools" },
  "ci/cd": { canonical: "CI/CD", bucket: "tools" },
  "cicd": { canonical: "CI/CD", bucket: "tools" },
  "datadog": { canonical: "Datadog", bucket: "tools" },
};

const BUCKET_PRIORITY: (keyof SkillArrays)[] = [
  "languages",
  "frameworks",
  "cloud",
  "databases",
  "tools",
  "tech_stack",
];

function cleanEntry(entry: string): string {
  let s = entry.trim();
  s = s.replace(/\s+/g, " ");
  s = s.replace(/[.,;:)]+$/, "");
  return s;
}

function normalizeForLookup(entry: string): string {
  return entry.toLowerCase();
}

function normalizeArray(arr: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const raw of arr) {
    const cleaned = cleanEntry(raw);
    if (!cleaned) continue;

    const lookupKey = normalizeForLookup(cleaned);
    const mapping = CANONICAL_MAP[lookupKey];
    const canonical = mapping ? mapping.canonical : cleaned;
    const canonicalLower = canonical.toLowerCase();

    if (seen.has(canonicalLower)) continue;
    seen.add(canonicalLower);
    result.push(canonical);
  }

  return result;
}

export function normalizeSkills(extraction: SkillArrays): SkillArrays {
  const normalized: SkillArrays = {
    tech_stack: normalizeArray(extraction.tech_stack),
    languages: normalizeArray(extraction.languages),
    frameworks: normalizeArray(extraction.frameworks),
    cloud: normalizeArray(extraction.cloud),
    databases: normalizeArray(extraction.databases),
    tools: normalizeArray(extraction.tools),
  };

  const globalSeen = new Map<string, keyof SkillArrays>();

  for (const bucket of BUCKET_PRIORITY) {
    const deduped: string[] = [];
    for (const item of normalized[bucket]) {
      const lower = item.toLowerCase();
      if (globalSeen.has(lower)) continue;
      globalSeen.set(lower, bucket);
      deduped.push(item);
    }
    normalized[bucket] = deduped;
  }

  for (const bucket of BUCKET_PRIORITY) {
    if (normalized[bucket].length > MAX_ITEMS_PER_ARRAY) {
      normalized[bucket] = normalized[bucket].slice(0, MAX_ITEMS_PER_ARRAY);
    }
  }

  return normalized;
}
