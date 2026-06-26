import { useCallback, useEffect, useState } from 'react'
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
  type Assessment,
  type AssessmentResult,
  type Answer,
  type AnswerValue,
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

// ─── Main component ───────────────────────────────────────────────────────────

type DrawerMode = 'explain' | 'guidance' | null

export default function AssessmentChat() {
  const { userProfile } = useAuth()
  const getClient = useApi()
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()

  const assessmentIdParam = searchParams.get('id')

  const [assessment, setAssessment] = useState<Assessment | null>(null)
  const [result, setResult] = useState<AssessmentResult | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, AnswerValue>>({})
  const [loadingInit, setLoadingInit] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [completing, setCompleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [downloading, setDownloading] = useState(false)

  // AI Drawer
  const [drawerMode, setDrawerMode] = useState<DrawerMode>(null)
  const [drawerContent, setDrawerContent] = useState('')
  const [drawerLoading, setDrawerLoading] = useState(false)

  // ── Initialise assessment ──────────────────────────────────────────────────

  useEffect(() => {
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
          // update URL without re-mounting
          const url = new URL(window.location.href)
          url.searchParams.set('id', a.id)
          window.history.replaceState({}, '', url.toString())
        }

        if (!cancelled) {
          setAssessment(a)

          if (a.status === 'completed' && a.result) {
            setResult(a.result)
          } else {
            // Restore already-saved answers
            const restored: Record<string, AnswerValue> = {}
            a.answers.forEach((ans) => { restored[ans.question_id] = ans.value })
            setAnswers(restored)
            // Advance to first unanswered
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
  }, [])

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
        // All answered — complete
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

  // ── AI helpers ─────────────────────────────────────────────────────────────

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

        {loadingInit ? (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
            <p className="text-sm text-gray-500">Preparando evaluacion...</p>
          </div>
        ) : result ? (
          /* ── Results ────────────────────────────────────────────────────── */
          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
              <h2 className="text-lg font-semibold text-gray-800 mb-5">Resultado del diagnostico</h2>
              <ScoreGauge score={result.score} size={200} />
              {result.interpretation && (
                <p className="mt-5 text-sm text-gray-600 max-w-md mx-auto">{result.interpretation}</p>
              )}
              <button
                onClick={() => { void handleDownload() }}
                disabled={downloading}
                className="mt-6 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
              >
                {downloading ? 'Generando PDF...' : 'Descargar Reporte PDF'}
              </button>
            </div>

            {result.gaps && result.gaps.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Brechas identificadas ({result.gaps.length})
                </h3>
                <ul className="space-y-4">
                  {result.gaps.map((gap) => (
                    <li key={gap.question_id} className="flex gap-3">
                      <span className="mt-1.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
                      <div>
                        <p className="text-sm font-medium text-gray-800">{gap.question_text}</p>
                        {gap.recommendation && (
                          <p className="text-xs text-gray-500 mt-0.5">{gap.recommendation}</p>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {result.recommendations && result.recommendations.length > 0 && (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-4">
                  Recomendaciones de IA
                </h3>
                <ul className="space-y-2">
                  {result.recommendations.map((rec, i) => (
                    <li key={i} className="flex gap-2 text-sm text-gray-700">
                      <span className="text-teal-600 font-bold shrink-0">{i + 1}.</span>
                      {rec}
                    </li>
                  ))}
                </ul>
              </div>
            )}

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
                {/* Category badge */}
                <span className="inline-block text-xs font-medium text-teal-700 bg-teal-50 px-2.5 py-0.5 rounded-full mb-4">
                  {question.category}
                </span>

                {/* Question text */}
                <p className="text-base font-medium text-gray-900 mb-6 leading-snug">
                  {question.text}
                </p>

                {/* Answer buttons */}
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

              {/* AI help buttons */}
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

      {/* AI Drawer */}
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
