import React from 'react'

interface NewFeatureBadgeProps {
  compact?: boolean
  className?: string
}

export default function NewFeatureBadge({ compact = false, className = '' }: NewFeatureBadgeProps) {
  const compactClasses = compact
    ? 'rounded px-1.5 py-0 text-[9px] tracking-[0.06em]'
    : 'rounded-md px-2 py-0.5 text-[10px] tracking-[0.08em]'

  return (
    <span
      className={`new-feature-badge inline-flex items-center bg-gradient-to-r from-[#ff6a3d] to-[#e53935] font-semibold uppercase ${compactClasses} ${className}`.trim()}
    >
      NEW
    </span>
  )
}
