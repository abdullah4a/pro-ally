import { ObjectId } from "mongodb";
import { describe, expect, it } from "vitest";

import { cvDocumentSchema, cvUploadSchema, parsedCvSchema } from "../cv";

describe("parsedCvSchema", () => {
  const valid = {
    skills: ["TypeScript", "React"],
    experienceYears: 3,
    jobTitles: ["Software Engineer"],
    industries: ["Tech"],
    education: ["BSc Computer Science"],
    keywords: ["frontend"],
  };

  it("accepts a fully valid parsed CV", () => {
    expect(parsedCvSchema.safeParse(valid).success).toBe(true);
  });

  it("accepts empty arrays for every list field", () => {
    expect(
      parsedCvSchema.safeParse({
        ...valid,
        skills: [],
        jobTitles: [],
        industries: [],
        education: [],
        keywords: [],
      }).success,
    ).toBe(true);
  });

  it("accepts experienceYears of exactly 0 (boundary)", () => {
    expect(
      parsedCvSchema.safeParse({ ...valid, experienceYears: 0 }).success,
    ).toBe(true);
  });

  it("rejects a negative experienceYears", () => {
    expect(
      parsedCvSchema.safeParse({ ...valid, experienceYears: -1 }).success,
    ).toBe(false);
  });

  it("rejects a non-numeric experienceYears (LLM hallucination like 'many years')", () => {
    expect(
      parsedCvSchema.safeParse({ ...valid, experienceYears: "many years" })
        .success,
    ).toBe(false);
  });

  it("rejects a skills array with non-string entries", () => {
    expect(
      parsedCvSchema.safeParse({ ...valid, skills: [1, 2, 3] }).success,
    ).toBe(false);
  });

  it("rejects when a required field is missing entirely", () => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { skills: _skills, ...rest } = valid;
    expect(parsedCvSchema.safeParse(rest).success).toBe(false);
  });

  it("rejects skills passed as a single string instead of an array (common LLM mistake)", () => {
    expect(
      parsedCvSchema.safeParse({ ...valid, skills: "TypeScript, React" })
        .success,
    ).toBe(false);
  });
});

describe("cvDocumentSchema", () => {
  const parsed = {
    skills: ["TypeScript"],
    experienceYears: 1,
    jobTitles: ["Dev"],
    industries: ["Tech"],
    education: ["BSc"],
    keywords: ["code"],
  };

  const valid = {
    userId: new ObjectId(),
    filePath: "/storage/cvs/u1/123-resume.pdf",
    fileName: "resume.pdf",
    mimeType: "application/pdf" as const,
    rawText: "A".repeat(60),
    parsed,
    uploadedAt: new Date(),
  };

  it("accepts a valid CV document and defaults isActive to true", () => {
    const result = cvDocumentSchema.safeParse(valid);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.isActive).toBe(true);
    }
  });

  it("rejects rawText shorter than 50 characters", () => {
    expect(
      cvDocumentSchema.safeParse({ ...valid, rawText: "too short" }).success,
    ).toBe(false);
  });

  it("accepts rawText of exactly 50 characters (boundary)", () => {
    expect(
      cvDocumentSchema.safeParse({ ...valid, rawText: "A".repeat(50) })
        .success,
    ).toBe(true);
  });

  it("rejects rawText of 49 characters (boundary)", () => {
    expect(
      cvDocumentSchema.safeParse({ ...valid, rawText: "A".repeat(49) })
        .success,
    ).toBe(false);
  });

  it("rejects an unsupported mimeType", () => {
    expect(
      cvDocumentSchema.safeParse({ ...valid, mimeType: "image/png" })
        .success,
    ).toBe(false);
  });

  it("rejects a plain string userId instead of an ObjectId instance", () => {
    expect(
      cvDocumentSchema.safeParse({
        ...valid,
        userId: valid.userId.toHexString(),
      }).success,
    ).toBe(false);
  });

  it("rejects a string uploadedAt instead of a Date instance", () => {
    expect(
      cvDocumentSchema.safeParse({
        ...valid,
        uploadedAt: new Date().toISOString(),
      }).success,
    ).toBe(false);
  });

  it("rejects when nested parsed CV is invalid", () => {
    expect(
      cvDocumentSchema.safeParse({
        ...valid,
        parsed: { ...parsed, experienceYears: -5 },
      }).success,
    ).toBe(false);
  });
});

describe("cvUploadSchema", () => {
  function makeFile(
    content: string,
    name: string,
    type: string,
    sizeOverride?: number,
  ) {
    const file = new File([content], name, { type });
    if (sizeOverride !== undefined) {
      Object.defineProperty(file, "size", { value: sizeOverride });
    }
    return file;
  }

  it("accepts a valid small PDF file", () => {
    const file = makeFile("%PDF-1.4", "resume.pdf", "application/pdf");
    expect(cvUploadSchema.safeParse({ file }).success).toBe(true);
  });

  it("accepts a valid TXT file", () => {
    const file = makeFile("plain text resume", "resume.txt", "text/plain");
    expect(cvUploadSchema.safeParse({ file }).success).toBe(true);
  });

  it("accepts a valid DOCX-mimetype file at the schema level", () => {
    const file = makeFile(
      "docx bytes",
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    expect(cvUploadSchema.safeParse({ file }).success).toBe(true);
  });

  it("rejects an unsupported mime type (e.g. image)", () => {
    const file = makeFile("bytes", "resume.png", "image/png");
    expect(cvUploadSchema.safeParse({ file }).success).toBe(false);
  });

  it("rejects an empty mime type (common when browser can't sniff it)", () => {
    const file = makeFile("bytes", "resume", "");
    expect(cvUploadSchema.safeParse({ file }).success).toBe(false);
  });

  it("rejects a file exactly 1 byte over the 5MB limit (boundary)", () => {
    const file = makeFile("x", "resume.pdf", "application/pdf", 5 * 1024 * 1024 + 1);
    expect(cvUploadSchema.safeParse({ file }).success).toBe(false);
  });

  it("accepts a file at exactly the 5MB limit (boundary)", () => {
    const file = makeFile("x", "resume.pdf", "application/pdf", 5 * 1024 * 1024);
    expect(cvUploadSchema.safeParse({ file }).success).toBe(true);
  });

  it("accepts a zero-byte file (schema does not enforce a minimum size)", () => {
    const file = makeFile("", "resume.pdf", "application/pdf", 0);
    expect(cvUploadSchema.safeParse({ file }).success).toBe(true);
  });

  it("rejects when file field is missing", () => {
    expect(cvUploadSchema.safeParse({}).success).toBe(false);
  });

  it("rejects when file field is a string instead of a File instance", () => {
    expect(
      cvUploadSchema.safeParse({ file: "not-a-file" }).success,
    ).toBe(false);
  });

  it("rejects when file field is null", () => {
    expect(cvUploadSchema.safeParse({ file: null }).success).toBe(false);
  });
});
