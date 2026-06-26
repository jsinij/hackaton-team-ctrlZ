import { type ReactNode } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import type { UserRole } from '../services/api'

interface Props {
  children: ReactNode
  roles?: UserRole[]
}

export default function PrivateRoute({ children, roles }: Props) {
  const { user, userProfile, loading } = useAuth()

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="w-8 h-8 border-4 border-blue-700 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && userProfile && !roles.includes(userProfile.role)) {
    return <Navigate to="/" replace />
  }

  return <>{children}</>
}
