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
  type User
} from "@shared/schema";

export interface IStorage {
  // Candidate operations
  createCandidate(candidate: InsertCandidate): Promise<Candidate>;
  getCandidateById(id: number): Promise<Candidate | undefined>;
  getAllCandidates(): Promise<Candidate[]>;
  deleteCandidate(id: number): Promise<void>;
  getCandidateByEmail(email: string): Promise<Candidate | undefined>;
  
  // Interview operations
  createInterview(interview: InsertInterview): Promise<Interview>;
  getInterviewById(id: number): Promise<Interview | undefined>;
  getInterviewsByCandidate(candidateId: number): Promise<Interview[]>;
  updateInterviewStatus(id: number, status: string, currentQuestionIndex?: number): Promise<Interview | undefined>;
  completeInterview(id: number): Promise<Interview | undefined>;
  deleteInterview(id: number): Promise<void>;
  
  // Answer operations
  createAnswer(answer: InsertAnswer): Promise<Answer>;
  getAnswersByInterview(interviewId: number): Promise<Answer[]>;
  
  // Evaluation operations
  createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation>;
  getEvaluationByInterview(interviewId: number): Promise<Evaluation | undefined>;
  
  // Admin operations
  getAllInterviews(): Promise<(Interview & { candidate: Candidate; evaluation?: Evaluation })[]>;
  getInterviewStats(): Promise<{
    total: number;
    recommended: number;
    maybe: number;
    rejected: number;
    avgScore: number;
  }>;
  getUserByEmail(email: string): Promise<User | undefined>;
  createUser(user: { email: string, passwordHash: string, role: string }): Promise<User>;
  getAllUsers(): Promise<User[]>;
}

export class MemStorage implements IStorage {
  private candidates: Map<number, Candidate> = new Map();
  private interviews: Map<number, Interview> = new Map();
  private answers: Map<number, Answer> = new Map();
  private evaluations: Map<number, Evaluation> = new Map();
  private users: Map<string, User> = new Map();
  
  private candidateIdCounter = 1;
  private interviewIdCounter = 1;
  private answerIdCounter = 1;
  private evaluationIdCounter = 1;
  private userIdCounter = 1;

  async createCandidate(candidate: InsertCandidate): Promise<Candidate> {
    const id = this.candidateIdCounter++;
    const newCandidate: Candidate = { 
      ...candidate, 
      id, 
      createdAt: new Date() 
    };
    this.candidates.set(id, newCandidate);
    return newCandidate;
  }

  async getCandidateById(id: number): Promise<Candidate | undefined> {
    return this.candidates.get(id);
  }

  async getAllCandidates(): Promise<Candidate[]> {
    return Array.from(this.candidates.values());
  }

  async getCandidateByEmail(email: string): Promise<Candidate | undefined> {
    return Array.from(this.candidates.values()).find(c => c.email === email);
  }

  async createInterview(interview: InsertInterview): Promise<Interview> {
    const id = this.interviewIdCounter++;
    const newInterview: Interview = { 
      ...interview,
      status: interview.status || "pending",
      currentQuestionIndex: interview.currentQuestionIndex || 0,
      id, 
      createdAt: new Date(),
      completedAt: null
    };
    this.interviews.set(id, newInterview);
    return newInterview;
  }

  async getInterviewById(id: number): Promise<Interview | undefined> {
    return this.interviews.get(id);
  }

  async getInterviewsByCandidate(candidateId: number): Promise<Interview[]> {
    return Array.from(this.interviews.values()).filter(
      interview => interview.candidateId === candidateId
    );
  }

  async updateInterviewStatus(id: number, status: string, currentQuestionIndex?: number): Promise<Interview | undefined> {
    const interview = this.interviews.get(id);
    if (!interview) return undefined;
    
    const updated = { 
      ...interview, 
      status,
      ...(currentQuestionIndex !== undefined && { currentQuestionIndex })
    };
    this.interviews.set(id, updated);
    return updated;
  }

  async completeInterview(id: number): Promise<Interview | undefined> {
    const interview = this.interviews.get(id);
    if (!interview) return undefined;
    
    const updated = { 
      ...interview, 
      status: "completed",
      completedAt: new Date()
    };
    this.interviews.set(id, updated);
    return updated;
  }

  async createAnswer(answer: InsertAnswer): Promise<Answer> {
    const id = this.answerIdCounter++;
    const newAnswer: Answer = { 
      ...answer, 
      id, 
      createdAt: new Date() 
    };
    this.answers.set(id, newAnswer);
    return newAnswer;
  }

  async getAnswersByInterview(interviewId: number): Promise<Answer[]> {
    return Array.from(this.answers.values()).filter(
      answer => answer.interviewId === interviewId
    );
  }

  async createEvaluation(evaluation: InsertEvaluation): Promise<Evaluation> {
    const id = this.evaluationIdCounter++;
    const newEvaluation: Evaluation = { 
      ...evaluation, 
      id, 
      createdAt: new Date() 
    };
    this.evaluations.set(id, newEvaluation);
    return newEvaluation;
  }

  async getEvaluationByInterview(interviewId: number): Promise<Evaluation | undefined> {
    return Array.from(this.evaluations.values()).find(
      evaluation => evaluation.interviewId === interviewId
    );
  }

  async getAllInterviews(): Promise<(Interview & { candidate: Candidate; evaluation?: Evaluation })[]> {
    const interviews = Array.from(this.interviews.values());
    return interviews.map(interview => ({
      ...interview,
      candidate: this.candidates.get(interview.candidateId)!,
      evaluation: Array.from(this.evaluations.values()).find(e => e.interviewId === interview.id)
    }));
  }

  async getInterviewStats(): Promise<{
    total: number;
    recommended: number;
    maybe: number;
    rejected: number;
    avgScore: number;
  }> {
    const evaluations = Array.from(this.evaluations.values());
    const total = evaluations.length;
    const recommended = evaluations.filter(e => e.recommendation === "Hire").length;
    const maybe = evaluations.filter(e => e.recommendation === "Maybe").length;
    const rejected = evaluations.filter(e => e.recommendation === "No").length;
    const avgScore = total > 0 ? evaluations.reduce((sum, e) => sum + e.overallScore, 0) / total : 0;

    return { total, recommended, maybe, rejected, avgScore: Math.round(avgScore * 10) / 10 };
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email === email);
  }
  async createUser(user: { email: string, passwordHash: string, role: string }): Promise<User> {
    const newUser: User = {
      id: this.userIdCounter++,
      email: user.email,
      passwordHash: user.passwordHash,
      role: user.role || "candidate",
      createdAt: new Date()
    };
    this.users.set(newUser.email, newUser);
    return newUser;
  }

  async getAllUsers(): Promise<User[]> {
    return Array.from(this.users.values());
  }

  async deleteInterview(id: number): Promise<void> {
    // Delete answers and evaluation for this interview
    for (const [aid, answer] of this.answers.entries()) {
      if (answer.interviewId === id) this.answers.delete(aid);
    }
    for (const [eid, evaln] of this.evaluations.entries()) {
      if (evaln.interviewId === id) this.evaluations.delete(eid);
    }
    this.interviews.delete(id);
  }

  async deleteCandidate(id: number): Promise<void> {
    // Delete all interviews (and their answers/evaluations) for this candidate
    for (const [iid, interview] of this.interviews.entries()) {
      if (interview.candidateId === id) {
        await this.deleteInterview(iid);
      }
    }
    this.candidates.delete(id);
  }
}

import { DatabaseStorage } from "./storage-db";

// Use database storage in production, memory storage for testing
export const storage = process.env.DATABASE_URL ? new DatabaseStorage() : new MemStorage();
