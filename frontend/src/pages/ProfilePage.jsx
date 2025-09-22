import React from 'react'

export default function ProfilePage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Profil korisnika</h1>
        <p className="text-gray-600">Upravljajte vašim nalogom i podešavanjima</p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Lični podaci</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Ime
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Vaše ime"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Prezime
                </label>
                <input
                  type="text"
                  className="form-input"
                  placeholder="Vaše prezime"
                  disabled
                />
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Email adresa
                </label>
                <input
                  type="email"
                  className="form-input"
                  placeholder="vasa.email@example.com"
                  disabled
                />
              </div>
            </div>
            <div className="mt-6">
              <button className="btn-primary" disabled>
                Sačuvaj izmene
              </button>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Promena lozinke</h3>
            <div className="space-y-4 max-w-md">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Trenutna lozinka
                </label>
                <input
                  type="password"
                  className="form-input"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Nova lozinka
                </label>
                <input
                  type="password"
                  className="form-input"
                  disabled
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Potvrdi novu lozinku
                </label>
                <input
                  type="password"
                  className="form-input"
                  disabled
                />
              </div>
            </div>
            <div className="mt-6">
              <button className="btn-secondary" disabled>
                Promeni lozinku
              </button>
            </div>
          </div>
        </div>
        
        <div className="space-y-6">
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Profilna slika</h3>
            <div className="text-center">
              <div className="mx-auto h-24 w-24 bg-gray-200 rounded-full flex items-center justify-center text-2xl text-gray-400 mb-4">
                👤
              </div>
              <button className="btn-secondary text-sm" disabled>
                Upload sliku
              </button>
              <p className="text-xs text-gray-500 mt-2">
                JPG, PNG do 2MB
              </p>
            </div>
          </div>
          
          <div className="card p-6">
            <h3 className="text-lg font-medium text-gray-900 mb-4">Podešavanja</h3>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Email obaveštenja</span>
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">SMS obaveštenja</span>
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled
                />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-gray-700">Automatska obradi</span>
                <input
                  type="checkbox"
                  className="rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                  disabled
                />
              </div>
            </div>
          </div>
          
          <div className="card p-6 border-red-200">
            <h3 className="text-lg font-medium text-red-900 mb-4">Zona opasnosti</h3>
            <p className="text-sm text-red-700 mb-4">
              Brisanje naloga je nepovratno. Svi podaci će biti trajno uklonjeni.
            </p>
            <button className="btn-danger text-sm w-full" disabled>
              Obriši nalog
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}