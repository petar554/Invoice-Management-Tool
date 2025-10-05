import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { useNotifications } from '../contexts/NotificationContext'
import apiService from '../services/apiService'

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedType, setSelectedType] = useState('')
  const [selectedStatus, setSelectedStatus] = useState('')
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const [sortField, setSortField] = useState('created_at')
  const [sortOrder, setSortOrder] = useState('desc')
  const [selectedDocuments, setSelectedDocuments] = useState([])
  const [showDeleteModal, setShowDeleteModal] = useState(false)
  const [deletingIds, setDeletingIds] = useState([])

  const navigate = useNavigate()
  const { showError, showSuccess, showWarning } = useNotifications()

  const ITEMS_PER_PAGE = 10

  // load documents with current filters
  const loadDocuments = useCallback(async (showLoader = true) => {
    try {
      if (showLoader) setLoading(true)

      const params = {
        page: currentPage,
        limit: ITEMS_PER_PAGE,
        search: searchQuery.trim(),
        type: selectedType,
        status: selectedStatus,
        sortField,
        sortOrder
      }

      // Remove empty params
      Object.keys(params).forEach(key => {
        if (!params[key]) delete params[key]
      })

      const response = await apiService.getDocuments(params)
      const data = response.data || response

      setDocuments(data.documents || [])
      setTotalPages(data.totalPages || 1)
      setTotalCount(data.totalCount || 0)
      setCurrentPage(data.currentPage || 1)

    } catch (error) {
      console.error('Failed to load documents:', error)
      showError('Greška pri učitavanju dokumenata: ' + error.message)
      setDocuments([])
    } finally {
      setLoading(false)
    }
  }, [currentPage, searchQuery, selectedType, selectedStatus, sortField, sortOrder])

  // load documents on mount and when filters change
  useEffect(() => {
    loadDocuments()
  }, [loadDocuments])

  // reset to first page when filters change
  useEffect(() => {
    if (currentPage !== 1) {
      setCurrentPage(1)
    }
  }, [searchQuery, selectedType, selectedStatus])

  // search with debounce
  const [searchTimeout, setSearchTimeout] = useState(null)
  const handleSearchChange = (e) => {
    const value = e.target.value
    setSearchQuery(value)
    
    if (searchTimeout) clearTimeout(searchTimeout)
    setSearchTimeout(setTimeout(() => {
      setCurrentPage(1) // reset to first page on search
    }, 500))
  }

  // sort handling
  const handleSort = (field) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
    setCurrentPage(1)
  }

  // selection handling
  const handleSelectAll = (checked) => {
    if (checked) {
      setSelectedDocuments(documents.map(doc => doc.id))
    } else {
      setSelectedDocuments([])
    }
  }

  const handleSelectDocument = (docId, checked) => {
    if (checked) {
      setSelectedDocuments(prev => [...prev, docId])
    } else {
      setSelectedDocuments(prev => prev.filter(id => id !== docId))
    }
  }

  // delete handling
  const handleDeleteDocuments = async () => {
    if (selectedDocuments.length === 0) return

    try {
      setDeletingIds(selectedDocuments)
      
      for (const docId of selectedDocuments) {
        await apiService.deleteDocument(docId)
      }

      showSuccess(`Uspešno obrisano ${selectedDocuments.length} dokumenata`)
      setSelectedDocuments([])
      setShowDeleteModal(false)
      loadDocuments(false) // refresh without loader

    } catch (error) {
      console.error('Failed to delete documents:', error)
      showError('Greška pri brisanju dokumenata: ' + error.message)
    } finally {
      setDeletingIds([])
    }
  }

  // format helpers
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('sr-RS', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  const formatFileSize = (bytes) => {
    if (!bytes) return 'N/A'
    const sizes = ['B', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(1024))
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i]
  }

  const formatDocumentType = (type) => {
    const types = {
      'faktura': 'Faktura',
      'izvod': 'Izvod', 
      'ugovor': 'Ugovor',
      'undefined': 'Ostalo'
    }
    return types[type] || type
  }

  const getDocumentTypeColor = (type) => {
    const colors = {
      'faktura': 'text-blue-700 bg-blue-100',
      'izvod': 'text-green-700 bg-green-100',
      'ugovor': 'text-purple-700 bg-purple-100',
      'undefined': 'text-gray-700 bg-gray-100'
    }
    return colors[type] || colors.undefined
  }

  const getStatusColor = (status) => {
    const colors = {
      'processed': 'text-green-700 bg-green-100',
      'pending': 'text-yellow-700 bg-yellow-100',
      'error': 'text-red-700 bg-red-100'
    }
    return colors[status] || colors.pending
  }

  const getStatusText = (status) => {
    const statuses = {
      'processed': 'Obrađen',
      'pending': 'Na čekanju',
      'error': 'Greška'
    }
    return statuses[status] || status
  }

  // pagination
  const generatePaginationPages = () => {
    const pages = []
    const maxVisible = 5
    let start = Math.max(1, currentPage - Math.floor(maxVisible / 2))
    let end = Math.min(totalPages, start + maxVisible - 1)
    
    if (end - start < maxVisible - 1) {
      start = Math.max(1, end - maxVisible + 1)
    }
    
    for (let i = start; i <= end; i++) {
      pages.push(i)
    }
    return pages
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumenti</h1>
          <p className="text-gray-600">
            Upravljajte vašim fakturama i dokumentima
            {totalCount > 0 && (
              <span className="ml-2 text-sm">({totalCount} ukupno)</span>
            )}
          </p>
        </div>
        <button 
          onClick={() => navigate('/upload')}
          className="btn-primary flex items-center space-x-2"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          <span>Upload novi dokument</span>
        </button>
      </div>

      {/* Filters */}
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <input
                type="text"
                placeholder="Pretraži dokumente po imenu ili sadržaju..."
                className="form-input w-full"
                value={searchQuery}
                onChange={handleSearchChange}
              />
            </div>
            <select 
              className="form-input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value)}
            >
              <option value="">Svi tipovi</option>
              <option value="faktura">Fakture</option>
              <option value="izvod">Izvodi</option>
              <option value="ugovor">Ugovori</option>
              <option value="undefined">Ostalo</option>
            </select>
            <select 
              className="form-input"
              value={selectedStatus}
              onChange={(e) => setSelectedStatus(e.target.value)}
            >
              <option value="">Svi statusi</option>
              <option value="processed">Obrađeno</option>
              <option value="pending">Na čekanju</option>
              <option value="error">Greška</option>
            </select>
          </div>

          {/* Bulk actions */}
          {selectedDocuments.length > 0 && (
            <div className="mt-4 flex items-center justify-between p-3 bg-blue-50 rounded-lg">
              <span className="text-sm text-blue-700">
                Izabrano {selectedDocuments.length} dokumenata
              </span>
              <div className="flex space-x-2">
                <button
                  onClick={() => setShowDeleteModal(true)}
                  className="btn-danger text-sm"
                  disabled={deletingIds.length > 0}
                >
                  {deletingIds.length > 0 ? 'Brišem...' : 'Obriši'}
                </button>
                <button
                  onClick={() => setSelectedDocuments([])}
                  className="btn-secondary text-sm"
                >
                  Poništi
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Documents table */}
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
              <span className="ml-3 text-gray-600">Učitavam dokumente...</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="text-center py-12">
              <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              <h3 className="text-lg font-medium text-gray-900 mb-2">
                {searchQuery || selectedType || selectedStatus ? 'Nema dokumenata koji odgovaraju pretrazi' : 'Nema dokumenata'}
              </h3>
              <p className="text-gray-500 mb-6">
                {searchQuery || selectedType || selectedStatus 
                  ? 'Pokušajte sa drugačijim filterima pretrage.' 
                  : 'Počnite sa dodavanjem vaših prvih dokumenata.'}
              </p>
              <button 
                onClick={() => navigate('/upload')}
                className="btn-primary"
              >
                Upload prvi dokument
              </button>
            </div>
          ) : (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left">
                    <input
                      type="checkbox"
                      checked={selectedDocuments.length === documents.length && documents.length > 0}
                      onChange={(e) => handleSelectAll(e.target.checked)}
                      className="form-checkbox"
                    />
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('original_filename')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Naziv</span>
                      {sortField === 'original_filename' && (
                        <svg className={`w-4 h-4 ${sortOrder === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Tip
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Veličina
                  </th>
                  <th 
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort('created_at')}
                  >
                    <div className="flex items-center space-x-1">
                      <span>Datum</span>
                      {sortField === 'created_at' && (
                        <svg className={`w-4 h-4 ${sortOrder === 'desc' ? 'transform rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 15l7-7 7 7" />
                        </svg>
                      )}
                    </div>
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Akcije
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {documents.map((document) => (
                  <tr key={document.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4">
                      <input
                        type="checkbox"
                        checked={selectedDocuments.includes(document.id)}
                        onChange={(e) => handleSelectDocument(document.id, e.target.checked)}
                        className="form-checkbox"
                      />
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-8 w-8">
                          <svg className="h-8 w-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                          </svg>
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900 max-w-xs truncate">
                            {document.original_filename || document.filename}
                          </div>
                          {document.extracted_data && Object.keys(document.extracted_data).length > 0 && (
                            <div className="text-sm text-gray-500">
                              Izvučeni podaci dostupni
                            </div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getDocumentTypeColor(document.document_type)}`}>
                        {formatDocumentType(document.document_type)}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(document.document_status)}`}>
                        {getStatusText(document.document_status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatFileSize(document.file_size)}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-500">
                      {formatDate(document.created_at)}
                    </td>
                    <td className="px-6 py-4 text-right text-sm font-medium">
                      <div className="flex items-center justify-end space-x-2">
                        <button className="text-blue-600 hover:text-blue-900">
                          Prikaži
                        </button>
                        <button className="text-gray-600 hover:text-gray-900">
                          Download
                        </button>
                        <button 
                          onClick={() => {
                            setSelectedDocuments([document.id])
                            setShowDeleteModal(true)
                          }}
                          className="text-red-600 hover:text-red-900"
                        >
                          Obriši
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Pagination */}
        {!loading && documents.length > 0 && totalPages > 1 && (
          <div className="px-6 py-3 border-t border-gray-200 flex items-center justify-between">
            <div className="text-sm text-gray-700">
              Stranica {currentPage} od {totalPages} ({totalCount} ukupno)
            </div>
            <div className="flex items-center space-x-1">
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prvi
              </button>
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Prethodna
              </button>
              
              {generatePaginationPages().map(page => (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`px-3 py-1 text-sm border rounded ${
                    currentPage === page 
                      ? 'bg-blue-600 text-white border-blue-600' 
                      : 'hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              ))}
              
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Sledeća
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                className="px-3 py-1 text-sm border rounded hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Poslednja
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Delete confirmation modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Potvrdi brisanje
            </h3>
            <p className="text-gray-600 mb-6">
              Da li ste sigurni da želite da obrišete {selectedDocuments.length} 
              {selectedDocuments.length === 1 ? ' dokument' : ' dokumenata'}? 
              Ova akcija se ne može poništiti.
            </p>
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="btn-secondary"
                disabled={deletingIds.length > 0}
              >
                Odustani
              </button>
              <button
                onClick={handleDeleteDocuments}
                className="btn-danger"
                disabled={deletingIds.length > 0}
              >
                {deletingIds.length > 0 ? 'Brišem...' : 'Obriši'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}