import React, { useState, useEffect } from 'react'
import { useNotifications } from '../contexts/NotificationContext'
import apiService from '../services/apiService'

export default function DashboardPage() {
  const [stats, setStats] = useState(null)
  const [recentDocuments, setRecentDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const { showError, showSuccess } = useNotifications()

  // load dashboard data
  const loadDashboardData = async (showSuccessMessage = false) => {
    try {
      setRefreshing(true)
      
      // load statistics
      const statisticsResponse = await apiService.getDocumentStatistics()
      setStats(statisticsResponse.data || statisticsResponse)

      // load recent documents
      const documentsResponse = await apiService.getDocuments({ 
        limit: 5, 
        page: 1 
      })
      setRecentDocuments(documentsResponse.data?.documents || documentsResponse.documents || [])
      
      if (showSuccessMessage) {
        showSuccess('Dashboard podaci ažurirani')
      }
    } catch (error) {
      console.error('Failed to load dashboard data:', error)
      showError('Greška pri učitavanju dashboard podataka: ' + error.message)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  useEffect(() => {
    loadDashboardData()
  }, [])

  // auto-refresh every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      loadDashboardData()
    }, 5 * 60 * 1000) // 5 minutes

    return () => clearInterval(interval)
  }, [])

  const formatDocumentType = (type) => {
    const types = {
      'faktura': 'Fakture',
      'izvod': 'Izvodi', 
      'ugovor': 'Ugovori',
      'undefined': 'Ostalo'
    }
    return types[type] || type
  }

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit', 
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const getDocumentTypeColor = (type) => {
    const colors = {
      'faktura': 'text-blue-600 bg-blue-50',
      'izvod': 'text-green-600 bg-green-50',
      'ugovor': 'text-purple-600 bg-purple-50',
      'undefined': 'text-gray-600 bg-gray-50'
    }
    return colors[type] || colors.undefined
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Pregled vašeg Invoice Management sistema</p>
        </div>
        
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          <span className="ml-3 text-gray-600">Učitavam podatke...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-gray-600">Pregled vašeg Invoice Management sistema</p>
        </div>
        
        <button
          onClick={() => loadDashboardData(true)}
          disabled={refreshing}
          className="btn-secondary flex items-center space-x-2"
        >
          {refreshing ? (
            <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-gray-600"></div>
          ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          )}
          <span>Osveži</span>
        </button>
      </div>
      
      {/* Statistics Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ukupno dokumenata</h3>
          <p className="text-3xl font-bold text-blue-600">
            {stats?.total_documents || 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">
            {stats?.total_documents === 0 ? 'Počnite sa upload-om dokumenata' : 'Ukupno u sistemu'}
          </p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ove nedelje</h3>
          <p className="text-3xl font-bold text-green-600">
            {stats?.recent_documents_count || 0}
          </p>
          <p className="text-sm text-gray-500 mt-1">Dodano u poslednjih 7 dana</p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Po tipovima</h3>
          <div className="space-y-1">
            {stats?.documents_by_type && Object.keys(stats.documents_by_type).length > 0 ? (
              Object.entries(stats.documents_by_type).map(([type, count]) => (
                <div key={type} className="flex justify-between text-sm">
                  <span className="text-gray-600">{formatDocumentType(type)}:</span>
                  <span className="font-medium">{count}</span>
                </div>
              ))
            ) : (
              <p className="text-sm text-gray-500">Nema dokumenata</p>
            )}
          </div>
        </div>
      </div>
      
      {/* recent documents */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-medium text-gray-900">Poslednji dokumenti</h3>
        </div>
        
        <div className="p-6">
          {recentDocuments.length === 0 ? (
            <div className="text-center py-8">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <p className="text-gray-500 mt-2">Nema dokumenata</p>
              <p className="text-sm text-gray-400">Dodajte prvi dokument da vidite pregled ovde</p>
            </div>
          ) : (
            <div className="space-y-4">
              {recentDocuments.map((document) => (
                <div key={document.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
                  <div className="flex items-center space-x-4">
                    <div className="flex-shrink-0">
                      <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <div>
                      <p className="font-medium text-gray-900">{document.original_filename || document.filename}</p>
                      <p className="text-sm text-gray-500">
                        Dodato: {formatDate(document.created_at)}
                      </p>
                    </div>
                  </div>
                  
                  <div className="flex items-center space-x-3">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${getDocumentTypeColor(document.document_type)}`}>
                      {formatDocumentType(document.document_type)}
                    </span>
                    
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      document.document_status === 'processed' 
                        ? 'text-green-700 bg-green-100' 
                        : document.document_status === 'error'
                        ? 'text-red-700 bg-red-100'
                        : 'text-yellow-700 bg-yellow-100'
                    }`}>
                      {document.document_status === 'processed' ? 'Obrađen' : 
                       document.document_status === 'error' ? 'Greška' : 'Na čekanju'}
                    </span>
                  </div>
                </div>
              ))}
              
              <div className="text-center pt-4">
                <a href="/documents" className="btn-secondary">
                  Vidi sve dokumente
                </a>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}