import { pgTable, text, serial, integer, jsonb, timestamp, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const candidates = pgTable("candidates", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull(),
  jobRole: text("job_role").notNull(),
  resumeText: text("resume_text").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const interviews = pgTable("interviews", {
  id: serial("id").primaryKey(),
  candidateId: integer("candidate_id").references(() => candidates.id).notNull(),
  questions: jsonb("questions").notNull(), // Array of question objects
  currentQuestionIndex: integer("current_question_index").default(0).notNull(),
  status: text("status").default("pending").notNull(), // pending, in-progress, completed
  createdAt: timestamp("created_at").defaultNow().notNull(),
  completedAt: timestamp("completed_at"),
});

export const answers = pgTable("answers", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").references(() => interviews.id).notNull(),
  questionIndex: integer("question_index").notNull(),
  questionText: text("question_text").notNull(),
  answerText: text("answer_text").notNull(),
  score: integer("score").notNull(), // 0-10
  feedback: text("feedback").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const evaluations = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  interviewId: integer("interview_id").references(() => interviews.id).notNull(),
  overallScore: integer("overall_score").notNull(), // 0-100
  technicalScore: integer("technical_score").notNull(),
  behavioralScore: integer("behavioral_score").notNull(),
  strengths: text("strengths").notNull(),
  improvementAreas: text("improvement_areas").notNull(),
  recommendation: text("recommendation").notNull(), // Hire, Maybe, No
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").notNull().default('candidate'), // 'admin' or 'candidate'
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

// Insert schemas
export const insertCandidateSchema = createInsertSchema(candidates).omit({
  id: true,
  createdAt: true,
});

export const insertInterviewSchema = createInsertSchema(interviews).omit({
  id: true,
  createdAt: true,
  completedAt: true,
});

export const insertAnswerSchema = createInsertSchema(answers).omit({
  id: true,
  createdAt: true,
});

export const insertEvaluationSchema = createInsertSchema(evaluations).omit({
  id: true,
  createdAt: true,
});

export const insertUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["admin", "candidate"]).optional(),
});

// Types
export type Candidate = typeof candidates.$inferSelect;
export type InsertCandidate = z.infer<typeof insertCandidateSchema>;

export type Interview = typeof interviews.$inferSelect;
export type InsertInterview = z.infer<typeof insertInterviewSchema>;

export type Answer = typeof answers.$inferSelect;
export type InsertAnswer = z.infer<typeof insertAnswerSchema>;

export type Evaluation = typeof evaluations.$inferSelect;
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

// Question and evaluation types for API responses
export interface QuestionSet {
  questions: string[];
}

export interface AnswerEvaluation {
  score: number;
  feedback: string;
}

export interface InterviewSummary {
  strengths: string;
  improvementAreas: string;
  finalRating: number;
  recommendation: "Hire" | "Maybe" | "No";
}
