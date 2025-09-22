import React from 'react'

export default function DashboardPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600">Pregled vašeg Invoice Management sistema</p>
      </div>
      
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Ukupno dokumenata</h3>
          <p className="text-3xl font-bold text-primary-600">-</p>
          <p className="text-sm text-gray-500 mt-1">Implementirano u sledećoj fazi</p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Obrađeno ovog meseca</h3>
          <p className="text-3xl font-bold text-success-600">-</p>
          <p className="text-sm text-gray-500 mt-1">Implementirano u sledećoj fazi</p>
        </div>
        
        <div className="card p-6">
          <h3 className="text-lg font-medium text-gray-900 mb-2">Na čekanju</h3>
          <p className="text-3xl font-bold text-warning-600">-</p>
          <p className="text-sm text-gray-500 mt-1">Implementirano u sledećoj fazi</p>
        </div>
      </div>
      
      <div className="card p-6">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Poslednji dokumenti</h3>
        <div className="text-center py-8">
          <p className="text-gray-500">Lista dokumenata će biti implementirana u sledećoj fazi...</p>
        </div>
      </div>
    </div>
  )
}