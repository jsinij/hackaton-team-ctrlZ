import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import {
  getCompany,
  getCompanies,
  getCompanyAssessments,
  createAssessment,
  type Company,
  type Assessment,
} from '../services/api'
import Layout from '../components/Layout'
import ScoreGauge from '../components/ScoreGauge'
import { QUESTIONS } from './AssessmentChat'

const QUESTION_TEXT: Record<string, string> = Object.fromEntries(QUESTIONS.map((q) => [q.id, q.text]))

function StatCard({ label, value, color }: { label: string; value: string | number; color?: string }) {
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <p className="text-xs text-gray-500 uppercase tracking-wide mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color ?? 'text-gray-900'}`}>{value}</p>
    </div>
  )
}

export default function Dashboard() {
  const { user, userProfile } = useAuth()
  const getClient = useApi()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState<Company[]>([])
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('')
  const [company, setCompany] = useState<Company | null>(null)
  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loadingCompanies, setLoadingCompanies] = useState(true)
  const [loadingData, setLoadingData] = useState(false)
  const [startingNew, setStartingNew] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const displayName = userProfile?.name ?? user?.displayName ?? 'usuario'
  const firstName = displayName.split(' ')[0]
  const role = userProfile?.role ?? 'usuario'
  const canEvaluate = role === 'auditor' || role === 'admin'
  const canCreateCompany = role === 'admin'

  // Load company list once on mount
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingCompanies(true)
      try {
        const client = await getClient()
        const list = await getCompanies(client)
        if (!cancelled) {
          setCompanies(list)
          const defaultId = userProfile?.company_id ?? list[0]?.id ?? ''
          setSelectedCompanyId(defaultId)
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar la informacion.')
      } finally {
        if (!cancelled) setLoadingCompanies(false)
      }
    }
    void load()
    return () => { cancelled = true }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getClient])

  // Load assessments whenever selected company changes
  useEffect(() => {
    if (!selectedCompanyId) return
    let cancelled = false

    const load = async () => {
      setLoadingData(true)
      setError(null)
      try {
        const client = await getClient()
        const [co, list] = await Promise.all([
          getCompany(client, selectedCompanyId),
          getCompanyAssessments(client, selectedCompanyId),
        ])
        if (!cancelled) {
          setCompany(co)
          setAssessments(list.sort((a, b) => b.created_at.localeCompare(a.created_at)))
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar la informacion.')
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [getClient, selectedCompanyId])

  const handleNewAssessment = async () => {
    if (!company) return
    setStartingNew(true)
    try {
      const client = await getClient()
      const assessment = await createAssessment(client, company.id)
      navigate(`/diagnostico?id=${assessment.id}`)
    } catch {
      setError('No se pudo crear la evaluacion. Intenta de nuevo.')
      setStartingNew(false)
    }
  }

  const latestCompleted = assessments.find((a) => a.status === 'completed')
  const gapCount = latestCompleted?.gaps?.length ?? 0

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Bienvenido, {firstName}</h1>
        <p className="text-gray-500 text-sm mt-1">
          {new Date().toLocaleDateString('es-CO', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      )}

      {loadingCompanies ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : companies.length === 0 ? (
        /* No companies yet */
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center max-w-md mx-auto mt-12">
          <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
            <svg className="w-7 h-7 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
            </svg>
          </div>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Registra tu empresa</h2>
          <p className="text-sm text-gray-500 mb-6">
            Para iniciar el diagnostico de cumplimiento necesitas registrar primero los datos de tu empresa.
          </p>
          {canCreateCompany ? (
            <button
              onClick={() => navigate('/empresa')}
              className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
            >
              Registrar empresa
            </button>
          ) : (
            <p className="text-sm text-amber-600">
              Contacta al administrador para registrar tu empresa.
            </p>
          )}
        </div>
      ) : (
        <>
          {/* Company selector */}
          {companies.length > 1 && (
            <div className="flex items-center gap-3 mb-6">
              <label htmlFor="company-select" className="text-sm font-medium text-gray-700 shrink-0">
                Empresa:
              </label>
              <select
                id="company-select"
                value={selectedCompanyId}
                onChange={(e) => setSelectedCompanyId(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
              >
                {companies.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {loadingData ? (
            <div className="flex justify-center py-20">
              <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : (
            <>
              {/* Stats row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-8">
                <StatCard label="Empresa" value={company?.name ?? '—'} />
                <StatCard label="Evaluaciones" value={assessments.length} />
                <StatCard
                  label="Ultimo puntaje"
                  value={latestCompleted ? `${latestCompleted.score ?? 0}%` : 'Sin datos'}
                  color={latestCompleted ? 'text-teal-700' : 'text-gray-400'}
                />
              </div>

              {latestCompleted ? (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {/* Score card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                      Ultimo diagnostico
                    </h2>
                    <div className="flex flex-col items-center">
                      <ScoreGauge score={latestCompleted.score ?? 0} />
                      <p className="text-xs text-gray-400 mt-3">
                        {new Date(latestCompleted.completed_at ?? latestCompleted.created_at).toLocaleDateString('es-CO')}
                      </p>
                    </div>
                    {canEvaluate && (
                    <button
                      onClick={() => { void handleNewAssessment() }}
                      disabled={startingNew}
                      className="mt-5 w-full bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {startingNew ? 'Iniciando...' : 'Nueva Evaluacion'}
                    </button>
                  )}
                  </div>

                  {/* Gaps card */}
                  <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
                    <h2 className="text-sm font-semibold text-gray-700 mb-4 uppercase tracking-wide">
                      Brechas identificadas ({gapCount})
                    </h2>
                    {latestCompleted.gaps && latestCompleted.gaps.length > 0 ? (
                      <ul className="space-y-3">
                        {latestCompleted.gaps.slice(0, 5).map((gapId) => (
                          <li key={gapId} className="flex gap-2 text-sm">
                            <span className="mt-0.5 w-2 h-2 rounded-full bg-red-400 shrink-0" />
                            <span className="text-gray-700">{QUESTION_TEXT[gapId] ?? gapId}</span>
                          </li>
                        ))}
                        {gapCount > 5 && (
                          <p className="text-xs text-gray-400">
                            y {gapCount - 5} mas...
                          </p>
                        )}
                      </ul>
                    ) : (
                      <p className="text-sm text-teal-600 font-medium">Sin brechas detectadas</p>
                    )}
                  </div>
                </div>
              ) : (
                /* No assessments yet */
                <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                  <p className="text-gray-500 mb-5">Aun no tienes diagnosticos completados.</p>
                  {canEvaluate ? (
                    <button
                      onClick={() => { void handleNewAssessment() }}
                      disabled={startingNew}
                      className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors disabled:opacity-50"
                    >
                      {startingNew ? 'Iniciando...' : 'Iniciar primer diagnostico'}
                    </button>
                  ) : (
                    <p className="text-sm text-amber-600">
                      Solo los auditores y administradores pueden realizar evaluaciones.
                    </p>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}
    </Layout>
  )
}
