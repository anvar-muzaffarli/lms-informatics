import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, loginToEmail } from './supabase'
import type { Profile } from './types'

interface AuthCtx {
  session: Session | null
  profile: Profile | null
  loading: boolean
  signIn: (login: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const Ctx = createContext<AuthCtx>(null as unknown as AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [ready, setReady] = useState(false)
  const [profileLoading, setProfileLoading] = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setReady(true)
    })
    const { data } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => data.subscription.unsubscribe()
  }, [])

  const uid = session?.user.id
  useEffect(() => {
    if (!uid) {
      setProfile(null)
      return
    }
    setProfileLoading(true)
    supabase
      .from('profiles')
      .select('*')
      .eq('id', uid)
      .maybeSingle()
      .then(({ data }) => {
        setProfile((data as Profile) || null)
        setProfileLoading(false)
      })
  }, [uid])

  const signIn = async (login: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email: loginToEmail(login), password })
    if (error) throw new Error(error.message === 'Invalid login credentials' ? 'Login və ya şifrə yanlışdır' : error.message)
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  return (
    <Ctx.Provider value={{ session, profile, loading: !ready || profileLoading, signIn, signOut }}>
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
