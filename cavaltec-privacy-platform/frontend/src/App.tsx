import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './contexts/AuthContext'
import PrivateRoute from './components/PrivateRoute'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import CompanyInfo from './pages/CompanyInfo'
import History from './pages/History'
import AssessmentChat from './pages/AssessmentChat'
import Users from './pages/Users'

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <Dashboard />
              </PrivateRoute>
            }
          />
          <Route
            path="/empresa"
            element={
              <PrivateRoute roles={['admin']}>
                <CompanyInfo />
              </PrivateRoute>
            }
          />
          <Route
            path="/historial"
            element={
              <PrivateRoute>
                <History />
              </PrivateRoute>
            }
          />
          <Route
            path="/diagnostico"
            element={
              <PrivateRoute roles={['auditor', 'admin']}>
                <AssessmentChat />
              </PrivateRoute>
            }
          />
          <Route
            path="/usuarios"
            element={
              <PrivateRoute roles={['admin']}>
                <Users />
              </PrivateRoute>
            }
          />
          {/* Catch-all: send unknown paths to dashboard (which redirects to login if needed) */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  )
}
