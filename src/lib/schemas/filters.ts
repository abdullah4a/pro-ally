import { ObjectId } from "mongodb";
import { z } from "zod";

export const platformSchema = z.enum([
  "linkedin",
  "indeed",
  "upwork",
  "fiverr",
  "ats",
]);

export const userFiltersSchema = z.object({
  userId: z.instanceof(ObjectId),
  keywords: z.array(z.string()).default([]),
  excludeKeywords: z.array(z.string()).default([]),
  platforms: z.array(platformSchema).default(["linkedin", "indeed", "upwork"]),
  minTrustScore: z.number().min(0).max(100).default(60),
  minMatchScore: z.number().min(0).max(100).default(70),
  pollIntervalMins: z.number().min(15).default(15),
  updatedAt: z.date(),
});

export const filtersFormSchema = userFiltersSchema
  .omit({ userId: true, updatedAt: true })
  .extend({
    keywords: z.string(),
    excludeKeywords: z.string(),
  });

export type Platform = z.infer<typeof platformSchema>;
export type UserFiltersDocument = z.infer<typeof userFiltersSchema>;
export type FiltersFormInput = z.infer<typeof filtersFormSchema>;
