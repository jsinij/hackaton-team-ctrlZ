import { useCallback, useEffect, useRef, useState } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import {
  createAssessment,
  getAssessment,
  submitAnswers,
  completeAssessment,
  explainQuestion,
  getAnswerGuidance,
  downloadReport,
  chatWithAgent,
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
  {
    id: 'P1',
    text: 'Tiene la empresa una politica de tratamiento de datos personales documentada y aprobada?',
    category: 'Politica de datos',
  },
  {
    id: 'P2',
    text: 'La politica de tratamiento de datos esta publicada y es accesible para los titulares?',
    category: 'Politica de datos',
  },
  {
    id: 'P3',
    text: 'Se ha registrado la base de datos ante la SIC?',
    category: 'Politica de datos',
  },
  {
    id: 'P4',
    text: 'Los sistemas de informacion incorporan controles de privacidad desde su diseno?',
    category: 'Privacidad por diseno',
  },
  {
    id: 'P5',
    text: 'Se realiza analisis de impacto de privacidad (DPIA) antes de implementar nuevos procesos?',
    category: 'Privacidad por diseno',
  },
  {
    id: 'P6',
    text: 'Existen mecanismos tecnicos para garantizar la seguridad de los datos personales?',
    category: 'Privacidad por diseno',
  },
  {
    id: 'P7',
    text: 'Existe un responsable designado del tratamiento de datos personales?',
    category: 'Gobernanza',
  },
  {
    id: 'P8',
    text: 'El personal que trata datos personales ha recibido capacitacion sobre la Ley 1581?',
    category: 'Gobernanza',
  },
  {
    id: 'P9',
    text: 'Existe un procedimiento para atender solicitudes de los titulares (acceso, correccion, supresion)?',
    category: 'Gobernanza',
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

interface AiDrawerProps {
  title: string
  content: string
  loading: boolean
  onClose: () => void
}

function AiDrawer({ title, content, loading, onClose }: AiDrawerProps) {
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="fixed inset-0 bg-black/20" onClick={onClose} />
      <aside className="relative z-50 w-full max-w-sm bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-800">{title}</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="flex-1 overflow-auto px-5 py-4 text-sm text-gray-700 leading-relaxed">
          {loading ? (
            <div className="flex justify-center pt-10">
              <div className="w-6 h-6 border-2 border-blue-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <p>{content}</p>
          )}
        </div>
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

type DrawerMode = 'explain' | 'guidance' | null

export default function AssessmentChat() {
  const { userProfile } = useAuth()
  const getClient = useApi()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const assessmentIdParam = searchParams.get('id')

  // Show landing screen for new assessments; skip it when resuming via URL param
  const [started, setStarted] = useState(!!assessmentIdParam)

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

  // AI Drawer
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [drawerContent, setDrawerContent] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)

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
          const companyId = userProfile?.company_id
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
            const firstUnanswered = QUESTIONS.findIndex((q) => !restored[q.id])
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

    const newAnswers = { ...answers, [question.id]: value }
    setAnswers(newAnswers)

    setSubmitting(true)
    try {
      const client = await getClient()
      const answersArr: Answer[] = Object.entries(newAnswers).map(([question_id, v]) => ({
        question_id,
        value: v,
      }))
      await submitAnswers(client, assessment.id, answersArr)

      const isLast = currentIndex === QUESTIONS.length - 1
      if (isLast) {
        setCompleting(true)
        const res = await completeAssessment(client, assessment.id)
        setResult(res)
        setCompleting(false)
      } else {
        setCurrentIndex((i) => i + 1)
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

  // ── AI Drawer helpers ──────────────────────────────────────────────────────

  const openDrawer = useCallback(async (mode: DrawerMode) => {
    const question = QUESTIONS[currentIndex]
    if (!question || !assessment) return
    setDrawerMode(mode)
    setDrawerLoading(true)
    setDrawerContent('')
    try {
      const client = await getClient()
      if (mode === 'explain') {
        const { explanation } = await explainQuestion(client, question.id)
        setDrawerContent(explanation)
      } else if (mode === 'guidance') {
        const { guidance } = await getAnswerGuidance(client, question.id)
        setDrawerContent(guidance)
      }
    } catch {
      setDrawerContent('No se pudo obtener la informacion de la IA.')
    } finally {
      setDrawerLoading(false)
    }
  }, [currentIndex, assessment, getClient])

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
                { value: '9', label: 'Preguntas' },
                { value: '~5', label: 'Minutos' },
                { value: '3', label: 'Categorias' },
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

            <button
              onClick={() => setStarted(true)}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-lg transition-colors text-sm"
            >
              Comenzar Evaluacion
            </button>
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

              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-4">
                <span className="inline-block text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full mb-4">
                  {question.category}
                </span>

                <p className="text-base font-medium text-gray-900 mb-6 leading-snug">
                  {question.text}
                </p>

                <div className="flex gap-3">
                  {(['yes', 'partial', 'no'] as AnswerValue[]).map((val) => {
                    const labels: Record<AnswerValue, string> = {
                      yes: 'Si',
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
                  onClick={() => { void openDrawer('explain') }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-blue-700 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  Explicar esta pregunta
                </button>
                <button
                  onClick={() => { void openDrawer('guidance') }}
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

      {drawerMode && (
        <AiDrawer
          title={drawerMode === 'explain' ? 'Explicacion de la pregunta' : 'Como responder esta pregunta'}
          content={drawerContent}
          loading={drawerLoading}
          onClose={() => setDrawerMode(null)}
        />
      )}
    </Layout>
  )
}
