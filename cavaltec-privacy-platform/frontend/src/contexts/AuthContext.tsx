import {
  createContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider, microsoftProvider } from '../lib/firebase'
import { createApiClient, firebaseLogin, type User } from '../services/api'

// ─── Shape ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: FirebaseUser | null
  userProfile: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithMicrosoft: () => Promise<void>
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
}

const AuthContext = createContext<AuthContextValue | null>(null)

// ─── Provider ────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null)
  const [userProfile, setUserProfile] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  // Keep token in memory — never in localStorage
  const tokenRef = useRef<string | null>(null)

  const getToken = async (): Promise<string | null> => {
    if (!user) return null
    // Firebase refreshes automatically when near expiry
    const token = await user.getIdToken()
    tokenRef.current = token
    return token
  }

  const syncProfile = async (firebaseUser: FirebaseUser) => {
    try {
      const token = await firebaseUser.getIdToken()
      tokenRef.current = token
      const client = createApiClient(token)
      const profile = await firebaseLogin(client, token)
      setUserProfile(profile)
    } catch {
      // Backend may be unavailable; keep Firebase user but clear profile
      setUserProfile(null)
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser)
      if (firebaseUser) {
        await syncProfile(firebaseUser)
      } else {
        tokenRef.current = null
        setUserProfile(null)
      }
      setLoading(false)
    })
    return unsubscribe
  }, [])

  const signInWithGoogle = async () => {
    const result = await signInWithPopup(auth, googleProvider)
    await syncProfile(result.user)
  }

  const signInWithMicrosoft = async () => {
    const result = await signInWithPopup(auth, microsoftProvider)
    await syncProfile(result.user)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    tokenRef.current = null
    setUserProfile(null)
  }

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signInWithGoogle, signInWithMicrosoft, signOut, getToken }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Export raw context for hook ─────────────────────────────────────────────

export { AuthContext }
