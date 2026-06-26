import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import {
  getCompanyAssessments,
  downloadReport,
  deleteAssessment,
  type Assessment,
} from '../services/api'
import Layout from '../components/Layout'

function StatusBadge({ status }: { status: Assessment['status'] }) {
  const styles =
    status === 'completed'
      ? 'bg-green-100 text-green-700'
      : 'bg-yellow-100 text-yellow-700'
  const label = status === 'completed' ? 'Completado' : 'En progreso'
  return (
    <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${styles}`}>
      {label}
    </span>
  )
}

export default function History() {
  const { userProfile } = useAuth()
  const getClient = useApi()

  const [assessments, setAssessments] = useState<Assessment[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const companyId = userProfile?.company_id
        if (!companyId) {
          setLoading(false)
          return
        }
        const client = await getClient()
        const list = await getCompanyAssessments(client, companyId)
        if (!cancelled) {
          setAssessments(list.sort((a, b) => b.created_at.localeCompare(a.created_at)))
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar el historial.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [getClient, userProfile?.company_id])

  const handleDownload = async (assessment: Assessment) => {
    setDownloadingId(assessment.id)
    try {
      const client = await getClient()
      const blob = await downloadReport(client, assessment.id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `diagnostico-${assessment.id}.pdf`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      setError('No se pudo descargar el reporte.')
    } finally {
      setDownloadingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    setConfirmDeleteId(null)
    try {
      const client = await getClient()
      await deleteAssessment(client, id)
      setAssessments((prev) => prev.filter((a) => a.id !== id))
    } catch {
      setError('No se pudo eliminar la evaluacion.')
    } finally {
      setDeletingId(null)
    }
  }

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Historial de evaluaciones</h1>
        <p className="text-sm text-gray-500 mt-1">Registro de todos los diagnosticos realizados.</p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {/* Confirm delete dialog */}
      {confirmDeleteId && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="bg-white rounded-xl shadow-xl p-6 max-w-sm w-full mx-4">
            <h3 className="text-base font-semibold text-gray-900 mb-2">Eliminar evaluacion</h3>
            <p className="text-sm text-gray-500 mb-5">
              Esta accion no se puede deshacer. Se eliminara la evaluacion y sus resultados de forma permanente.
            </p>
            <div className="flex gap-3">
              <button
                onClick={() => setConfirmDeleteId(null)}
                className="flex-1 border border-gray-300 text-gray-700 text-sm font-medium py-2 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancelar
              </button>
              <button
                onClick={() => { void handleDelete(confirmDeleteId) }}
                className="flex-1 bg-red-600 hover:bg-red-700 text-white text-sm font-medium py-2 rounded-lg transition-colors"
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : assessments.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <svg className="w-12 h-12 text-gray-300 mx-auto mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
              d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <p className="text-gray-500 text-sm">Aun no hay evaluaciones registradas.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Fecha</th>
                <th className="px-5 py-3">Puntaje</th>
                <th className="px-5 py-3">Estado</th>
                <th className="px-5 py-3">Brechas</th>
                <th className="px-5 py-3">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="px-5 py-4 text-gray-700">{formatDate(a.created_at)}</td>
                  <td className="px-5 py-4 font-semibold text-teal-700">
                    {a.score != null ? `${a.score}%` : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <StatusBadge status={a.status} />
                  </td>
                  <td className="px-5 py-4 text-gray-600">
                    {a.gaps != null ? a.gaps.length : '—'}
                  </td>
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      {a.status === 'completed' && (
                        <button
                          onClick={() => { void handleDownload(a) }}
                          disabled={downloadingId === a.id}
                          className="text-blue-700 hover:text-blue-900 font-medium text-xs transition-colors disabled:opacity-50"
                        >
                          {downloadingId === a.id ? 'Descargando...' : 'Descargar PDF'}
                        </button>
                      )}
                      <button
                        onClick={() => setConfirmDeleteId(a.id)}
                        disabled={deletingId === a.id}
                        className="text-red-500 hover:text-red-700 text-xs transition-colors disabled:opacity-50"
                      >
                        {deletingId === a.id ? 'Eliminando...' : 'Eliminar'}
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}
