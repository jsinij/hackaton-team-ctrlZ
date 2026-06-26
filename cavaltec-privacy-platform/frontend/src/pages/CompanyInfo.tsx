import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useApi } from '../hooks/useApi'
import {
  createCompany,
  getCompany,
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
  { value: 'pequena', label: 'Pequena (10 - 50 empleados)' },
  { value: 'mediana', label: 'Mediana (50 - 200 empleados)' },
  { value: 'grande', label: 'Grande (mas de 200 empleados)' },
]

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null
  return <p className="text-xs text-red-600 mt-1">{msg}</p>
}

export default function CompanyInfo() {
  const { userProfile, refreshProfile } = useAuth()
  const getClient = useApi()
  const navigate = useNavigate()

  const [existing, setExisting] = useState<Company | null>(null)
  const [loadingData, setLoadingData] = useState(true)

  const [form, setForm] = useState<CompanyPayload>({
    name: '',
    nit: '',
    sector: '',
    size: '',
  })

  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof CompanyPayload, string>>>({})
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      setLoadingData(true)
      try {
        const companyId = userProfile?.company_id
        if (!companyId) return
        const client = await getClient()
        const co = await getCompany(client, companyId)
        if (!cancelled) {
          setExisting(co)
          setForm({ name: co.name, nit: co.nit, sector: co.sector, size: co.size })
        }
      } catch {
        // no company yet, stay in create mode
      } finally {
        if (!cancelled) setLoadingData(false)
      }
    }

    void load()
    return () => { cancelled = true }
  }, [getClient, userProfile?.company_id])

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
      const client = await getClient()
      if (existing) {
        const updated = await updateCompany(client, existing.id, form)
        setExisting(updated)
        setSaveSuccess(true)
      } else {
        await createCompany(client, form)
        await refreshProfile()
        navigate('/')
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error al guardar la empresa'
      setSaveError(msg)
    } finally {
      setSaving(false)
    }
  }

  const labelClass = 'block text-sm font-medium text-gray-700 mb-1'
  const inputClass =
    'w-full border border-gray-300 rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-600 focus:border-transparent'

  return (
    <Layout>
      <div className="max-w-xl">
        <h1 className="text-2xl font-bold text-gray-900 mb-1">
          {existing ? 'Editar empresa' : 'Registrar empresa'}
        </h1>
        <p className="text-sm text-gray-500 mb-7">
          Esta informacion se usa para contextualizar el diagnostico de cumplimiento.
        </p>

        {loadingData ? (
          <div className="flex justify-center py-16">
            <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
          </div>
        ) : (
          <form onSubmit={(e) => { void handleSubmit(e) }} className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 space-y-5">
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
              <label className={labelClass} htmlFor="name">Nombre de la empresa</label>
              <input
                id="name"
                type="text"
                value={form.name}
                onChange={handleChange('name')}
                placeholder="Ej. Acme S.A.S."
                className={inputClass}
              />
              <FieldError msg={fieldErrors.name} />
            </div>

            <div>
              <label className={labelClass} htmlFor="nit">NIT</label>
              <input
                id="nit"
                type="text"
                value={form.nit}
                onChange={handleChange('nit')}
                placeholder="Ej. 900123456-1"
                className={inputClass}
              />
              <FieldError msg={fieldErrors.nit} />
            </div>

            <div>
              <label className={labelClass} htmlFor="sector">Sector</label>
              <select
                id="sector"
                value={form.sector}
                onChange={handleChange('sector')}
                className={inputClass}
              >
                <option value="">Selecciona un sector</option>
                {SECTORS.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <FieldError msg={fieldErrors.sector} />
            </div>

            <div>
              <label className={labelClass} htmlFor="size">Tamano de la empresa</label>
              <select
                id="size"
                value={form.size}
                onChange={handleChange('size')}
                className={inputClass}
              >
                <option value="">Selecciona el tamano</option>
                {SIZES.map((s) => (
                  <option key={s.value} value={s.value}>{s.label}</option>
                ))}
              </select>
              <FieldError msg={fieldErrors.size} />
            </div>

            <button
              type="submit"
              disabled={saving}
              className="w-full bg-blue-700 hover:bg-blue-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 text-sm"
            >
              {saving ? 'Guardando...' : existing ? 'Actualizar empresa' : 'Registrar empresa'}
            </button>
          </form>
        )}
      </div>
    </Layout>
  )
}
