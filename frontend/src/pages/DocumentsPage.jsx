import React from 'react'

export default function DocumentsPage() {
  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dokumenti</h1>
          <p className="text-gray-600">Upravljajte vašim fakturama i dokumentima</p>
        </div>
        <button className="btn-primary">
          Upload novi dokument
        </button>
      </div>
      
      <div className="card">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center space-x-4">
            <input
              type="text"
              placeholder="Pretraži dokumente..."
              className="form-input flex-1"
              disabled
            />
            <select className="form-input" disabled>
              <option>Svi tipovi</option>
              <option>Fakture</option>
              <option>Izvodi</option>
              <option>Ugovori</option>
            </select>
            <select className="form-input" disabled>
              <option>Svi statusi</option>
              <option>Obrađeno</option>
              <option>Na čekanju</option>
              <option>Greška</option>
            </select>
          </div>
        </div>
        
        <div className="p-6">
          <div className="text-center py-12">
            <div className="text-6xl text-gray-300 mb-4">📄</div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Nema dokumenata</h3>
            <p className="text-gray-500 mb-6">
              Lista dokumenata i funkcionalnost pretrage će biti implementirana u sledećoj fazi.
            </p>
            <p className="text-sm text-gray-400">
              Trenutno u Documents/ direktorijumu imate sledeće example dokumente za testiranje.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}