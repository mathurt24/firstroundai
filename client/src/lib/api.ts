import { apiRequest } from "./queryClient";

export interface StartInterviewRequest {
  name: string;
  email: string;
  phone: string;
  jobRole: string;
  resume: File;
}

export interface StartInterviewResponse {
  interviewId: number;
  candidateId: number;
  questions: string[];
  currentQuestion: string;
}

export interface SubmitAnswerRequest {
  interviewId: number;
  questionIndex: number;
  answerText: string;
}

export interface SubmitAnswerResponse {
  score: number;
  feedback: string;
  completed: boolean;
  nextQuestion?: string;
  questionIndex?: number;
  summary?: {
    strengths: string;
    improvementAreas: string;
    finalRating: number;
    recommendation: string;
  };
}

export async function startInterview(data: StartInterviewRequest): Promise<StartInterviewResponse> {
  const formData = new FormData();
  formData.append('name', data.name);
  formData.append('email', data.email);
  formData.append('phone', data.phone);
  formData.append('jobRole', data.jobRole);
  formData.append('resume', data.resume);

  const response = await fetch('/api/interviews/start', {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.message || 'Failed to start interview');
  }

  return response.json();
}

export async function submitAnswer(data: SubmitAnswerRequest): Promise<SubmitAnswerResponse> {
  const response = await apiRequest('POST', '/api/interviews/answer', data);
  return response.json();
}

export async function getInterview(id: number) {
  const response = await apiRequest('GET', `/api/interviews/${id}`);
  return response.json();
}

export async function getCandidateResults(candidateId: number) {
  const response = await apiRequest('GET', `/api/candidates/${candidateId}/results`);
  return response.json();
}

export async function getAdminInterviews() {
  const response = await apiRequestWithAuth('GET', '/api/admin/interviews');
  return response.json();
}

export async function getAdminStats() {
  const response = await apiRequestWithAuth('GET', '/api/admin/stats');
  return response.json();
}

export async function getAllUsers() {
  const res = await apiRequestWithAuth('GET', '/api/admin/users');
  return res.json();
}

export async function getAllCandidates() {
  const response = await apiRequestWithAuth('GET', '/api/candidates/all');
  return response.json();
}

export async function deleteInterview(id: number) {
  const response = await apiRequestWithAuth('DELETE', `/api/admin/interviews/${id}`);
  return response.json();
}

export async function deleteCandidate(id: number) {
  const response = await apiRequestWithAuth('DELETE', `/api/admin/candidates/${id}`);
  return response.json();
}

export function setAuthToken(token: string) {
  localStorage.setItem('authToken', token);
}
export function getAuthToken(): string | null {
  return localStorage.getItem('authToken');
}
export function removeAuthToken() {
  localStorage.removeItem('authToken');
}

export async function login(email: string, password: string) {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password })
  });
  if (!response.ok) throw new Error((await response.json()).message || 'Login failed');
  return response.json();
}

export async function signup(email: string, password: string, role?: string) {
  const response = await fetch('/api/auth/signup', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email, password, role })
  });
  if (!response.ok) throw new Error((await response.json()).message || 'Signup failed');
  return response.json();
}

export async function apiRequestWithAuth(method: string, url: string, data?: unknown) {
  const token = getAuthToken();
  const headers: Record<string, string> = data ? { 'Content-Type': 'application/json' } : {};
  if (token) headers['Authorization'] = `Bearer ${token}`;
  const res = await fetch(url, {
    method,
    headers,
    body: data ? JSON.stringify(data) : undefined,
    credentials: 'include',
  });
  if (!res.ok) throw new Error((await res.text()) || res.statusText);
  return res;
}

export interface User {
  email: string;
  role: string;
}

export function getUserFromToken(token: string | null): User | null {
  if (!token) return null;
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return { email: payload.email || '', role: payload.role };
  } catch {
    return null;
  }
}
