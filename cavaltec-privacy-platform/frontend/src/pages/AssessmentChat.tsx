import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useApi } from '../hooks/useApi'
import {
  createAssessment,
  getAssessment,
  getCompanies,
  submitAnswers,
  completeAssessment,
  downloadReport,
  chatWithAgent,
  questionChat,
  type Company,
  type Assessment,
  type AssessmentResult,
  type Answer,
  type AnswerValue,
  type ChatMessage,
} from '../services/api'
import Layout from '../components/Layout'
import ScoreGauge from '../components/ScoreGauge'

// ─── Static question bank ─────────────────────────────────────────────────────

export const QUESTIONS = [
  // ── Política de datos personales — máx. 40% ──────────────────────────────
  {
    id: 'P1',
    text: '¿Cuenta con una política de tratamiento de datos personales?',
    category: 'Política de datos personales',
    weight: 0,
    isGate: true,
    gateChildren: ['P2', 'P3', 'P4', 'P5'] as string[],
    note: 'Si responde No, las siguientes 4 preguntas se omitirán automáticamente.',
  },
  {
    id: 'P2',
    text: '¿La política está documentada y publicada en medio de fácil acceso?',
    category: 'Política de datos personales',
    weight: 10,
  },
  {
    id: 'P3',
    text: '¿La política define las finalidades del tratamiento de datos?',
    category: 'Política de datos personales',
    weight: 10,
  },
  {
    id: 'P4',
    text: '¿La política incluye los derechos de los titulares?',
    category: 'Política de datos personales',
    weight: 10,
  },
  {
    id: 'P5',
    text: '¿La política menciona cómo ejercer los derechos de los titulares?',
    category: 'Política de datos personales',
    weight: 10,
  },
  // ── Privacidad desde el diseño — máx. 36% ────────────────────────────────
  {
    id: 'P6',
    text: '¿Incorpora evaluaciones de impacto (Privacy Impact Assessments)?',
    category: 'Privacidad desde el diseño',
    weight: 12,
  },
  {
    id: 'P7',
    text: '¿Aplica técnicas de minimización de datos?',
    category: 'Privacidad desde el diseño',
    weight: 12,
  },
  {
    id: 'P8',
    text: '¿Configura sus sistemas para recopilar el mínimo de datos por defecto?',
    category: 'Privacidad desde el diseño',
    weight: 12,
  },
  // ── Gobernanza — máx. 24% ─────────────────────────────────────────────────
  {
    id: 'P9',
    text: '¿Cuenta con un sistema de administración de riesgos?',
    category: 'Gobernanza',
    weight: 16,
  },
  {
    id: 'P10',
    text: '¿Cuenta con un oficial de protección de datos personales?',
    category: 'Gobernanza',
    weight: 8,
  },
  {
    id: 'P11',
    text: '¿El oficial de protección de datos está designado formalmente?',
    category: 'Gobernanza',
    weight: 0,
    complementary: true,
    note: 'Pregunta complementaria — no afecta el puntaje.',
  },
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ProgressBar({ current, total }: { current: number; total: number }) {
  const pct = Math.round((current / total) * 100)
  return (
    <div className="mb-6">
      <div className="flex justify-between text-xs text-gray-500 mb-1.5">
        <span>Pregunta {current} de {total}</span>
        <span>{pct}%</span>
      </div>
      <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
        <div
          className="h-full bg-blue-700 rounded-full transition-all duration-400"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

interface QuestionChatDrawerProps {
  title: string
  messages: ChatMessage[]
  loading: boolean
  input: string
  onInputChange: (v: string) => void
  onSend: (e: React.FormEvent) => void
  onClose: () => void
}

function QuestionChatDrawer({
  title, messages, loading, input, onInputChange, onSend, onClose,
}: QuestionChatDrawerProps) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, loading])

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative z-50 w-full max-w-sm bg-white shadow-xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center shrink-0">
              <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3">
          {messages.map((msg, i) => (
            <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap ${
                msg.role === 'user'
                  ? 'bg-blue-700 text-white rounded-tr-sm'
                  : 'bg-gray-100 text-gray-800 rounded-tl-sm'
              }`}>
                {msg.content}
              </div>
            </div>
          ))}
          {loading && <TypingIndicator />}
          <div ref={bottomRef} />
        </div>

        {/* Input */}
        <form onSubmit={onSend} className="px-4 py-3 border-t border-gray-100 flex gap-2 shrink-0">
          <input
            type="text"
            value={input}
            onChange={(e) => onInputChange(e.target.value)}
            placeholder="Pregunta al agente..."
            disabled={loading}
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-3 py-2 transition-colors disabled:opacity-50"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
            </svg>
          </button>
        </form>
      </aside>
    </div>
  )
}

function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div className="bg-gray-100 rounded-2xl rounded-tl-sm px-4 py-3">
        <div className="flex gap-1 items-center h-4">
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
          <span className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

type QuestionChatMode = 'explain' | 'guidance'

export default function AssessmentChat() {
  const getClient = useApi()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const assessmentIdParam = searchParams.get('id')

  // Show landing screen for new assessments; skip it when resuming via URL param
  const [started, setStarted] = useState(!!assessmentIdParam)

  // Company selector on landing page
  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [companiesLoading, setCompaniesLoading] = useState(false)
  // Ref holds the company ID at the moment "Comenzar" is clicked, safe for the init effect
  const companyIdRef = useRef<string>('')

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [loadingInit, setLoadingInit] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // Chat state
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([])
  const [chatInput, setChatInput] = useState('')
  const [chatLoading, setChatLoading] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)

  // Question chat drawer
  const [qChatMode, setQChatMode] = useState<QuestionChatMode | null>(null)
  const [qChatMessages, setQChatMessages] = useState<ChatMessage[]>([])
  const [qChatInput, setQChatInput] = useState('')
  const [qChatLoading, setQChatLoading] = useState(false)

  // ── Load companies for landing selector ──────────────────────────────────

  useEffect(() => {
    if (assessmentIdParam) return  // resuming, no need for selector
    let cancelled = false
    const load = async () => {
      setCompaniesLoading(true)
      try {
        const client = await getClient()
        const list = await getCompanies(client)
        if (!cancelled) {
          setCompanies(list)
          if (list.length > 0) {
            setSelectedCompanyId(list[0].id)
          }
        }
      } catch {
        // silently ignore — user will see the empty selector
      } finally {
        if (!cancelled) setCompaniesLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getClient])

  // ── Scroll chat to bottom on new messages ─────────────────────────────────

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [chatMessages, chatLoading])

  // ── Auto-trigger initial AI analysis when result loads ────────────────────

  useEffect(() => {
    if (!result || !assessment) return

    const triggerInitialAnalysis = async () => {
      setChatLoading(true)
      try {
        const client = await getClient()
        const msg = await chatWithAgent(
          client,
          assessment.id,
          'Analiza los resultados de mi evaluación y proporciona recomendaciones específicas y accionables para mejorar el cumplimiento de la Ley 1581. Menciona las brechas más críticas, sus implicaciones legales y los pasos concretos que debo seguir.',
          [],
        )
        setChatMessages([{ role: 'assistant', content: msg }])
      } catch {
        setChatMessages([{
          role: 'assistant',
          content:
            'Hola, soy tu asistente especializado en Ley 1581. Puedo ayudarte a interpretar tus resultados y resolver dudas sobre protección de datos en Colombia. ¿Qué quieres saber?',
        }])
      } finally {
        setChatLoading(false)
      }
    }

    void triggerInitialAnalysis()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result?.id])

  // ── Initialise assessment (only after user clicks "Comenzar") ────────────

  useEffect(() => {
    if (!started) return

    let cancelled = false

    const init = async () => {
      setLoadingInit(true)
      setError(null)
      try {
        const client = await getClient()
        let a: Assessment

        if (assessmentIdParam) {
          a = await getAssessment(client, assessmentIdParam)
        } else {
          const companyId = companyIdRef.current
          if (!companyId) {
            navigate('/empresa')
            return
          }
          a = await createAssessment(client, companyId)
          const url = new URL(window.location.href)
          url.searchParams.set('id', a.id)
          window.history.replaceState({}, '', url.toString())
        }

        if (!cancelled) {
          setAssessment(a)

          if (a.status === 'completed') {
            // Re-fetch as AssessmentResult shape via complete — but assessment IS the result here
            // We build a minimal AssessmentResult from the Assessment data
            setResult({
              id: a.id,
              company_id: a.company_id,
              status: a.status,
              score: a.score ?? 0,
              gaps: a.gaps ?? [],
              gap_details: [],
              completed_at: a.completed_at ?? a.created_at,
            })
          } else {
            const backendToFrontend: Record<string, AnswerValue> = {
              si: 'yes', parcial: 'partial', no: 'no',
            }
            const restored: Record<string, AnswerValue> = {}
            Object.entries(a.answers).forEach(([qid, val]) => {
              restored[qid] = backendToFrontend[val] ?? (val as AnswerValue)
            })
            setAnswers(restored)
            // If P1 was answered "no", the gate children were auto-skipped
            const p1WasNo = restored['P1'] === 'no'
            const firstUnanswered = QUESTIONS.findIndex((q) => {
              if (p1WasNo && ['P2', 'P3', 'P4', 'P5'].includes(q.id)) return false
              return !restored[q.id]
            })
            setCurrentIndex(firstUnanswered === -1 ? QUESTIONS.length - 1 : firstUnanswered)
          }
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar la evaluacion. Intenta de nuevo.')
      } finally {
        if (!cancelled) setLoadingInit(false)
      }
    }

    void init()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [started])

  // ── Answer a question ──────────────────────────────────────────────────────

  const handleAnswer = async (value: AnswerValue) => {
    const question = QUESTIONS[currentIndex]
    if (!question || !assessment) return

    // Gate logic: P1 = "no" auto-answers its children as "no"
    let newAnswers = { ...answers, [question.id]: value }
    if (question.isGate && value === 'no' && question.gateChildren) {
      question.gateChildren.forEach((childId) => {
        newAnswers[childId] = 'no'
      })
    }
    setAnswers(newAnswers)

    setSubmitting(true)
    try {
      const client = await getClient()
      const answersArr: Answer[] = Object.entries(newAnswers).map(([question_id, v]) => ({
        question_id,
        value: v,
      }))
      await submitAnswers(client, assessment.id, answersArr)

      // Determine next index, skipping gate children if P1 = "no"
      let nextIndex = currentIndex + 1
      if (question.isGate && value === 'no' && question.gateChildren) {
        const firstAfterGate = QUESTIONS.findIndex(
          (q) => !question.gateChildren!.includes(q.id) && QUESTIONS.indexOf(q) > currentIndex
        )
        if (firstAfterGate !== -1) nextIndex = firstAfterGate
      }

      const isLast = nextIndex >= QUESTIONS.length
      if (isLast) {
        setCompleting(true)
        const res = await completeAssessment(client, assessment.id)
        setResult(res)
        setCompleting(false)
      } else {
        setCurrentIndex(nextIndex)
      }
    } catch {
      setError('Error al guardar la respuesta. Intenta de nuevo.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Chat ───────────────────────────────────────────────────────────────────

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!chatInput.trim() || !assessment || chatLoading) return

    const userMessage = chatInput.trim()
    setChatInput('')

    const history = [...chatMessages]
    const newMessages: ChatMessage[] = [...history, { role: 'user', content: userMessage }]
    setChatMessages(newMessages)
    setChatLoading(true)

    try {
      const client = await getClient()
      const response = await chatWithAgent(client, assessment.id, userMessage, history)
      setChatMessages([...newMessages, { role: 'assistant', content: response }])
    } catch {
      setChatMessages([...newMessages, {
        role: 'assistant',
        content: 'Lo siento, no pude procesar tu consulta. Intenta de nuevo.',
      }])
    } finally {
      setChatLoading(false)
    }
  }

  // ── Question chat drawer ──────────────────────────────────────────────────

  const openQuestionChat = useCallback(async (mode: QuestionChatMode) => {
    const question = QUESTIONS[currentIndex]
    if (!question) return

    const initialPrompt = mode === 'explain'
      ? `¿Qué significa esta pregunta y por qué es importante para el cumplimiento de la Ley 1581?`
      : `¿Cómo debo responder esta pregunta? ¿Qué evidencias o documentos necesito para responder "Sí"?`

    setQChatMode(mode)
    setQChatMessages([])
    setQChatInput('')
    setQChatLoading(true)

    try {
      const client = await getClient()
      const response = await questionChat(client, question.id, mode, initialPrompt, [])
      setQChatMessages([{ role: 'assistant', content: response }])
    } catch {
      setQChatMessages([{ role: 'assistant', content: 'No se pudo obtener la información del agente. Intenta de nuevo.' }])
    } finally {
      setQChatLoading(false)
    }
  }, [currentIndex, getClient])

  const handleQuestionChatSend = async (e: React.FormEvent) => {
    e.preventDefault()
    const question = QUESTIONS[currentIndex]
    if (!qChatInput.trim() || !question || qChatLoading) return

    const userMsg = qChatInput.trim()
    setQChatInput('')
    const history = [...qChatMessages]
    const newMessages: ChatMessage[] = [...history, { role: 'user', content: userMsg }]
    setQChatMessages(newMessages)
    setQChatLoading(true)

    try {
      const client = await getClient()
      const response = await questionChat(client, question.id, 'followup', userMsg, history)
      setQChatMessages([...newMessages, { role: 'assistant', content: response }])
    } catch {
      setQChatMessages([...newMessages, { role: 'assistant', content: 'No se pudo procesar tu consulta. Intenta de nuevo.' }])
    } finally {
      setQChatLoading(false)
    }
  }

  // ── Download ───────────────────────────────────────────────────────────────

  const handleDownload = async () => {
    if (!assessment) return
    setDownloading(true)
    try {
      const client = await getClient()
      const blob = await downloadReport(client, assessment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostico-ley1581-${assessment.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar el reporte.')
    } finally {
      setDownloading(false)
    }
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  const question = QUESTIONS[currentIndex]
  const answeredCount = Object.keys(answers).length

  const scoreColor = result
    ? result.score >= 80 ? 'text-green-600' : result.score >= 50 ? 'text-amber-600' : 'text-red-600'
    : ''
  const scoreLabel = result
    ? result.score >= 80 ? 'Cumplimiento Alto' : result.score >= 50 ? 'Cumplimiento Medio' : 'Cumplimiento Bajo'
    : ''

  return (
    <Layout>
      <div className="max-w-2xl mx-auto">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">Diagnostico Ley 1581</h1>
        <p className="text-sm text-gray-500 mb-7">
          Responde cada pregunta con base en la situacion actual de tu empresa.
        </p>

        {error && (
          <div className="mb-5 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
            {error}
            <button onClick={() => setError(null)} className="ml-2 underline text-red-600">Cerrar</button>
          </div>
        )}

        {!started ? (
          /* ── Landing screen ──────────────────────────────────────────────── */
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 max-w-lg mx-auto">
            <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-5">
              <svg className="w-7 h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>

            <h2 className="text-xl font-bold text-gray-900 text-center mb-1">
              Diagnostico de Cumplimiento
            </h2>
            <p className="text-sm text-gray-500 text-center mb-6">
              Ley 1581 de 2012 — Proteccion de Datos Personales
            </p>

            <div className="grid grid-cols-3 gap-3 mb-6">
              {[
                { value: `${QUESTIONS.length}`, label: 'Preguntas' },
                { value: '~7', label: 'Minutos' },
                { value: '3', label: 'Categorías' },
              ].map((item) => (
                <div key={item.label} className="bg-gray-50 rounded-lg p-3 text-center">
                  <p className="text-xl font-bold text-blue-700">{item.value}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{item.label}</p>
                </div>
              ))}
            </div>

            <div className="space-y-2.5 mb-6">
              {[
                { color: 'bg-teal-500', label: 'Politica de tratamiento de datos' },
                { color: 'bg-blue-500', label: 'Privacidad desde el diseno' },
                { color: 'bg-purple-500', label: 'Gobernanza y responsabilidad' },
              ].map((cat) => (
                <div key={cat.label} className="flex items-center gap-2.5 text-sm text-gray-700">
                  <span className={`w-2 h-2 rounded-full ${cat.color} shrink-0`} />
                  {cat.label}
                </div>
              ))}
            </div>

            <p className="text-xs text-gray-400 text-center mb-6">
              Al finalizar recibiras tu puntaje y recomendaciones personalizadas del agente IA.
            </p>

            {/* Company selector */}
            {companiesLoading ? (
              <div className="flex justify-center mb-4">
                <div className="w-5 h-5 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
              </div>
            ) : companies.length === 0 ? (
              <div className="mb-4 rounded-lg bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-700 text-center">
                Primero debes registrar una empresa antes de iniciar la evaluacion.
              </div>
            ) : (
              <div className="mb-4">
                <label htmlFor="landing-company" className="block text-xs font-medium text-gray-600 mb-1.5">
                  Empresa a evaluar
                </label>
                <select
                  id="landing-company"
                  value={selectedCompanyId}
                  onChange={(e) => setSelectedCompanyId(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                >
                  {companies.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
            )}

            <button
              onClick={() => {
                companyIdRef.current = selectedCompanyId
                setStarted(true)
              }}
              disabled={companies.length === 0 || companiesLoading}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-colors text-sm disabled:opacity-50"
            >
              Comenzar Evaluacion
            </button>

            {companies.length === 0 && !companiesLoading && (
              <button
                onClick={() => navigate('/empresa')}
                className="mt-2 w-full border border-blue-700 text-blue-700 font-semibold py-3 rounded-lg transition-colors text-sm hover:bg-blue-50"
              >
                Registrar empresa
              </button>
            )}
          </div>

        ) : loadingInit ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Preparando evaluacion...</p>
          </div>
        ) : result ? (
          /* ── Results + Chat ──────────────────────────────────────────────── */
          <div className="space-y-5">

            {/* Score card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 flex items-center justify-between gap-6">
              <div>
                <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">Porcentaje de cumplimiento</p>
                <p className="text-4xl font-bold text-gray-900">{result.score}<span className="text-2xl text-gray-400">/100</span></p>
                <p className={`text-sm font-semibold mt-1 ${scoreColor}`}>{scoreLabel}</p>
                <p className="text-xs text-gray-400 mt-2">
                  {result.gaps.length > 0
                    ? `${result.gaps.length} brecha${result.gaps.length > 1 ? 's' : ''} identificada${result.gaps.length > 1 ? 's' : ''}`
                    : 'Sin brechas detectadas'}
                </p>
              </div>
              <div className="flex flex-col items-end gap-3 shrink-0">
                <ScoreGauge score={result.score} size={110} />
                <button
                  onClick={() => { void handleDownload() }}
                  disabled={downloading}
                  className="text-xs text-blue-700 hover:text-blue-900 font-medium transition-colors disabled:opacity-50 flex items-center gap-1"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {downloading ? 'Generando PDF...' : 'Descargar PDF'}
                </button>
              </div>
            </div>

            {/* Chat card */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 flex flex-col" style={{ height: '480px' }}>
              <div className="px-5 py-3.5 border-b border-gray-100 flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-green-500" />
                <h2 className="text-sm font-semibold text-gray-800">Asistente IA — Ley 1581</h2>
                <span className="ml-auto text-xs text-gray-400">Experto en proteccion de datos Colombia</span>
              </div>

              {/* Messages */}
              <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4">
                {chatMessages.length === 0 && chatLoading && <TypingIndicator />}

                {chatMessages.map((msg, i) => (
                  <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed whitespace-pre-wrap ${
                        msg.role === 'user'
                          ? 'bg-blue-700 text-white rounded-tr-sm'
                          : 'bg-gray-100 text-gray-800 rounded-tl-sm'
                      }`}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))}

                {chatMessages.length > 0 && chatLoading && <TypingIndicator />}
                <div ref={chatEndRef} />
              </div>

              {/* Input */}
              <div className="px-5 py-3.5 border-t border-gray-100">
                <form onSubmit={(e) => { void handleSendMessage(e) }} className="flex gap-2">
                  <input
                    type="text"
                    value={chatInput}
                    onChange={(e) => setChatInput(e.target.value)}
                    placeholder="Pregunta al agente sobre Ley 1581..."
                    disabled={chatLoading}
                    className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent disabled:opacity-50"
                  />
                  <button
                    type="submit"
                    disabled={chatLoading || !chatInput.trim()}
                    className="bg-blue-700 hover:bg-blue-800 text-white rounded-lg px-4 py-2 transition-colors disabled:opacity-50"
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                    </svg>
                  </button>
                </form>
              </div>
            </div>

            {/* Nav buttons */}
            <div className="flex gap-3">
              <button
                onClick={() => navigate('/')}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2.5 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Volver al Dashboard
              </button>
              <button
                onClick={() => navigate('/historial')}
                className="flex-1 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors"
              >
                Ver historial
              </button>
            </div>
          </div>

        ) : completing ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-8 h-8 border-4 border-teal-600 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Calculando resultado...</p>
          </div>
        ) : (
          /* ── Question wizard ─────────────────────────────────────────────── */
          question && (
            <>
              <ProgressBar current={answeredCount + 1} total={QUESTIONS.length} />

              <div className={`bg-white rounded-xl shadow-sm border p-6 mb-4 ${question.complementary ? 'border-amber-200' : 'border-gray-100'}`}>
                <div className="flex items-center gap-2 mb-4 flex-wrap">
                  <span className="inline-block text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full">
                    {question.category}
                  </span>
                  {question.weight > 0 && (
                    <span className="inline-block text-xs font-medium text-blue-700 bg-blue-50 px-2.5 py-0.5 rounded-full">
                      {question.weight}% del puntaje
                    </span>
                  )}
                  {question.complementary && (
                    <span className="inline-block text-xs font-medium text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full">
                      Complementaria · no afecta puntaje
                    </span>
                  )}
                </div>

                <p className="text-base font-medium text-gray-900 mb-3 leading-snug">
                  {question.text}
                </p>

                {question.note && (
                  <p className="text-xs text-gray-500 mb-5 italic">{question.note}</p>
                )}

                <div className="flex gap-3">
                  {(['yes', 'partial', 'no'] as AnswerValue[]).map((val) => {
                    const labels: Record<AnswerValue, string> = {
                      yes: 'Sí',
                      partial: 'Parcialmente',
                      no: 'No',
                    }
                    const styles: Record<AnswerValue, string> = {
                      yes: 'border-green-500 text-green-700 hover:bg-green-50',
                      partial: 'border-amber-400 text-amber-700 hover:bg-amber-50',
                      no: 'border-red-400 text-red-700 hover:bg-red-50',
                    }
                    return (
                      <button
                        key={val}
                        onClick={() => { void handleAnswer(val) }}
                        disabled={submitting}
                        className={`flex-1 border-2 rounded-lg py-3 text-sm font-semibold transition-colors disabled:opacity-50 ${styles[val]}`}
                      >
                        {labels[val]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => { void openQuestionChat('explain') }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Explicar esta pregunta
                </button>
                <button
                  onClick={() => { void openQuestionChat('guidance') }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                  </svg>
                  Como responder?
                </button>
              </div>
            </>
          )
        )}
      </div>

      {qChatMode && (
        <QuestionChatDrawer
          title={qChatMode === 'explain' ? 'Explicación de la pregunta' : '¿Cómo responder esta pregunta?'}
          messages={qChatMessages}
          loading={qChatLoading}
          input={qChatInput}
          onInputChange={setQChatInput}
          onSend={(e) => { void handleQuestionChatSend(e) }}
          onClose={() => setQChatMode(null)}
        />
      )}
    </Layout>
  )
}
