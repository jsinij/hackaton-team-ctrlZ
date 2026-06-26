import { useCallback } from 'react'
import { useAuth } from './useAuth'
import { createApiClient } from '../services/api'
import type { AxiosInstance } from 'axios'

/**
 * Returns an async factory that resolves to an axios instance pre-loaded
 * with the current Firebase Bearer token. Always call it right before
 * making a request so the token is fresh.
 */
export function useApi(): () => Promise<AxiosInstance> {
  const { getToken } = useAuth()

  return useCallback(async () => {
    const token = await getToken()
    if (!token) throw new Error('No autenticado')
    return createApiClient(token)
  }, [getToken])
}
