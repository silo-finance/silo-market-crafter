'use client'

import React, { useEffect, useState } from 'react'

const STORAGE_KEY = 'alpha-disclaimer-accepted'
const REDIRECT_URL = 'https://silo.finance'

export default function AlphaDisclaimer({ children }: { children: React.ReactNode }) {
  const [showModal, setShowModal] = useState(false)

  useEffect(() => {
    try {
      const accepted = localStorage.getItem(STORAGE_KEY) === 'true'
      if (!accepted) setShowModal(true)
    } catch {
      setShowModal(true)
    }
  }, [])

  const handleAccept = () => {
    try {
      localStorage.setItem(STORAGE_KEY, 'true')
    } catch {
      // ignore storage errors
    }
    setShowModal(false)
  }

  const handleReject = () => {
    window.location.href = REDIRECT_URL
  }

  return (
    <>
      <div className="pb-14">
        {children}
      </div>

      {/* Sticky alpha disclaimer banner */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-red-600 text-white text-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 text-center">
          This is an ALPHA version and may contain bugs. Use it at your own risk.
        </div>
      </div>

      {/* First-visit modal */}
      {showModal && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/70 px-4">
          <div className="w-full max-w-lg rounded-lg border border-red-700 bg-gray-900 p-6 text-white shadow-xl">
            <h2 className="text-lg font-semibold mb-2">ALPHA Version</h2>
            <p className="text-sm text-gray-300 mb-4">
              This is an ALPHA version and may contain bugs. Use it at your own risk.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end">
              <button
                type="button"
                onClick={handleReject}
                className="px-4 py-2 rounded-md border border-gray-600 text-gray-200 hover:text-white hover:border-gray-400"
              >
                I do not accept
              </button>
              <button
                type="button"
                onClick={handleAccept}
                className="px-4 py-2 rounded-md bg-red-600 hover:bg-red-700 text-white font-semibold"
              >
                OK
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
