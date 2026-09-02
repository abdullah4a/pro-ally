import { readFile, rm } from "fs/promises";
import path from "path";

import { afterEach, describe, expect, it, vi } from "vitest";

const getText = vi.fn();

vi.mock("pdf-parse", () => ({
  PDFParse: class PDFParse {
    getText = () => getText();
  },
}));

const parseCvWithLlm = vi.fn();
vi.mock("@/lib/llm/client", () => ({
  parseCvWithLlm: (...args: unknown[]) => parseCvWithLlm(...args),
}));

import {
  CvUploadError,
  extractTextFromFile,
  parseUploadedCv,
  saveCvFile,
} from "../parser";

afterEach(() => {
  vi.clearAllMocks();
});

function makeFile(name: string, type: string) {
  return new File(["stub content"], name, { type });
}

describe("extractTextFromFile", () => {
  it("reads plain text files as utf-8", async () => {
    const file = makeFile("resume.txt", "text/plain");
    const buffer = Buffer.from("Hello résumé — unicode ✓", "utf-8");
    const text = await extractTextFromFile(file, buffer);
    expect(text).toBe("Hello résumé — unicode ✓");
  });

  it("returns an empty string for an empty text file", async () => {
    const file = makeFile("empty.txt", "text/plain");
    const text = await extractTextFromFile(file, Buffer.alloc(0));
    expect(text).toBe("");
  });

  it("extracts and trims text from a PDF via pdf-parse", async () => {
    getText.mockResolvedValue({ text: "  Extracted PDF text  \n" });
    const file = makeFile("resume.pdf", "application/pdf");
    const text = await extractTextFromFile(file, Buffer.from("%PDF-1.4"));
    expect(text).toBe("Extracted PDF text");
  });

  it("wraps a pdf-parse failure on a corrupt PDF in a user-safe CvUploadError, without leaking the raw internal message", async () => {
    getText.mockRejectedValue(new Error("Invalid PDF structure"));
    const file = makeFile("corrupt.pdf", "application/pdf");
    const promise = extractTextFromFile(file, Buffer.from("not a real pdf"));

    await expect(promise).rejects.toBeInstanceOf(CvUploadError);
    await expect(promise).rejects.toThrow(/couldn't read that pdf/i);
    await expect(promise).rejects.not.toThrow("Invalid PDF structure");
  });

  it("throws a professional, non-technical error for DOCX files", async () => {
    const file = makeFile(
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const promise = extractTextFromFile(file, Buffer.from("docx bytes"));

    await expect(promise).rejects.toBeInstanceOf(CvUploadError);
    await expect(promise).rejects.toThrow(/PDF and plain text resumes/i);
  });

  it("throws a professional error for a completely unsupported mime type", async () => {
    const file = makeFile("resume.png", "image/png");
    const promise = extractTextFromFile(file, Buffer.from("bytes"));

    await expect(promise).rejects.toBeInstanceOf(CvUploadError);
    await expect(promise).rejects.toThrow(/file type isn't supported/i);
  });

  it("throws a professional error for an empty mime type string", async () => {
    const file = makeFile("resume", "");
    await expect(
      extractTextFromFile(file, Buffer.from("bytes")),
    ).rejects.toBeInstanceOf(CvUploadError);
  });
});

describe("saveCvFile", () => {
  let tmpDir: string;

  afterEach(async () => {
    if (tmpDir) {
      await rm(tmpDir, { recursive: true, force: true });
    }
  });

  it("sanitizes special characters out of the file name", async () => {
    const filePath = await saveCvFile(
      "user-1",
      "my résumé (final) v2!.pdf",
      Buffer.from("pdf bytes"),
    );
    tmpDir = path.join(process.cwd(), "storage", "cvs", "user-1");

    const basename = path.basename(filePath);
    // only \w . - are allowed to survive; everything else becomes "_"
    expect(basename).toMatch(/^\d+-[\w.-]+$/);
    expect(basename.endsWith(".pdf")).toBe(true);
    expect(basename).not.toMatch(/[é() ]/);

    const written = await readFile(filePath);
    expect(written.toString()).toBe("pdf bytes");
  });

  it("blocks path traversal in the file name by stripping slashes and dots-as-separators", async () => {
    const filePath = await saveCvFile(
      "user-2",
      "../../etc/passwd",
      Buffer.from("malicious"),
    );
    tmpDir = path.join(process.cwd(), "storage", "cvs", "user-2");

    // Resulting path must still live inside the user's own storage directory.
    const expectedDir = path.join(process.cwd(), "storage", "cvs", "user-2");
    expect(path.dirname(filePath)).toBe(expectedDir);
    expect(filePath).not.toContain("etc" + path.sep + "passwd");
  });

  it("creates the per-user directory when it does not already exist", async () => {
    const userId = `user-fresh-${Date.now()}`;
    const filePath = await saveCvFile(
      userId,
      "resume.pdf",
      Buffer.from("data"),
    );
    tmpDir = path.join(process.cwd(), "storage", "cvs", userId);

    const written = await readFile(filePath);
    expect(written.toString()).toBe("data");
  });

  it("handles an empty file name gracefully by prefixing the timestamp", async () => {
    const filePath = await saveCvFile("user-3", "", Buffer.from("x"));
    tmpDir = path.join(process.cwd(), "storage", "cvs", "user-3");
    expect(path.basename(filePath)).toMatch(/^\d+-$/);
  });
});

describe("parseUploadedCv", () => {
  it("throws a professional error when extracted text is under 50 characters", async () => {
    const file = makeFile("resume.txt", "text/plain");
    const buffer = Buffer.from("too short");
    const promise = parseUploadedCv(file, buffer);

    await expect(promise).rejects.toBeInstanceOf(CvUploadError);
    await expect(promise).rejects.toThrow(/enough readable text/i);
    expect(parseCvWithLlm).not.toHaveBeenCalled();
  });

  it("accepts text of exactly 50 characters (boundary), forwards it to the LLM, and marks parsing complete", async () => {
    const file = makeFile("resume.txt", "text/plain");
    const text = "A".repeat(50);
    const buffer = Buffer.from(text);
    parseCvWithLlm.mockResolvedValue({
      skills: ["TypeScript"],
      experienceYears: 3,
      jobTitles: [],
      industries: [],
      education: [],
      keywords: [],
    });

    const result = await parseUploadedCv(file, buffer);
    expect(result.rawText).toBe(text);
    expect(result.parsingIncomplete).toBe(false);
    expect(result.parsed.skills).toEqual(["TypeScript"]);
    expect(parseCvWithLlm).toHaveBeenCalledWith(text);
  });

  // The CV itself is still valid even if AI analysis can't run right now (e.g.
  // the matching engine is briefly offline) — the upload must still succeed
  // rather than losing the user's file over a transient dependency issue.
  it("still resolves with the CV's raw text when the LLM analysis step fails, flagged as parsing-incomplete", async () => {
    const file = makeFile("resume.txt", "text/plain");
    const text = "A".repeat(100);
    const buffer = Buffer.from(text);
    parseCvWithLlm.mockRejectedValue(new Error("Connection error."));

    const result = await parseUploadedCv(file, buffer);
    expect(result.rawText).toBe(text);
    expect(result.parsingIncomplete).toBe(true);
    expect(result.parsed).toEqual({
      skills: [],
      experienceYears: 0,
      jobTitles: [],
      industries: [],
      education: [],
      keywords: [],
    });
  });

  it("throws the professional DOCX error before ever calling the LLM", async () => {
    const file = makeFile(
      "resume.docx",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    );
    const promise = parseUploadedCv(file, Buffer.from("docx bytes"));

    await expect(promise).rejects.toBeInstanceOf(CvUploadError);
    await expect(promise).rejects.toThrow(/PDF and plain text resumes/i);
    expect(parseCvWithLlm).not.toHaveBeenCalled();
  });
});
