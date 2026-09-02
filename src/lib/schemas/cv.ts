import { ObjectId } from "mongodb";
import { z } from "zod";

export const parsedCvSchema = z.object({
  skills: z.array(z.string()),
  experienceYears: z.number().nonnegative(),
  jobTitles: z.array(z.string()),
  industries: z.array(z.string()),
  education: z.array(z.string()),
  keywords: z.array(z.string()),
});

export const cvDocumentSchema = z.object({
  userId: z.instanceof(ObjectId),
  filePath: z.string(),
  fileName: z.string(),
  mimeType: z.enum([
    "application/pdf",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "text/plain",
  ]),
  rawText: z.string().min(50, "CV text is too short"),
  parsed: parsedCvSchema,
  parsingIncomplete: z.boolean().default(false),
  isActive: z.boolean().default(true),
  uploadedAt: z.date(),
});

export const cvUploadSchema = z.object({
  file: z
    .instanceof(File)
    .refine(
      (file) =>
        [
          "application/pdf",
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
          "text/plain",
        ].includes(file.type),
      "Only PDF, DOCX, or TXT files are supported",
    )
    .refine((file) => file.size <= 5 * 1024 * 1024, "File must be under 5MB"),
});

export type ParsedCV = z.infer<typeof parsedCvSchema>;
export type CVDocument = z.infer<typeof cvDocumentSchema>;
