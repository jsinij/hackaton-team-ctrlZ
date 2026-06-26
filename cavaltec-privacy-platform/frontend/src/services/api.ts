import axios, { type AxiosInstance } from 'axios'

// ─── Domain types ────────────────────────────────────────────────────────────

export interface User {
  id: string
  email: string
  name: string
  company_id?: string
}

export interface Company {
  id: string
  name: string
  nit: string
  sector: string
  size: string
  owner_id: string
}

export type AnswerValue = 'yes' | 'no' | 'partial'

export interface Answer {
  question_id: string
  value: AnswerValue
}

export interface GapDetail {
  id: string
  text: string
  reference: string
  category: string
  weight: number
}

export interface AssessmentResult {
  id: string
  company_id: string
  status: string
  score: number
  gaps: string[]
  gap_details: GapDetail[]
  completed_at: string
}

export interface Assessment {
  id: string
  company_id: string
  user_id?: string
  status: 'in_progress' | 'completed'
  answers: Record<string, string>
  score?: number
  gaps?: string[]
  created_at: string
  completed_at?: string
}

export interface ChatMessage {
  role: 'user' | 'assistant'
  content: string
}

// ─── Factory ─────────────────────────────────────────────────────────────────

export function createApiClient(token: string): AxiosInstance {
  return axios.create({
    baseURL: '/api',
    headers: { Authorization: `Bearer ${token}` },
  })
}

// ─── Auth ────────────────────────────────────────────────────────────────────

export async function firebaseLogin(
  client: AxiosInstance,
  idToken: string,
): Promise<User> {
  const { data } = await client.post<User>('/auth/firebase-login', { id_token: idToken })
  return data
}

// ─── User ────────────────────────────────────────────────────────────────────

export async function getMe(client: AxiosInstance): Promise<User> {
  const { data } = await client.get<User>('/users/me')
  return data
}

// ─── Companies ───────────────────────────────────────────────────────────────

export type CompanyPayload = Pick<Company, 'name' | 'nit' | 'sector' | 'size'>

export async function createCompany(
  client: AxiosInstance,
  payload: CompanyPayload,
): Promise<Company> {
  const { data } = await client.post<Company>('/companies', payload)
  return data
}

export async function getCompany(
  client: AxiosInstance,
  id: string,
): Promise<Company> {
  const { data } = await client.get<Company>(`/companies/${id}`)
  return data
}

export async function updateCompany(
  client: AxiosInstance,
  id: string,
  payload: Partial<CompanyPayload>,
): Promise<Company> {
  const { data } = await client.put<Company>(`/companies/${id}`, payload)
  return data
}

export async function getCompanies(client: AxiosInstance): Promise<Company[]> {
  const { data } = await client.get<Company[]>('/companies')
  return data
}

// ─── Assessments ─────────────────────────────────────────────────────────────

export async function createAssessment(
  client: AxiosInstance,
  companyId: string,
): Promise<Assessment> {
  const { data } = await client.post<Assessment>('/assessments', { company_id: companyId })
  return data
}

export async function getAssessment(
  client: AxiosInstance,
  id: string,
): Promise<Assessment> {
  const { data } = await client.get<Assessment>(`/assessments/${id}`)
  return data
}

const ANSWER_VALUE_MAP: Record<AnswerValue, string> = {
  yes: 'si',
  partial: 'parcial',
  no: 'no',
}

export async function submitAnswers(
  client: AxiosInstance,
  id: string,
  answers: Answer[],
): Promise<Assessment> {
  const answersDict = Object.fromEntries(
    answers.map(({ question_id, value }) => [question_id, ANSWER_VALUE_MAP[value]]),
  )
  const { data } = await client.put<Assessment>(`/assessments/${id}/answers`, { answers: answersDict })
  return data
}

export async function completeAssessment(
  client: AxiosInstance,
  id: string,
): Promise<AssessmentResult> {
  const { data } = await client.post<AssessmentResult>(`/assessments/${id}/complete`)
  return data
}

export async function getCompanyAssessments(
  client: AxiosInstance,
  companyId: string,
): Promise<Assessment[]> {
  const { data } = await client.get<Assessment[]>(`/companies/${companyId}/assessments`)
  return data
}

// ─── AI helpers ──────────────────────────────────────────────────────────────

export async function explainQuestion(
  client: AxiosInstance,
  questionId: string,
): Promise<{ explanation: string }> {
  const { data } = await client.get<{ explanation: string }>(
    `/ai/explain-question/${questionId}`,
  )
  return data
}

export async function getAnswerGuidance(
  client: AxiosInstance,
  questionId: string,
): Promise<{ guidance: string }> {
  const { data } = await client.get<{ guidance: string }>(
    `/ai/answer-guidance/${questionId}`,
  )
  return data
}

export async function getRecommendations(
  client: AxiosInstance,
  assessmentId: string,
): Promise<{ recommendations: string[] }> {
  const { data } = await client.get<{ recommendations: string[] }>(
    `/ai/recommendations/${assessmentId}`,
  )
  return data
}

export async function interpretScore(
  client: AxiosInstance,
  assessmentId: string,
): Promise<{ interpretation: string }> {
  const { data } = await client.get<{ interpretation: string }>(
    `/ai/interpret-score/${assessmentId}`,
  )
  return data
}

// ─── Reports ─────────────────────────────────────────────────────────────────

export async function downloadReport(
  client: AxiosInstance,
  assessmentId: string,
): Promise<Blob> {
  const { data } = await client.get<Blob>(`/reports/${assessmentId}/pdf`, {
    responseType: 'blob',
  })
  return data
}

export async function deleteAssessment(
  client: AxiosInstance,
  id: string,
): Promise<void> {
  await client.delete(`/assessments/${id}`)
}

export async function chatWithAgent(
  client: AxiosInstance,
  assessmentId: string,
  message: string,
  history: ChatMessage[],
): Promise<string> {
  const { data } = await client.post<{ message: string }>('/ai/chat', {
    assessment_id: assessmentId,
    message,
    history,
  })
  return data.message
}

export async function questionChat(
  client: AxiosInstance,
  questionId: string,
  mode: 'explain' | 'guidance' | 'followup',
  message: string,
  history: ChatMessage[],
): Promise<string> {
  const { data } = await client.post<{ message: string }>('/ai/question-chat', {
    question_id: questionId,
    mode,
    message,
    history,
  })
  return data.message
}
