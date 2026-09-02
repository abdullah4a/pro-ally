import { mkdir, writeFile } from "fs/promises";
import path from "path";

import { PDFParse } from "pdf-parse";

import { parseCvWithLlm } from "@/lib/llm/client";
import type { ParsedCV } from "@/lib/schemas/cv";

const CV_STORAGE_DIR = path.join(process.cwd(), "storage", "cvs");

/**
 * A problem the user can act on (wrong file type, unreadable content) — its
 * message is always safe to show as-is. Anything else thrown from this module
 * is an unexpected internal failure and callers should show a generic message
 * instead of leaking it.
 */
export class CvUploadError extends Error {}

const EMPTY_PARSED_CV: ParsedCV = {
  skills: [],
  experienceYears: 0,
  jobTitles: [],
  industries: [],
  education: [],
  keywords: [],
};

export async function extractTextFromFile(
  file: File,
  buffer: Buffer,
): Promise<string> {
  if (file.type === "text/plain") {
    return buffer.toString("utf-8");
  }

  if (file.type === "application/pdf") {
    try {
      const parser = new PDFParse({ data: buffer });
      const result = await parser.getText();
      return result.text.trim();
    } catch (error) {
      console.error("PDF text extraction failed:", error);
      throw new CvUploadError(
        "We couldn't read that PDF. Please make sure it isn't corrupted or password-protected, and try again.",
      );
    }
  }

  if (
    file.type ===
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  ) {
    throw new CvUploadError(
      "We currently support PDF and plain text resumes. Please convert your document and try again.",
    );
  }

  throw new CvUploadError(
    "That file type isn't supported. Please upload a PDF or plain text document.",
  );
}

export async function saveCvFile(
  userId: string,
  fileName: string,
  buffer: Buffer,
): Promise<string> {
  const userDir = path.join(CV_STORAGE_DIR, userId);
  await mkdir(userDir, { recursive: true });

  const safeName = fileName.replace(/[^\w.-]/g, "_");
  const filePath = path.join(userDir, `${Date.now()}-${safeName}`);
  await writeFile(filePath, buffer);

  return filePath;
}

export async function parseUploadedCv(
  file: File,
  buffer: Buffer,
): Promise<{ rawText: string; parsed: ParsedCV; parsingIncomplete: boolean }> {
  const rawText = await extractTextFromFile(file, buffer);

  if (rawText.length < 50) {
    throw new CvUploadError(
      "We couldn't find enough readable text in that file. Please check it isn't empty or a scanned image, and try again.",
    );
  }

  // The CV itself is valid even if our AI analysis step can't run right now
  // (e.g. the matching engine is briefly offline) — save it and let the
  // upload succeed rather than losing the user's file over a transient issue.
  try {
    const parsed = await parseCvWithLlm(rawText);
    return { rawText, parsed, parsingIncomplete: false };
  } catch (error) {
    console.error("CV analysis is temporarily unavailable:", error);
    return { rawText, parsed: EMPTY_PARSED_CV, parsingIncomplete: true };
  }
}
