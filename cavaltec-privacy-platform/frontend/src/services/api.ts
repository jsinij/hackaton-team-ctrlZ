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

export interface Gap {
  question_id: string
  question_text: string
  category: string
  recommendation: string
}

export interface AssessmentResult {
  score: number
  level: string
  gaps: Gap[]
  recommendations: string[]
  interpretation: string
}

export interface Assessment {
  id: string
  company_id: string
  company_name?: string
  status: 'in_progress' | 'completed'
  answers: Answer[]
  result?: AssessmentResult
  created_at: string
  completed_at?: string
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

export async function submitAnswers(
  client: AxiosInstance,
  id: string,
  answers: Answer[],
): Promise<Assessment> {
  const { data } = await client.put<Assessment>(`/assessments/${id}/answers`, { answers })
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
