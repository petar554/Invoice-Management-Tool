import React, { createContext, useContext, useEffect, useState } from 'react'
import { auth } from '../lib/supabase'

const AuthContext = createContext({})

// custom hook for using Auth Context
export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(true)
  const [session, setSession] = useState(null)

  useEffect(() => {
    // getting current session
    const getSession = async () => {
      try {
        const { data: { user }, error } = await auth.getCurrentUser()
        if (error) throw error
        setUser(user)
        setSession(user ? { user } : null)
      } catch (error) {
        console.error('Error getting session:', error)
      } finally {
        setLoading(false)
      }
    }

    getSession()

    const { data: { subscription } } = auth.onAuthStateChange(
      async (event, session) => {
        console.log('Auth state changed:', event, session)
        setUser(session?.user ?? null)
        setSession(session)
        setLoading(false)
      }
    )

    // cleanup subscription on unmount
    return () => subscription.unsubscribe()
  }, [])

  const signUp = async (email, password, metadata = {}) => {
    try {
      setLoading(true)
      const { data, error } = await auth.signUp(email, password, metadata)
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error signing up:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signIn = async (email, password) => {
    try {
      setLoading(true)
      const { data, error } = await auth.signIn(email, password)
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error signing in:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const signOut = async () => {
    try {
      setLoading(true)
      const { error } = await auth.signOut()
      if (error) throw error
      return { error: null }
    } catch (error) {
      console.error('Error signing out:', error)
      return { error }
    } finally {
      setLoading(false)
    }
  }

  // reset password funkcija
  const resetPassword = async (email) => {
    try {
      const { data, error } = await auth.resetPassword(email)
      if (error) throw error
      return { data, error: null }
    } catch (error) {
      console.error('Error resetting password:', error)
      return { data: null, error }
    }
  }

  const updateProfile = async (updates) => {
    try {
      setLoading(true)
      //#todo: This will be implemented when we add user profiles table
      console.log('Profile update will be implemented with user profiles table:', updates)
      return { data: null, error: null }
    } catch (error) {
      console.error('Error updating profile:', error)
      return { data: null, error }
    } finally {
      setLoading(false)
    }
  }

  const isAuthenticated = () => {
    return !!user && !!session
  }

  const isLoading = () => {
    return loading
  }

  const getCurrentUser = () => {
    return user
  }

  const getSession = () => {
    return session
  }

  // Auth context value
  const value = {
    // State
    user,
    session,
    loading,
    
    // Functions
    signUp,
    signIn,
    signOut,
    resetPassword,
    updateProfile,
    
    // Helpers
    isAuthenticated,
    isLoading,
    getCurrentUser,
    getSession
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext