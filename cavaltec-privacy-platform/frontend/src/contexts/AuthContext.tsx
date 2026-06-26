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
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut as firebaseSignOut,
  type User as FirebaseUser,
} from 'firebase/auth'
import { auth, googleProvider } from '../lib/firebase'
import { createApiClient, firebaseLogin, type User } from '../services/api'

// ─── Shape ───────────────────────────────────────────────────────────────────

interface AuthContextValue {
  user: FirebaseUser | null
  userProfile: User | null
  loading: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>
  signOut: () => Promise<void>
  getToken: () => Promise<string | null>
  refreshProfile: () => Promise<void>
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

  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password)
    await syncProfile(result.user)
  }

  const signUpWithEmail = async (email: string, password: string, name: string) => {
    const result = await createUserWithEmailAndPassword(auth, email, password)
    if (name.trim()) {
      await updateProfile(result.user, { displayName: name.trim() })
    }
    await syncProfile(result.user)
  }

  const signOut = async () => {
    await firebaseSignOut(auth)
    tokenRef.current = null
    setUserProfile(null)
  }

  const refreshProfile = async () => {
    if (user) await syncProfile(user)
  }

  return (
    <AuthContext.Provider
      value={{ user, userProfile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, getToken, refreshProfile }}
    >
      {children}
    </AuthContext.Provider>
  )
}

// ─── Export raw context for hook ─────────────────────────────────────────────

export { AuthContext }
