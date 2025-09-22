import React from 'react'

export default function LoginPage() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8">
        <div>
          <h2 className="mt-6 text-center text-3xl font-bold text-gray-900">
            Prijavite se na svoj račun
          </h2>
          <p className="mt-2 text-center text-sm text-gray-600">
            Invoice Management Tool MVP
          </p>
        </div>
        
        <div className="card p-8">
          <div className="text-center">
            <div className="spinner mx-auto mb-4"></div>
            <p className="text-gray-600">Login forma će biti implementirana u sledećoj fazi...</p>
          </div>
        </div>
      </div>
    </div>
  )
}