import { useCallback, useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabaseClient'
import { logActivity } from '../lib/activityLog'

export function useAuth() {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [loading, setLoading] = useState(true)

  const fetchProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null)
      return
    }

    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile(data ?? null)
  }, [])

  const lastFetchedUserIdRef = useRef(undefined)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      const userId = data.session?.user?.id ?? null
      setSession(data.session)
      lastFetchedUserIdRef.current = userId
      fetchProfile(userId).finally(() => setLoading(false))
    })

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      const userId = nextSession?.user?.id ?? null
      setSession(nextSession)

      if (userId !== lastFetchedUserIdRef.current) {
        lastFetchedUserIdRef.current = userId
        fetchProfile(userId)
      }
    })

    return () => subscription.subscription.unsubscribe()
  }, [fetchProfile])

  async function signUp({ email, password, displayName, ageOrGrade }) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { display_name: displayName, age_or_grade: ageOrGrade || null },
      },
    })

    if (error) {
      return { error }
    }

    if (data.user) {
      await logActivity('signup')
    }

    return { error: null }
  }

  async function signIn({ email, password }) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })

    if (error) {
      return { error }
    }

    await logActivity('login')
    return { error: null }
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  async function requestPasswordReset(email) {
    return supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
  }

  async function updatePassword(newPassword) {
    return supabase.auth.updateUser({ password: newPassword })
  }

  return {
    session,
    user: session?.user ?? null,
    profile,
    isAdmin: profile?.role === 'admin',
    loading,
    signUp,
    signIn,
    signOut,
    requestPasswordReset,
    updatePassword,
  }
}
