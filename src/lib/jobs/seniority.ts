import type { ExperienceLevel } from "@/lib/schemas/profile";

const JUNIOR_TITLE_PATTERN = /\b(intern(ship)?s?|trainees?|entry[\s-]?level|junior)\b/i;
const SENIOR_TITLE_PATTERN = /\b(senior|staff|principal|lead|architect)\b/i;

/**
 * A fast, deterministic pre-filter applied *before* spending an LLM call on a
 * listing — catches the most obvious seniority mismatches (a senior/lead
 * candidate being shown an internship, or a junior candidate being shown a
 * staff/principal role). A small local LLM cannot be reliably trusted to
 * self-police this from prompt instructions alone — evaluateJobMatch's own
 * prompt asks it to weigh seniority too, but this guard doesn't depend on
 * that working. Mid-level candidates are deliberately never filtered here —
 * "mid" is a broad enough band that both ends can be reasonable stretches.
 */
export function isObviousSeniorityMismatch(
  jobTitle: string,
  experienceLevel: ExperienceLevel | undefined,
): boolean {
  if (!experienceLevel || experienceLevel === "mid") return false;

  if (experienceLevel === "senior" || experienceLevel === "lead") {
    return JUNIOR_TITLE_PATTERN.test(jobTitle);
  }

  if (experienceLevel === "junior") {
    return SENIOR_TITLE_PATTERN.test(jobTitle);
  }

  return false;
}
