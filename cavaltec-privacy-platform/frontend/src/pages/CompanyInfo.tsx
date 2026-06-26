import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import {
  createCompany,
  getCompanies,
  updateCompany,
  type Company,
  type CompanyPayload,
} from '../services/api'
import Layout from '../components/Layout'

const SECTORS = [
  { value: 'tecnologia', label: 'Tecnologia' },
  { value: 'salud', label: 'Salud' },
  { value: 'educacion', label: 'Educacion' },
  { value: 'financiero', label: 'Financiero' },
  { value: 'manufactura', label: 'Manufactura' },
  { value: 'retail', label: 'Retail' },
  { value: 'otro', label: 'Otro' },
]

const SIZES = [
  { value: 'micro', label: 'Micro (menos de 10 empleados)' },
  { value: 'pequena', label: 'Pequeña (10 - 50 empleados)' },
  { value: 'mediana', label: 'Mediana (50 - 200 empleados)' },
  { value: 'grande', label: 'Grande (mas de 200 empleados)' },
]

const SECTOR_LABEL: Record<string, string> = Object.fromEntries(SECTORS.map((s) => [s.value, s.label]))
const SIZE_LABEL: Record<string, string> = Object.fromEntries(SIZES.map((s) => [s.value, s.label]))

const EMPTY_FORM: CompanyPayload = { name: '', nit: '', sector: '', size: '' }

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-600 mt-1">{msg}</p>
}

interface CompanyFormProps {
  initial?: CompanyPayload
  submitLabel: string
  onSubmit: (payload: CompanyPayload) => Promise<void>
  onCancel?: () => void
}

function CompanyForm({ initial = EMPTY_FORM, submitLabel, onSubmit, onCancel }: CompanyFormProps) {
  const [form, setForm] = useState<CompanyPayload>(initial)
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CompanyPayload, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'

  const validate = (): boolean => {
    const errors: Partial<Record<keyof CompanyPayload, string>> = {}
    if (!form.name.trim()) errors.name = 'El nombre es obligatorio'
    if (!form.nit.trim()) errors.nit = 'El NIT es obligatorio'
    if (!form.sector) errors.sector = 'Selecciona un sector'
    if (!form.size) errors.size = 'Selecciona el tamano'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleChange = (field: keyof CompanyPayload) => (
    e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
  ) => {
    setForm((prev) => ({ ...prev, [field]: e.target.value }))
    setFieldErrors((prev) => ({ ...prev, [field]: undefined }))
    setSaveSuccess(false)
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      await onSubmit(form)
      setSaveSuccess(true)
    } catch (err: unknown) {
      setSaveError(err instanceof Error ? err.message : 'Error al guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={(e) => { void handleSubmit(e) }} className="space-y-4 mt-4">
      {saveError && (
        <div className="rounded-lg bg-red-50 border border-red-200 px-4 py-3 text-sm text-red-700">
          {saveError}
        </div>
      )}
      {saveSuccess && (
        <div className="rounded-lg bg-green-50 border border-green-200 px-4 py-3 text-sm text-green-700">
          Empresa guardada correctamente.
        </div>
      )}

      <div>
        <label className={labelClass}>Nombre de la empresa</label>
        <input type="text" value={form.name} onChange={handleChange('name')}
          placeholder="Ej. Acme S.A.S." className={inputClass} />
        <FieldError msg={fieldErrors.name} />
      </div>

      <div>
        <label className={labelClass}>NIT</label>
        <input type="text" value={form.nit} onChange={handleChange('nit')}
          placeholder="Ej. 900123456-1" className={inputClass} />
        <FieldError msg={fieldErrors.nit} />
      </div>

      <div>
        <label className={labelClass}>Sector</label>
        <select value={form.sector} onChange={handleChange('sector')} className={inputClass}>
          <option value="">Selecciona un sector</option>
          {SECTORS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <FieldError msg={fieldErrors.sector} />
      </div>

      <div>
        <label className={labelClass}>Tamano de la empresa</label>
        <select value={form.size} onChange={handleChange('size')} className={inputClass}>
          <option value="">Selecciona el tamano</option>
          {SIZES.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
        </select>
        <FieldError msg={fieldErrors.size} />
      </div>

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={saving}
          className="flex-1 bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
        >
          {saving ? 'Guardando...' : submitLabel}
        </button>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2.5 border border-gray-300 text-gray-700 text-sm rounded-lg hover:bg-gray-50 transition-colors"
          >
            Cancelar
          </button>
        )}
      </div>
    </form>
  )
}

interface CompanyCardProps {
  company: Company
  onUpdated: (updated: Company) => void
}

function CompanyCard({ company, onUpdated }: CompanyCardProps) {
  const getClient = useApi()
  const [editing, setEditing] = useState(false)

  const handleUpdate = async (payload: CompanyPayload) => {
    const client = await getClient()
    const updated = await updateCompany(client, company.id, payload)
    onUpdated(updated)
    setEditing(false)
  }

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="font-semibold text-gray-900">{company.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">NIT: {company.nit}</p>
          <div className="flex gap-2 mt-2 flex-wrap">
            <span className="text-xs bg-blue-50 text-blue-700 px-2 py-0.5 rounded-full font-medium">
              {SECTOR_LABEL[company.sector] ?? company.sector}
            </span>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {SIZE_LABEL[company.size] ?? company.size}
            </span>
          </div>
        </div>
        <button
          onClick={() => setEditing((v) => !v)}
          className="shrink-0 text-xs text-blue-700 hover:text-blue-900 font-medium transition-colors"
        >
          {editing ? 'Cancelar' : 'Editar'}
        </button>
      </div>

      {editing && (
        <CompanyForm
          initial={{ name: company.name, nit: company.nit, sector: company.sector, size: company.size }}
          submitLabel="Actualizar empresa"
          onSubmit={handleUpdate}
          onCancel={() => setEditing(false)}
        />
      )}
    </div>
  )
}

export default function CompanyInfo() {
  const { refreshProfile } = useAuth()
  const getClient = useApi()
  const navigate = useNavigate()

  const [companies, setCompanies] = useState<Company[]>([])
  const [loadingData, setLoadingData] = useState(true)
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    let cancelled = false
    const load = async () => {
      setLoadingData(true)
      try {
        const client = await getClient()
        const list = await getCompanies(client)
        if (!cancelled) setCompanies(list)
      } catch {
        // empty list on error
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }
    void load()
    return () => { cancelled = true }
  }, [getClient])

  const handleCreate = async (payload: CompanyPayload) => {
    const client = await getClient()
    const created = await createCompany(client, payload)
    await refreshProfile()
    setCompanies((prev) => [...prev, created])
    setShowAddForm(false)
  }

  const handleUpdated = (updated: Company) => {
    setCompanies((prev) => prev.map((c) => (c.id === updated.id ? updated : c)))
  }

  return (
    <Layout>
      <div className="max-w-xl">
        <div className="flex items-center justify-between mb-7">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Mis Empresas</h1>
            <p className="text-sm text-gray-500 mt-1">
              Gestiona las empresas que diagnosticas con la plataforma.
            </p>
          </div>
          {companies.length > 0 && !showAddForm && (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-4 py-2.5 rounded-lg transition-colors shrink-0"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Agregar
            </button>
          )}
        </div>

        {loadingData ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <>
            {companies.length === 0 && !showAddForm ? (
              <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-8 text-center">
                <div className="w-12 h-12 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                  <svg className="w-6 h-6 text-blue-700" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8}
                      d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                </div>
                <p className="text-gray-500 text-sm mb-5">Aun no tienes empresas registradas.</p>
                <button
                  onClick={() => setShowAddForm(true)}
                  className="bg-blue-700 hover:bg-blue-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg transition-colors"
                >
                  Registrar primera empresa
                </button>
              </div>
            ) : (
              <div className="space-y-4">
                {companies.map((c) => (
                  <CompanyCard key={c.id} company={c} onUpdated={handleUpdated} />
                ))}
              </div>
            )}

            {showAddForm && (
              <div className="mt-4 bg-white rounded-xl shadow-sm border border-gray-100 p-5">
                <h2 className="text-sm font-semibold text-gray-700 mb-1">Nueva empresa</h2>
                <CompanyForm
                  submitLabel="Registrar empresa"
                  onSubmit={handleCreate}
                  onCancel={() => setShowAddForm(false)}
                />
              </div>
            )}

            {companies.length > 0 && (
              <button
                onClick={() => navigate('/')}
                className="mt-5 text-sm text-gray-500 hover:text-gray-700 transition-colors"
              >
                ← Volver al dashboard
              </button>
            )}
          </>
        )}
      </div>
    </Layout>
  )
}
