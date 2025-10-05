// API service for Invoice Management Tool
const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api'

class ApiService {
  constructor() {
    this.baseURL = API_BASE_URL
  }

  /**
   * get auth headers with current user token
   */
  async getAuthHeaders() {
    // Get current session from Supabase
    const { auth } = await import('../lib/supabase')
    const { data: { session } } = await auth.getSession()
    
    return {
      'Content-Type': 'application/json',
      'Authorization': session?.access_token ? `Bearer ${session.access_token}` : '',
    }
  }

  /**
   * authenticated API request
   */
  async request(endpoint, options = {}) {
    const url = `${this.baseURL}${endpoint}`
    const headers = await this.getAuthHeaders()
    const config = {
      headers,
      ...options,
      headers: {
        ...headers,
        ...(options.headers || {})
      }
    }

    try {
      const response = await fetch(url, config)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`)
      }

      return await response.json()
    } catch (error) {
      console.error(`API request failed: ${endpoint}`, error)
      throw error
    }
  }

  // =====================================
  // DOCUMENTS API
  // =====================================

  /**
   * get all documents with filtering and pagination
   */
  async getDocuments(params = {}) {
    const searchParams = new URLSearchParams()
    
    if (params.page) searchParams.append('page', params.page)
    if (params.limit) searchParams.append('limit', params.limit)
    if (params.search) searchParams.append('search', params.search)
    if (params.type) searchParams.append('type', params.type)
    if (params.status) searchParams.append('status', params.status)
    if (params.dateFrom) searchParams.append('dateFrom', params.dateFrom)
    if (params.dateTo) searchParams.append('dateTo', params.dateTo)

    const query = searchParams.toString()
    const endpoint = `/documents${query ? `?${query}` : ''}`
    
    return this.request(endpoint)
  }

  /**
   * get single document by ID
   */
  async getDocument(id) {
    return this.request(`/documents/${id}`)
  }

  /**
   * upload new document(s)
   */
  async uploadDocuments(files, metadata = {}) {
    const formData = new FormData()
    
    // add files to form data
    if (Array.isArray(files)) {
      files.forEach((file, index) => {
        formData.append('documents', file)
      })
    } else {
      formData.append('documents', files)
    }

    // add metadata
    if (metadata.description) {
      formData.append('description', metadata.description)
    }

    const headers = await this.getAuthHeaders()
    delete headers['Content-Type'] // Let browser set multipart boundary

    return this.request('/documents/upload', {
      method: 'POST',
      headers,
      body: formData,
    })
  }

  /**
   * update document
   */
  async updateDocument(id, updates) {
    return this.request(`/documents/${id}`, {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }

  /**
   * delete document
   */
  async deleteDocument(id) {
    return this.request(`/documents/${id}`, {
      method: 'DELETE',
    })
  }

  /**
   * search documents with advanced filtering
   */
  async searchDocuments(query, filters = {}) {
    return this.request('/documents/search', {
      method: 'POST',
      body: JSON.stringify({
        query,
        ...filters,
      }),
    })
  }

  /**
   * get document statistics for dashboard
   */
  async getDocumentStatistics() {
    return this.request('/documents/statistics')
  }

  // =====================================
  // EMAIL API
  // =====================================

  /**
   * configure email settings
   */
  async configureEmail(config) {
    return this.request('/email/configure', {
      method: 'POST',
      body: JSON.stringify(config),
    })
  }

  /**
   * test email connection
   */
  async testEmailConnection() {
    return this.request('/email/test', {
      method: 'POST',
    })
  }

  /**
   * process emails for new documents
   */
  async processEmails() {
    return this.request('/email/process', {
      method: 'POST',
    })
  }

  /**
   * get email processing status
   */
  async getEmailStatus() {
    return this.request('/email/status')
  }

  /**
   * disconnect email service
   */
  async disconnectEmail() {
    return this.request('/email/disconnect', {
      method: 'DELETE',
    })
  }

  // =====================================
  // AUTH API (Optional - Supabase handles most)
  // =====================================

  /**
   *get current user profile
   */
  async getUserProfile() {
    return this.request('/auth/profile')
  }

  /**
   * update user profile
   */
  async updateUserProfile(updates) {
    return this.request('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(updates),
    })
  }
}

// singleton instance
const apiService = new ApiService()

export default apiService

export const {
  getDocuments,
  getDocument,
  uploadDocuments,
  updateDocument,
  deleteDocument,
  searchDocuments,
  getDocumentStatistics,
  configureEmail,
  testEmailConnection,
  processEmails,
  getEmailStatus,
  disconnectEmail,
  getUserProfile,
  updateUserProfile,
} = apiService