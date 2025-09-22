import React, { useState } from 'react'

export default function UploadPage() {
  const [dragActive, setDragActive] = useState(false)

  const handleDrag = (e) => {
    e.preventDefault()
    e.stopPropagation()
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true)
    } else if (e.type === "dragleave") {
      setDragActive(false)
    }
  }

  const handleDrop = (e) => {
    e.preventDefault()
    e.stopPropagation()
    setDragActive(false)
    // File handling će biti implementirano u sledećoj fazi
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Upload dokumenata</h1>
        <p className="text-gray-600">Otpremite nove fakture i dokumente za obradu</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Drag & Drop Upload</h3>
            <div
              className={`border-2 border-dashed rounded-lg p-12 text-center transition-colors ${
                dragActive 
                  ? 'border-primary-500 bg-primary-50' 
                  : 'border-gray-300 hover:border-gray-400'
              }`}
              onDragEnter={handleDrag}
              onDragLeave={handleDrag}
              onDragOver={handleDrag}
              onDrop={handleDrop}
            >
              <div className="text-4xl text-gray-400 mb-4">📁</div>
              <p className="text-lg font-medium text-gray-900 mb-2">
                Prevucite dokumente ovde
              </p>
              <p className="text-gray-500 mb-4">
                ili kliknite da izaberete fajlove
              </p>
              <button className="btn-primary" disabled>
                Izaberite fajlove
              </button>
              <p className="text-xs text-gray-400 mt-4">
                Podržani formati: PDF, JPG, PNG (maksimalno 10MB)
              </p>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Bulk Upload</h3>
            <p className="text-gray-600 mb-4">
              Otpremite više dokumenata odjednom koristeći ZIP arhive
            </p>
            <button className="btn-secondary w-full" disabled>
              Upload ZIP arhive
            </button>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload istorija</h3>
            <div className="text-center py-8">
              <div className="text-4xl text-gray-300 mb-4">📊</div>
              <p className="text-gray-500">
                Lista uploadovanih dokumenata će biti prikazana ovde...
              </p>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Upload instrukcije</h3>
            <div className="space-y-3 text-sm text-gray-600">
              <div className="flex items-start space-x-2">
                <span className="text-primary-600">•</span>
                <span>Prihvaćeni formati: PDF, JPG, PNG</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-primary-600">•</span>
                <span>Maksimalna veličina: 10MB po fajlu</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-primary-600">•</span>
                <span>Bulk upload: koristi ZIP arhive</span>
              </div>
              <div className="flex items-start space-x-2">
                <span className="text-primary-600">•</span>
                <span>AI obradi će automatski izvući podatke</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}