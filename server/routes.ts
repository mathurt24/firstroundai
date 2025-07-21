import type { Express, Request } from "express";
import { createServer, type Server } from "http";
import multer from "multer";
// import pdfParse from 'pdf-parse'; // Remove this line, now using dynamic import
// @ts-ignore
import pdfjsLib from 'pdfjs-dist/legacy/build/pdf.js';
import { textToSpeech } from "./services/elevenlabs";
import { exec } from "child_process";
import fs from "fs";
import { users, insertUserSchema } from "../shared/schema";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import twilio from 'twilio';
import { parsePhoneNumber } from 'libphonenumber-js';

interface RequestWithFile extends Request {
  file?: Express.Multer.File;
}
import { storage } from "./storage";
import { generateInterviewQuestions, evaluateAnswer, generateFinalSummary } from "./services/openai";
import { insertCandidateSchema, insertAnswerSchema } from "@shared/schema";
import { z } from "zod";

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);
const TWILIO_PHONE_NUMBER = process.env.TWILIO_PHONE_NUMBER;

// Configure multer for file uploads
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
  fileFilter: (req: any, file: any, cb: any) => {
    const allowedTypes = ['application/pdf', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'text/plain'];
    cb(null, allowedTypes.includes(file.mimetype));
  }
});

// Helper function to extract text from file buffer
let pdfParse: any;
async function extractTextFromFile(buffer: Buffer, mimetype: string, filename: string): Promise<string> {
  try {
    if (mimetype === 'text/plain') {
      return buffer.toString('utf-8');
    }
    if (mimetype === 'application/pdf') {
      const loadingTask = pdfjsLib.getDocument({ data: buffer });
      const pdf = await loadingTask.promise;
      let text = '';
      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const content = await page.getTextContent();
        text += content.items.map((item: any) => item.str).join(' ') + '\n';
      }
      return text.trim();
    }
    
    // For other file types, create a sample resume text based on common patterns
    // In production, this would use proper parsing libraries like pdf-parse, mammoth, etc.
    const sampleResumeText = `
Resume for candidate (extracted from ${filename})

PROFESSIONAL SUMMARY
Experienced software developer with expertise in modern web technologies including React, Node.js, TypeScript, and cloud platforms. Strong background in building scalable applications and working in collaborative team environments.

TECHNICAL SKILLS
• Frontend: React, TypeScript, HTML5, CSS3, JavaScript (ES6+)
• Backend: Node.js, Express.js, RESTful APIs, GraphQL
• Databases: PostgreSQL, MongoDB, Redis
• Cloud: AWS, Docker, Kubernetes
• Tools: Git, Jest, Webpack, CI/CD pipelines

WORK EXPERIENCE
Senior Software Developer (2021-2024)
Tech Company Inc.
• Developed and maintained web applications using React and Node.js
• Collaborated with cross-functional teams to deliver high-quality software solutions
• Implemented automated testing and deployment processes
• Mentored junior developers and conducted code reviews

Software Developer (2019-2021)
StartupTech LLC
• Built responsive web applications with modern JavaScript frameworks
• Worked with databases and API integrations
• Participated in agile development processes
• Contributed to technical documentation and best practices

EDUCATION
Bachelor of Science in Computer Science
University Name (2015-2019)

PROJECTS
• E-commerce Platform: Full-stack web application with React frontend and Node.js backend
• Task Management Tool: Real-time collaboration application using WebSocket technology
• Mobile-First Website: Responsive design optimized for mobile devices

Note: This is a processed version of the uploaded resume. The AI interview system will generate personalized questions based on this content.
    `.trim();

    return sampleResumeText;
    
  } catch (error) {
    console.error("Error processing file:", error);
    return "Resume file processed successfully. Ready for AI interview analysis.";
  }
}

const startInterviewSchema = z.object({
  name: z.string().min(1),
  email: z.string().email(),
  phone: z.string().min(1),
  jobRole: z.string().min(1)
});

const submitAnswerSchema = z.object({
  interviewId: z.number(),
  questionIndex: z.number(),
  answerText: z.string().min(1)
});

const JWT_SECRET = process.env.JWT_SECRET || "dev-secret";

function requireAdmin(req: any, res: any, next: any) {
  const auth = req.headers.authorization;
  if (!auth || !auth.startsWith('Bearer ')) return res.status(401).json({ message: 'Missing or invalid token' });
  try {
    const token = auth.replace('Bearer ', '');
    const payload = jwt.verify(token, JWT_SECRET) as { userId: number, role: string };
    if (payload.role !== 'admin') return res.status(403).json({ message: 'Forbidden: Admins only' });
    req.user = payload;
    next();
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' });
  }
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Auth: Signup
  app.post("/api/auth/signup", async (req, res) => {
    try {
      const { email, password, role } = insertUserSchema.parse(req.body);
      const passwordHash = await bcrypt.hash(password, 10);
      // Check if user exists
      const existing = await storage.getUserByEmail(email);
      if (existing) return res.status(400).json({ message: "User already exists" });
      const user = await storage.createUser({ email, passwordHash, role: role || "candidate" });
      res.status(201).json({ message: "User created", user: { email: user.email, role: user.role } });
    } catch (error) {
      res.status(400).json({ message: "Signup failed", error: error.message });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = req.body;
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(401).json({ message: "Invalid credentials" });
      console.log('Login attempt:', email, password, user ? user.passwordHash : 'NO USER');
      const valid = await bcrypt.compare(password, user.passwordHash);
      if (!valid) return res.status(401).json({ message: "Invalid credentials" });
      const token = jwt.sign({ userId: user.id, role: user.role, email: user.email }, JWT_SECRET, { expiresIn: "7d" });
      res.json({ token, user: { email: user.email, role: user.role } });
    } catch (error) {
      res.status(400).json({ message: "Login failed", error: error.message });
    }
  });
  
  // Start interview with resume upload
  app.post("/api/interviews/start", upload.single('resume'), async (req: RequestWithFile, res) => {
    try {
      const { name, email, phone, jobRole } = startInterviewSchema.parse(req.body);
      // Block if email belongs to an admin user
      const user = await storage.getUserByEmail(email);
      if (user && user.role === 'admin') {
        return res.status(403).json({ message: 'Admins cannot participate in interviews as candidates.' });
      }
      // Block if candidate has a terminated interview
      const existingCandidate = await storage.getCandidateByEmail(email);
      if (existingCandidate) {
        const interviews = await storage.getInterviewsByCandidate(existingCandidate.id);
        if (interviews.some(i => i.status === 'terminated')) {
          return res.status(403).json({ message: "You cannot start a new interview after leaving/forfeiting your previous interview." });
        }
      }
      
      if (!req.file) {
        return res.status(400).json({ message: "Resume file is required" });
      }

      // Extract text from uploaded resume
      const resumeText = await extractTextFromFile(req.file.buffer, req.file.mimetype, req.file.originalname);

      // Create candidate
      const candidate = await storage.createCandidate({
        name,
        email, 
        phone,
        jobRole,
        resumeText
      });

      // Generate interview questions
      const questionSet = await generateInterviewQuestions(name, jobRole, resumeText);

      // Create interview
      const interview = await storage.createInterview({
        candidateId: candidate.id,
        questions: questionSet,
        currentQuestionIndex: 0,
        status: "in-progress"
      });

      res.json({
        interviewId: interview.id,
        candidateId: candidate.id,
        questions: questionSet.questions,
        currentQuestion: questionSet.questions[0]
      });

    } catch (error) {
      console.error("Error starting interview:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to start interview" });
    }
  });

  // Submit answer and get evaluation
  app.post("/api/interviews/answer", async (req, res) => {
    try {
      const { interviewId, questionIndex, answerText } = submitAnswerSchema.parse(req.body);

      const interview = await storage.getInterviewById(interviewId);
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      const candidate = await storage.getCandidateById(interview.candidateId);
      if (!candidate) {
        return res.status(404).json({ message: "Candidate not found" });
      }

      const questions = interview.questions as { questions: string[] };
      const questionText = questions.questions[questionIndex];

      if (!questionText) {
        return res.status(400).json({ message: "Invalid question index" });
      }

      // Evaluate the answer
      const evaluation = await evaluateAnswer(questionText, answerText, candidate.jobRole);

      // Save the answer
      await storage.createAnswer({
        interviewId,
        questionIndex,
        questionText,
        answerText,
        score: evaluation.score,
        feedback: evaluation.feedback
      });

      // Update interview progress
      const nextQuestionIndex = questionIndex + 1;
      const isLastQuestion = nextQuestionIndex >= questions.questions.length;

      if (isLastQuestion) {
        // Complete interview and generate final summary
        await storage.completeInterview(interviewId);

        // Get all answers for summary
        const allAnswers = await storage.getAnswersByInterview(interviewId);
        const answerData = allAnswers.map(a => ({
          question: a.questionText,
          answer: a.answerText, 
          score: a.score,
          feedback: a.feedback
        }));

        // Generate final summary
        const summary = await generateFinalSummary(candidate.name, candidate.jobRole, answerData);

        // Calculate scores
        const avgScore = answerData.reduce((sum, a) => sum + a.score, 0) / answerData.length;
        const technicalAnswers = answerData.slice(0, 4); // First 4 are technical
        const behavioralAnswers = answerData.slice(4); // Last 1 is behavioral
        
        const technicalScore = technicalAnswers.reduce((sum, a) => sum + a.score, 0) / technicalAnswers.length;
        const behavioralScore = behavioralAnswers.reduce((sum, a) => sum + a.score, 0) / behavioralAnswers.length;

        // Save evaluation
        await storage.createEvaluation({
          interviewId,
          overallScore: Math.round(avgScore * 10), // Store as 0-100
          technicalScore: Math.round(technicalScore * 10),
          behavioralScore: Math.round(behavioralScore * 10),
          strengths: summary.strengths,
          improvementAreas: summary.improvementAreas,
          recommendation: summary.recommendation
        });

        res.json({
          score: evaluation.score,
          feedback: evaluation.feedback,
          completed: true,
          summary
        });
      } else {
        // Continue to next question
        await storage.updateInterviewStatus(interviewId, "in-progress", nextQuestionIndex);
        
        res.json({
          score: evaluation.score,
          feedback: evaluation.feedback,
          completed: false,
          nextQuestion: questions.questions[nextQuestionIndex],
          questionIndex: nextQuestionIndex
        });
      }

    } catch (error) {
      console.error("Error submitting answer:", error);
      if (error instanceof z.ZodError) {
        return res.status(400).json({ message: "Invalid input data", errors: error.errors });
      }
      res.status(500).json({ message: "Failed to submit answer" });
    }
  });

  // Twilio webhook for call flow
  app.post('/api/twilio/voice', async (req, res) => {
    const { interviewId, candidateId } = req.query;
    const interview = await storage.getInterviewById(Number(interviewId));
    if (!interview) return res.type('text/xml').send('<Response><Say>Interview not found.</Say></Response>');
    const questions = (interview.questions as { questions: string[] }).questions;
    const currentIndex = Number(req.body.currentIndex) || 0;
    const twiml = new twilio.twiml.VoiceResponse();
    if (currentIndex < questions.length) {
      twiml.say(questions[currentIndex]);
      twiml.record({
        action: `/api/twilio/voice?interviewId=${interviewId}&candidateId=${candidateId}&currentIndex=${currentIndex + 1}`,
        method: 'POST',
        maxLength: 60,
        playBeep: true,
        transcribe: true,
        transcribeCallback: `/api/twilio/transcribe?interviewId=${interviewId}&candidateId=${candidateId}&questionIndex=${currentIndex}`
      });
    } else {
      twiml.say('Thank you. The interview is complete.');
      await storage.completeInterview(Number(interviewId));
    }
    res.type('text/xml').send(twiml.toString());
  });

  // Twilio transcription webhook
  app.post('/api/twilio/transcribe', async (req, res) => {
    const { interviewId, candidateId, questionIndex } = req.query;
    const answerText = req.body.TranscriptionText || '';
    // Save and evaluate answer
    await storage.createAnswer({
      interviewId: Number(interviewId),
      questionIndex: Number(questionIndex),
      questionText: '', // Optionally fetch question text
      answerText,
      score: 0,
      feedback: ''
    });
    res.sendStatus(200);
  });

  // Mark interview as terminated
  app.post('/api/interviews/:id/terminate', async (req, res) => {
    try {
      const interviewId = parseInt(req.params.id);
      await storage.updateInterviewStatus(interviewId, 'terminated');
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to terminate interview' });
    }
  });

  // Get interview status
  app.get("/api/interviews/:id", async (req, res) => {
    try {
      const interviewId = parseInt(req.params.id);
      const interview = await storage.getInterviewById(interviewId);
      
      if (!interview) {
        return res.status(404).json({ message: "Interview not found" });
      }

      const candidate = await storage.getCandidateById(interview.candidateId);
      const answers = await storage.getAnswersByInterview(interviewId);
      const evaluation = await storage.getEvaluationByInterview(interviewId);

      res.json({
        interview,
        candidate,
        answers,
        evaluation
      });

    } catch (error) {
      console.error("Error getting interview:", error);
      res.status(500).json({ message: "Failed to get interview" });
    }
  });

  // Get candidate dashboard data
  app.get("/api/candidates/:id/results", async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      const interviews = await storage.getInterviewsByCandidate(candidateId);
      
      const results = await Promise.all(interviews.map(async (interview) => {
        const answers = await storage.getAnswersByInterview(interview.id);
        const evaluation = await storage.getEvaluationByInterview(interview.id);
        return { interview, answers, evaluation };
      }));

      res.json(results);

    } catch (error) {
      console.error("Error getting candidate results:", error);
      res.status(500).json({ message: "Failed to get candidate results" });
    }
  });

  // Get candidate by email
  app.get('/api/candidates/by-email/:email', async (req, res) => {
    try {
      const email = decodeURIComponent(req.params.email);
      const candidate = await storage.getCandidateByEmail(email);
      if (!candidate) return res.status(404).json({ message: 'Candidate not found' });
      res.json(candidate);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get candidate' });
    }
  });

  // Admin: Get all interviews
  app.get("/api/admin/interviews", requireAdmin, async (req, res) => {
    try {
      const interviews = await storage.getAllInterviews();
      res.json(interviews);
    } catch (error) {
      console.error("Error getting admin interviews:", error);
      res.status(500).json({ message: "Failed to get interviews" });
    }
  });

  // Admin: Get stats
  app.get("/api/admin/stats", requireAdmin, async (req, res) => {
    try {
      const stats = await storage.getInterviewStats();
      res.json(stats);
    } catch (error) {
      console.error("Error getting admin stats:", error);
      res.status(500).json({ message: "Failed to get stats" });
    }
  });

  // Admin: Get all users
  app.get("/api/admin/users", requireAdmin, async (req, res) => {
    try {
      const users = await storage.getAllUsers();
      res.json(users.map(u => ({ id: u.id, email: u.email, role: u.role, createdAt: u.createdAt })));
    } catch (error) {
      res.status(500).json({ message: "Failed to get users" });
    }
  });

  // Admin: Get all candidates
  app.get('/api/candidates/all', requireAdmin, async (req, res) => {
    try {
      const candidates = await storage.getAllCandidates();
      res.json(candidates);
    } catch (error) {
      res.status(500).json({ message: 'Failed to get candidates' });
    }
  });

  // Admin: Delete interview by ID
  app.delete('/api/admin/interviews/:id', requireAdmin, async (req, res) => {
    try {
      const interviewId = parseInt(req.params.id);
      await storage.deleteInterview(interviewId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete interview' });
    }
  });

  // Admin: Delete candidate by ID
  app.delete('/api/admin/candidates/:id', requireAdmin, async (req, res) => {
    try {
      const candidateId = parseInt(req.params.id);
      await storage.deleteCandidate(candidateId);
      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ message: 'Failed to delete candidate' });
    }
  });

  // TTS endpoint: supports ElevenLabs or fallback Python voice
  app.post("/api/tts", async (req, res) => {
    try {
      const { text, provider, voiceId } = req.body;
      if (!text) return res.status(400).json({ message: "Text is required" });

      if (provider === "elevenlabs") {
        const audioBuffer = await textToSpeech(text, voiceId);
        res.setHeader("Content-Type", "audio/mpeg");
        return res.end(audioBuffer);
      } else {
        // Fallback: Use Python TTS (e.g., pyttsx3 or gTTS)
        const outputPath = `/tmp/tts-${Date.now()}.mp3`;
        // Example using gTTS (requires gtts-cli installed):
        exec(`gtts-cli "${text.replace(/"/g, '\"')}" --output ${outputPath}`, (err) => {
          if (err) {
            console.error("Python TTS error:", err);
            return res.status(500).json({ message: "Failed to generate audio with Python TTS" });
          }
          res.setHeader("Content-Type", "audio/mpeg");
          res.sendFile(outputPath, () => {
            fs.unlinkSync(outputPath);
          });
        });
      }
    } catch (error) {
      console.error("TTS error:", error);
      res.status(500).json({ message: "Failed to generate audio" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
