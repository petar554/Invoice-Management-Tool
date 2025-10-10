import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'https://your-project.supabase.co'
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY || 'your-anon-key'

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    // redirect URLs will be configured in Supabase dashboard
    redirectTo: `${window.location.origin}/auth/callback`
  },
  // config for real-time subscriptions
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
})

export const auth = {
  signUp: async (email, password, metadata = {}) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata
      }
    })
    return { data, error }
  },

  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password
    })
    return { data, error }
  },

  signOut: async () => {
    const { error } = await supabase.auth.signOut()
    return { error }
  },

  getCurrentUser: () => {
    return supabase.auth.getUser()
  },

  getSession: async () => {
    return await supabase.auth.getSession()
  },

  // on changes in authentication state
  onAuthStateChange: (callback) => {
    return supabase.auth.onAuthStateChange(callback)
  },

  resetPassword: async (email) => {
    const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    })
    return { data, error }
  }
}

// helpers for database operations
export const db = {
  documents: {
    getAll: async (userId) => {
      const { data, error } = await supabase
        .from('documents')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
      return { data, error }
    },

    create: async (document) => {
      const { data, error } = await supabase
        .from('documents')
        .insert([document])
        .select()
      return { data, error }
    },

    update: async (id, updates) => {
      const { data, error } = await supabase
        .from('documents')
        .update(updates)
        .eq('id', id)
        .select()
      return { data, error }
    },

    delete: async (id) => {
      const { error } = await supabase
        .from('documents')
        .delete()
        .eq('id', id)
      return { error }
    }
  },

  // Invoices table
  invoices: {
    getAll: async (userId) => {
      const { data, error } = await supabase
        .from('invoices')
        .select('*')
        .eq('user_id', userId)
        .order('invoice_date', { ascending: false })
      return { data, error }
    },

    create: async (invoice) => {
      const { data, error } = await supabase
        .from('invoices')
        .insert([invoice])
        .select()
      return { data, error }
    }
  }
}

export const storage = {
  upload: async (bucket, path, file) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file)
    return { data, error }
  },

  download: async (bucket, path) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .download(path)
    return { data, error }
  },

  getPublicUrl: (bucket, path) => {
    const { data } = supabase.storage
      .from(bucket)
      .getPublicUrl(path)
    return data.publicUrl
  },

  remove: async (bucket, paths) => {
    const { data, error } = await supabase.storage
      .from(bucket)
      .remove(paths)
    return { data, error }
  }
}

export default supabase