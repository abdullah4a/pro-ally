import { ObjectId } from "mongodb";
import { z } from "zod";

export const jobTypeSchema = z.enum([
  "full-time",
  "remote",
  "contract",
  "freelance",
]);

export const experienceLevelSchema = z.enum([
  "junior",
  "mid",
  "senior",
  "lead",
]);

export const userProfileSchema = z.object({
  userId: z.instanceof(ObjectId),
  fullName: z.string().min(1, "Full name is required"),
  preferredCountry: z
    .string()
    .length(2, "Use a 2-letter country code (e.g. PK, AE, US)"),
  preferredCities: z.array(z.string()).default([]),
  jobTypes: z.array(jobTypeSchema).min(1, "Select at least one job type"),
  minSalary: z.number().positive().optional(),
  remoteOnly: z.boolean().default(false),
  experienceLevel: experienceLevelSchema.optional(),
  onboardingComplete: z.boolean().default(false),
  updatedAt: z.date(),
});

export const profileFormSchema = userProfileSchema.omit({
  userId: true,
  updatedAt: true,
});

export type JobType = z.infer<typeof jobTypeSchema>;
export type ExperienceLevel = z.infer<typeof experienceLevelSchema>;
export type UserProfileDocument = z.infer<typeof userProfileSchema>;
export type ProfileFormInput = z.infer<typeof profileFormSchema>;
