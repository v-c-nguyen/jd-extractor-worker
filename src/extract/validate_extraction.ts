export interface ValidateExtractionInput {
  company_name: string | null;
  role_title: string | null;
  work_mode: string | null;
  location: string | null;
  industry: string | null;
  travel?: string | null;
  clearance_required?: string | null;
  government_agency?: string | null;
  type?: string | null;
  seniority?: string | null;
  salary_json: string;
  fetched_text_len?: number | null;
}

export type ValidationStatus = "pass" | "retry" | "failed";

export interface ValidateExtractionResult {
  confidence_score: number;
  validation_status: ValidationStatus;
  validation_notes: string;
}

export function validateExtraction(
  input: ValidateExtractionInput
): ValidateExtractionResult {
  let score = 0;
  const notes: string[] = [];

  const company = input.company_name?.trim() ?? "";
  const role = input.role_title?.trim() ?? "";
  const workMode = input.work_mode?.trim() ?? "";
  const location = input.location?.trim() ?? "";
  const industry = input.industry?.trim() ?? "";
  const salaryJsonRaw = input.salary_json ?? "";

  // Core fields
  if (company && company.length >= 2) {
    score += 25;
  } else {
    notes.push("missing company_name");
  }

  if (role && role.length >= 3) {
    score += 25;
  } else {
    notes.push("missing role_title");
  }

  // Context fields
  if (workMode && workMode.toLowerCase() !== "not mentioned") {
    score += 10;
  } else {
    notes.push("missing work_mode");
  }

  const travel = input.travel?.trim() ?? "";
  if (travel) {
    score += 5;
  } else {
    notes.push("missing travel");
  }

  if (location) {
    score += 10;
  } else {
    notes.push("missing location");
  }

  if (industry) {
    score += 5;
  } else {
    notes.push("missing industry");
  }

  // Salary JSON
  let salaryJsonValid = false;
  let salaryHasCoreField = false;

  const salaryJsonTrimmed = salaryJsonRaw.trim();
  if (salaryJsonTrimmed) {
    try {
      const parsed = JSON.parse(salaryJsonTrimmed) as Record<string, unknown>;
      if (parsed && typeof parsed === "object") {
        salaryJsonValid = true;
        const hasMin = Object.prototype.hasOwnProperty.call(parsed, "min");
        const hasMax = Object.prototype.hasOwnProperty.call(parsed, "max");
        const hasCurrency = Object.prototype.hasOwnProperty.call(
          parsed,
          "currency"
        );
        const hasPeriod = Object.prototype.hasOwnProperty.call(
          parsed,
          "period"
        );

        salaryHasCoreField = hasMin || hasMax || hasCurrency || hasPeriod;
      }
    } catch {
      // invalid JSON
    }
  }

  if (salaryJsonValid) {
    score += 5;
    if (salaryHasCoreField) {
      score += 5;
    } else {
      notes.push("empty salary json");
    }
  } else {
    if (salaryJsonTrimmed.length === 0) {
      notes.push("empty salary json");
    } else {
      notes.push("invalid salary json");
    }
  }

  // Fetch quality
  if (typeof input.fetched_text_len === "number") {
    const len = input.fetched_text_len;
    if (len >= 800) {
      score += 5;
      if (len >= 2000) {
        score += 5;
      }
    } else {
      notes.push("low fetched_text_len");
    }
  } else {
    notes.push("low fetched_text_len");
  }

  // Derive validation status from score
  let validation_status: ValidationStatus;
  if (score >= 70) {
    validation_status = "pass";
  } else if (score >= 40) {
    validation_status = "retry";
  } else {
    validation_status = "failed";
  }

  // Build concise notes string
  let validation_notes = notes.join("; ");
  if (validation_notes.length > 200) {
    validation_notes = validation_notes.slice(0, 200);
  }

  return {
    confidence_score: score,
    validation_status,
    validation_notes,
  };
}

