import { useEffect, useState } from 'react'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import {
  listUsers,
  updateUser,
  getCompanies,
  type User,
  type UserRole,
  type Company,
  type UserUpdatePayload,
} from '../services/api'
import Layout from '../components/Layout'

const ROLE_OPTIONS: { value: UserRole; label: string }[] = [
  { value: 'usuario', label: 'Usuario' },
  { value: 'auditor', label: 'Auditor' },
  { value: 'admin', label: 'Admin' },
]

const ROLE_BADGE: Record<UserRole, string> = {
  usuario: 'bg-gray-100 text-gray-600',
  auditor: 'bg-amber-100 text-amber-700',
  admin: 'bg-blue-100 text-blue-700',
}

interface RowState {
  role: UserRole
  companyId: string
  saving: boolean
  saved: boolean
  error: string | null
}

const EMPTY_ROW: Omit<RowState, 'saving' | 'saved' | 'error'> = { role: 'usuario', companyId: '' }

export default function Users() {
  const getClient = useApi()
  const { userProfile } = useAuth()

  const [users, setUsers] = useState<User[]>([])
  const [companies, setCompanies] = useState<Company[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [rows, setRows] = useState<Record<string, RowState>>({})

  const adminEmail = userProfile?.email ?? ''

  const rowFor = (u: User): RowState => {
    const existing = rows[u.id]
    if (existing) return existing
    return {
      ...EMPTY_ROW,
      role: u.role,
      companyId: u.company_id ?? '',
      saving: false,
      saved: false,
      error: null,
    }
  }

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoading(true)
      setError(null)
      try {
        const client = await getClient()
        const [u, c] = await Promise.all([listUsers(client), getCompanies(client)])
        if (!cancelled) {
          setUsers(u)
          setCompanies(c)
        }
      } catch {
        if (!cancelled) setError('No se pudo cargar la lista de usuarios.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [getClient])

  const updateRow = (id: string, patch: Partial<RowState>) => {
    setRows((prev) => ({
      ...prev,
      [id]: { ...rowFor({ id } as User), ...prev[id], ...patch },
    }))
  }

  const handleSave = async (u: User) => {
    const row = rowFor(u)
    if (row.role === u.role && row.companyId === (u.company_id ?? '')) {
      updateRow(u.id, { saved: true, error: null })
      setTimeout(() => updateRow(u.id, { saved: false }), 1500)
      return
    }

    updateRow(u.id, { saving: true, error: null, saved: false })
    try {
      const client = await getClient()
      const payload: UserUpdatePayload = { role: row.role }
      if (row.companyId !== (u.company_id ?? '')) {
        payload.company_id = row.companyId === '' ? null : row.companyId
      }
      const updated = await updateUser(client, u.id, payload)
      setUsers((prev) => prev.map((x) => (x.id === updated.id ? updated : x)))
      updateRow(u.id, { saving: false, saved: true, role: updated.role, companyId: updated.company_id ?? '' })
      setTimeout(() => updateRow(u.id, { saved: false }), 1500)
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al actualizar el usuario'
      updateRow(u.id, { saving: false, error: msg })
    }
  }

  const formatDate = (iso?: string) =>
    iso ? new Date(iso).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' }) : '—'

  const companyLabel = (id: string) =>
    companies.find((c) => c.id === id)?.name ?? null

  return (
    <Layout>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Gestion de usuarios</h1>
        <p className="text-sm text-gray-500 mt-1">
          Asigna roles y empresas a los usuarios registrados en la plataforma.
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">Cerrar</button>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : users.length === 0 ? (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-10 text-center">
          <p className="text-gray-500 text-sm">No hay usuarios registrados.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-500 uppercase tracking-wide">
                <th className="px-5 py-3">Usuario</th>
                <th className="px-5 py-3">Rol</th>
                <th className="px-5 py-3">Empresa</th>
                <th className="px-5 py-3">Registro</th>
                <th className="px-5 py-3 text-right">Accion</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => {
                const row = rowFor(u)
                const isProtectedAdmin = u.email.toLowerCase() === adminEmail.toLowerCase()
                return (
                  <tr key={u.id} className="border-b border-gray-50 align-top">
                    <td className="px-5 py-4">
                      <p className="font-medium text-gray-900">{u.name || '—'}</p>
                      <p className="text-xs text-gray-500">{u.email}</p>
                    </td>
                    <td className="px-5 py-4">
                      {isProtectedAdmin ? (
                        <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${ROLE_BADGE[u.role]}`}>
                          {u.role}
                        </span>
                      ) : (
                        <select
                          value={row.role}
                          onChange={(e) => updateRow(u.id, { role: e.target.value as UserRole })}
                          disabled={row.saving}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white"
                        >
                          {ROLE_OPTIONS.map((r) => (
                            <option key={r.value} value={r.value}>{r.label}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-4">
                      {isProtectedAdmin ? (
                        <span className="text-xs text-gray-500">
                          {u.company_id ? companyLabel(u.company_id) ?? u.company_id : '—'}
                        </span>
                      ) : (
                        <select
                          value={row.companyId}
                          onChange={(e) => updateRow(u.id, { companyId: e.target.value })}
                          disabled={row.saving}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent bg-white max-w-[180px]"
                        >
                          <option value="">Sin empresa</option>
                          {companies.map((c) => (
                            <option key={c.id} value={c.id}>{c.name}</option>
                          ))}
                        </select>
                      )}
                    </td>
                    <td className="px-5 py-4 text-gray-500 text-xs">
                      {formatDate(u.created_at)}
                    </td>
                    <td className="px-5 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        {row.error && <span className="text-xs text-red-500">{row.error}</span>}
                        {row.saved && <span className="text-xs text-green-600">Guardado</span>}
                        {isProtectedAdmin ? (
                          <span className="text-xs text-gray-400 italic">admin principal</span>
                        ) : (
                          <button
                            onClick={() => { void handleSave(u) }}
                            disabled={row.saving}
                            className="bg-blue-700 hover:bg-blue-800 text-white text-xs font-medium px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
                          >
                            {row.saving ? 'Guardando...' : 'Guardar'}
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </Layout>
  )
}