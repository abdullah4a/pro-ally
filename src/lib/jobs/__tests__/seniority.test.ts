import { describe, expect, it } from "vitest";

import { isObviousSeniorityMismatch } from "../seniority";

describe("isObviousSeniorityMismatch", () => {
  it("flags an internship posting for a senior candidate", () => {
    expect(isObviousSeniorityMismatch("Frontend Developer Intern", "senior")).toBe(true);
  });

  it("flags an internship posting for a lead candidate", () => {
    expect(isObviousSeniorityMismatch("Software Engineering Internship", "lead")).toBe(true);
  });

  it("flags a junior/entry-level/trainee posting for a senior candidate", () => {
    expect(isObviousSeniorityMismatch("Junior Backend Developer", "senior")).toBe(true);
    expect(isObviousSeniorityMismatch("Entry Level Data Analyst", "senior")).toBe(true);
    expect(isObviousSeniorityMismatch("Entry-Level Analyst", "senior")).toBe(true);
    expect(isObviousSeniorityMismatch("Graduate Trainee", "senior")).toBe(true);
  });

  it("flags a staff/principal/lead/architect posting for a junior candidate", () => {
    expect(isObviousSeniorityMismatch("Staff Engineer", "junior")).toBe(true);
    expect(isObviousSeniorityMismatch("Principal Software Architect", "junior")).toBe(true);
    expect(isObviousSeniorityMismatch("Lead Backend Engineer", "junior")).toBe(true);
  });

  it("does not flag a senior posting for a senior candidate", () => {
    expect(isObviousSeniorityMismatch("Senior Frontend Developer", "senior")).toBe(false);
  });

  it("does not flag a mid-level-sounding posting for a senior candidate", () => {
    expect(isObviousSeniorityMismatch("Frontend Developer", "senior")).toBe(false);
  });

  it("never filters anything for a mid-level candidate, in either direction", () => {
    expect(isObviousSeniorityMismatch("Frontend Developer Intern", "mid")).toBe(false);
    expect(isObviousSeniorityMismatch("Staff Engineer", "mid")).toBe(false);
  });

  it("does not filter when experienceLevel is undefined", () => {
    expect(isObviousSeniorityMismatch("Frontend Developer Intern", undefined)).toBe(false);
    expect(isObviousSeniorityMismatch("Staff Engineer", undefined)).toBe(false);
  });

  it("is case-insensitive", () => {
    expect(isObviousSeniorityMismatch("FRONTEND DEVELOPER INTERN", "senior")).toBe(true);
    expect(isObviousSeniorityMismatch("staff engineer", "junior")).toBe(true);
  });

  it("does not false-positive on titles that merely contain a substring like 'internal'", () => {
    expect(isObviousSeniorityMismatch("Internal Tools Engineer", "senior")).toBe(false);
  });
});
