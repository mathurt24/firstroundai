import { drizzle } from "drizzle-orm/node-postgres";
import { Client } from "pg";
import {
  candidates,
  interviews,
  answers,
  evaluations,
  type Candidate,
  type InsertCandidate,
  type Interview,
  type InsertInterview,
  type Answer,
  type InsertAnswer,
  type Evaluation,
  type InsertEvaluation,
  users,
  type User
} from "@shared/schema";
import { eq, desc } from "drizzle-orm";
import type { IStorage } from "./storage";

const client = new Client({ connectionString: process.env.DATABASE_URL! });
const db = drizzle(client);

export class DatabaseStorage implements IStorage {
  constructor() {
    client.connect();
  }
  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const [result] = await db.insert(candidates).values(candidate).returning();
    return result;
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    const result = await db.select().from(candidates).where(eq(candidates.id, id));
    return result[0];
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    const result = await db.select().from(candidates).where(eq(candidates.email, email));
    return result[0];
  }

  async createInterview(interview: InsertInterview): Promise<Interview> {
    const [result] = await db.insert(interviews).values({
      ...interview,
      status: interview.status || "pending",
      currentQuestionIndex: interview.currentQuestionIndex || 0
    }).returning();
    return result;
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    const result = await db.select().from(interviews).where(eq(interviews.id, id));
    return result[0];
  }

  async getInterviewsByCandidate(candidateId: number): Promise<Interview[]> {
    return await db.select().from(interviews).where(eq(interviews.candidateId, candidateId));
  }

  async updateInterviewStatus(id: number, status: string, currentQuestionIndex?: number): Promise<Interview | undefined> {
    const updateData: Partial<Interview> = { status };
    if (currentQuestionIndex !== undefined) {
      updateData.currentQuestionIndex = currentQuestionIndex;
    }
    
    const [result] = await db.update(interviews)
      .set(updateData)
      .where(eq(interviews.id, id))
      .returning();
    return result;
  }

  async completeInterview(id: number): Promise<Interview | undefined> {
    const [result] = await db.update(interviews)
      .set({ 
        status: "completed",
        completedAt: new Date()
      })
      .where(eq(interviews.id, id))
      .returning();
    return result;
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const [result] = await db.insert(answers).values(answer).returning();
    return result;
  }

  async getAnswersByInterview(interviewId: number): Promise<Answer[]> {
    return await db.select().from(answers).where(eq(answers.interviewId, interviewId));
  }

  async createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation> {
    const [result] = await db.insert(evaluations).values(evaluation).returning();
    return result;
  }

  async getEvaluationByInterview(interviewId: number): Promise<Evaluation | undefined> {
    const result = await db.select().from(evaluations).where(eq(evaluations.interviewId, interviewId));
    return result[0];
  }

  async getAllInterviews(): Promise<(Interview & { candidate: Candidate; evaluation?: Evaluation })[]> {
    const result = await db
      .select({
        interview: interviews,
        candidate: candidates,
        evaluation: evaluations
      })
      .from(interviews)
      .leftJoin(candidates, eq(interviews.candidateId, candidates.id))
      .leftJoin(evaluations, eq(interviews.id, evaluations.interviewId))
      .orderBy(desc(interviews.createdAt));

    return result.map(row => ({
      ...row.interview,
      candidate: row.candidate!,
      evaluation: row.evaluation || undefined
    }));
  }

  async getInterviewStats(): Promise<{
    total: number;
    recommended: number;
    maybe: number;
    rejected: number;
    avgScore: number;
  }> {
    const evalResults = await db.select().from(evaluations);
    const total = evalResults.length;
    const recommended = evalResults.filter(e => e.recommendation === "Hire").length;
    const maybe = evalResults.filter(e => e.recommendation === "Maybe").length;
    const rejected = evalResults.filter(e => e.recommendation === "No").length;
    const avgScore = total > 0 ? evalResults.reduce((sum, e) => sum + e.overallScore, 0) / total : 0;

    return { total, recommended, maybe, rejected, avgScore: Math.round(avgScore * 10) / 10 };
  }

  async getAllCandidates(): Promise<Candidate[]> {
    return await db.select().from(candidates);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const result = await db.select().from(users).where(eq(users.email, email));
    return result[0];
  }
  async createUser(user: { email: string, passwordHash: string, role: string }): Promise<User> {
    const [result] = await db.insert(users).values({
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role || "candidate"
    }).returning();
    return result;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  async deleteInterview(id: number): Promise<void> {
    // Delete answers and evaluation for this interview
    await db.delete(answers).where(eq(answers.interviewId, id));
    await db.delete(evaluations).where(eq(evaluations.interviewId, id));
    await db.delete(interviews).where(eq(interviews.id, id));
  }

  async deleteCandidate(id: number): Promise<void> {
    // Delete all interviews (and their answers/evaluations) for this candidate
    const candidateInterviews = await db.select().from(interviews).where(eq(interviews.candidateId, id));
    for (const interview of candidateInterviews) {
      await this.deleteInterview(interview.id);
    }
    await db.delete(candidates).where(eq(candidates.id, id));
  }
}