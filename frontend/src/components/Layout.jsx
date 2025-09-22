import React, { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'

export default function Layout({ children }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const { user, signOut } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()

  const navigation = [
    { name: 'Dashboard', href: '/dashboard', icon: '📊' },
    { name: 'Dokumenti', href: '/documents', icon: '📄' },
    { name: 'Upload', href: '/upload', icon: '📤' },
    { name: 'Profil', href: '/profile', icon: '👤' },
  ]

  const handleSignOut = async () => {
    const { error } = await signOut()
    if (!error) {
      navigate('/login')
    }
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-gray-900 bg-opacity-75 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* sidebar */}
      <div className={`
        fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0
        ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'}
      `}>
        <div className="flex items-center justify-center h-16 bg-primary-600">
          <h1 className="text-xl font-bold text-white">Invoice Manager</h1>
        </div>
        
        <nav className="mt-8">
          <div className="px-4 space-y-2">
            {navigation.map((item) => {
              const isActive = location.pathname === item.href
              return (
                <Link
                  key={item.name}
                  to={item.href}
                  className={`
                    flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors
                    ${isActive
                      ? 'bg-primary-100 text-primary-700 border-r-2 border-primary-500'
                      : 'text-gray-700 hover:bg-gray-100'
                    }
                  `}
                  onClick={() => setSidebarOpen(false)}
                >
                  <span className="mr-3 text-lg">{item.icon}</span>
                  {item.name}
                </Link>
              )
            })}
          </div>
        </nav>

        {/* user info in sidebar */}
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
          <div className="flex items-center space-x-3">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                {user?.email?.charAt(0).toUpperCase() || 'U'}
              </div>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">
                {user?.email || 'Korisnik'}
              </p>
              <p className="text-xs text-gray-500">Online</p>
            </div>
          </div>
          <button
            onClick={handleSignOut}
            className="mt-3 w-full text-left px-3 py-2 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
          >
            Odjavi se
          </button>
        </div>
      </div>

      {/* main content */}
      <div className="lg:pl-64">
        {/* top bar */}
        <div className="bg-white shadow-sm border-b border-gray-200">
          <div className="px-4 sm:px-6 lg:px-8">
            <div className="flex justify-between items-center h-16">
              {/* mobile menu button */}
              <button
                type="button"
                className="lg:hidden text-gray-500 hover:text-gray-700"
                onClick={() => setSidebarOpen(true)}
              >
                <span className="sr-only">Open sidebar</span>
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>

              {/* page title */}
              <div className="flex-1 lg:flex-none">
                <h1 className="text-lg font-semibold text-gray-900 lg:hidden">
                  {navigation.find(item => item.href === location.pathname)?.name || 'Invoice Manager'}
                </h1>
              </div>

              {/* top bar actions */}
              <div className="flex items-center space-x-4">
                {/* notifications */}
                <button className="text-gray-500 hover:text-gray-700 relative">
                  <span className="sr-only">View notifications</span>
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 17h5l-5 5-5-5h5z" />
                  </svg>
                  {/* notifications badge */}
                  <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                    3
                  </span>
                </button>

                {/* user menu (desktop) */}
                <div className="hidden lg:block">
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0">
                      <div className="w-8 h-8 bg-primary-600 rounded-full flex items-center justify-center text-white text-sm font-medium">
                        {user?.email?.charAt(0).toUpperCase() || 'U'}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">
                        {user?.email || 'Korisnik'}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* page content */}
        <main className="py-8">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}