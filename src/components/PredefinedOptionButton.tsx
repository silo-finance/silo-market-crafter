'use client'

import React from 'react'

export interface PredefinedOptionButtonProps {
  children: React.ReactNode
  onClick: () => void
  disabled?: boolean
  loading?: boolean
}

const buttonClassName =
  'px-3 py-1.5 rounded-full text-xs font-semibold border border-gray-600 bg-gray-900 text-gray-200 hover:border-lime-400 hover:text-lime-200 transition-colors flex items-center gap-1.5 disabled:opacity-50 disabled:cursor-not-allowed'

export default function PredefinedOptionButton({
  children,
  onClick,
  disabled = false,
  loading = false
}: PredefinedOptionButtonProps) {
  return (
    <button
      type="button"
      disabled={disabled}
      className={buttonClassName}
      onClick={onClick}
    >
      {loading ? (
        <>
          <svg className="animate-spin h-3 w-3" fill="none" viewBox="0 0 24 24" aria-hidden>
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
          </svg>
          <span>Loading…</span>
        </>
      ) : (
        children
      )}
    </button>
  )
}
