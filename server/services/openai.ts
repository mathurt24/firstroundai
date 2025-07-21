import { GoogleGenerativeAI } from "@google/generative-ai";
import type { QuestionSet, AnswerEvaluation, InterviewSummary } from "@shared/schema";
import { generateMockQuestions, evaluateMockAnswer, generateMockSummary } from "./mock-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);
const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

function extractJson(text: string) {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) throw new Error("No JSON found in Gemini response");
  return JSON.parse(match[0]);
}

export async function generateInterviewQuestions(
  candidateName: string,
  jobRole: string,
  resumeText: string
): Promise<QuestionSet> {
  if (!process.env.GEMINI_API_KEY) {
    console.log("Using mock AI for question generation (Gemini not available)");
    return generateMockQuestions(candidateName, jobRole, resumeText);
  }

  const prompt = `You are Tushar, a professional AI interviewer. Analyze the candidate's resume and generate exactly 10 unique, highly technical, and non-repetitive interview questions.\n\nCandidate Name: ${candidateName}\nJob Role: ${jobRole}\nResume Text: ${resumeText}\n\nGenerate:\n- 6 deep technical questions relevant to the resume and job role (each must cover a different topic, technology, or skill from the resume)\n- 2 coding questions (require the candidate to write or explain code, algorithms, or solve a real-world problem; tailor these to the candidate's experience and stack)\n- 2 behavioral questions (e.g., team conflict, failure, leadership, communication)\n\nMake questions specific, challenging, and avoid repetition or generic topics. For coding questions, ask for code snippets, algorithm design, or debugging. For technical questions, go beyond definitions—ask about architecture, optimization, trade-offs, or real-world scenarios. Consider the candidate's domain and technical stack from their resume.\n\nRespond with JSON in this format:\n{\n  "questions": [\n    "Question 1...",\n    ...\n    "Question 10..."\n  ]\n}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const json = extractJson(text);
    if (!json.questions || !Array.isArray(json.questions) || json.questions.length !== 10) {
      throw new Error("Invalid question format from Gemini");
    }
    return json as QuestionSet;
  } catch (error) {
    console.error("Error generating questions:", error);
    return generateMockQuestions(candidateName, jobRole, resumeText);
  }
}

export async function evaluateAnswer(
  question: string,
  answer: string,
  jobRole: string
): Promise<AnswerEvaluation> {
  if (!process.env.GEMINI_API_KEY) {
    console.log("Using mock AI for answer evaluation (Gemini not available)");
    return evaluateMockAnswer(question, answer, jobRole);
  }

  const prompt = `You are Tushar, evaluating a candidate's interview answer. \n\nJob Role: ${jobRole}\nQuestion: ${question}\nAnswer: ${answer}\n\nEvaluate this answer considering:\n- Clarity and correctness\n- Technical depth (if applicable)  \n- Communication skills\n- Domain expertise\n\nProvide a score from 0-10 and 1-2 lines of constructive feedback.\n\nRespond with JSON:\n{\n  "score": 8,\n  "feedback": "Good explanation, but consider mentioning specific examples."\n}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const json = extractJson(text);
    if (typeof json.score !== "number" || json.score < 0 || json.score > 10) {
      throw new Error("Invalid score from Gemini evaluation");
    }
    return {
      score: Math.round(json.score),
      feedback: json.feedback || "No feedback provided"
    };
  } catch (error) {
    console.error("Error evaluating answer:", error);
    return evaluateMockAnswer(question, answer, jobRole);
  }
}

export async function generateFinalSummary(
  candidateName: string,
  jobRole: string,
  answers: Array<{ question: string; answer: string; score: number; feedback: string }>
): Promise<InterviewSummary> {
  if (!process.env.GEMINI_API_KEY) {
    console.log("Using mock AI for final summary (Gemini not available)");
    return generateMockSummary(candidateName, jobRole, answers);
  }

  const answersText = answers.map((a, i) => 
    `Q${i+1}: ${a.question}\nAnswer: ${a.answer}\nScore: ${a.score}/10\nFeedback: ${a.feedback}`
  ).join("\n\n");

  const prompt = `You are Tushar, providing a final interview summary for ${candidateName} applying for ${jobRole}.\n\nInterview Answers and Scores:\n${answersText}\n\nGenerate a comprehensive summary with:\n- Key strengths (2-3 points)\n- Improvement areas (2-3 points) \n- Final rating out of 10 (based on average performance)\n- Recommendation: "Hire" (8+ average), "Maybe" (6-7 average), or "No" (<6 average)\n\nRespond with JSON:\n{\n  "strengths": "Strong technical foundation and clear communication skills.",\n  "improvementAreas": "Could benefit from more hands-on experience with cloud platforms.",\n  "finalRating": 7.5,\n  "recommendation": "Maybe"\n}`;

  try {
    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();
    const json = extractJson(text);
    if (!["Hire", "Maybe", "No"].includes(json.recommendation)) {
      throw new Error("Invalid recommendation from Gemini");
    }
    return {
      strengths: json.strengths || "No strengths identified",
      improvementAreas: json.improvementAreas || "No improvement areas identified", 
      finalRating: Math.max(0, Math.min(10, json.finalRating || 0)),
      recommendation: json.recommendation
    };
  } catch (error) {
    console.error("Error generating summary:", error);
    return generateMockSummary(candidateName, jobRole, answers);
  }
}
