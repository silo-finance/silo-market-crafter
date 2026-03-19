'use client'

/**
 * Reusable Button component with consistent styling across the app.
 * Use variant/size props instead of inline Tailwind classes.
 *
 * Variants: primary | primaryDark | primaryLightDisabled | secondary | destructive | orange | outline | outlineLight | ghost
 * Sizes: sm | md | mdWide | lg | icon
 */
import React from 'react'

const variantStyles = {
  primary:
    'bg-lime-700 hover:bg-lime-600 disabled:bg-gray-600 disabled:opacity-55 disabled:cursor-not-allowed text-white cta-strong-white',
  primaryDark:
    'bg-lime-800 hover:bg-lime-700 text-white cta-strong-white',
  primaryLightDisabled:
    'bg-lime-800 hover:bg-lime-700 disabled:bg-lime-200 disabled:cursor-not-allowed text-white cta-strong-white disabled:!text-emerald-700',
  secondary:
    'bg-gray-600 hover:bg-gray-700 text-white cta-strong-white',
  destructive:
    'bg-red-600 hover:bg-red-700 text-white cta-strong-white',
  orange:
    'bg-orange-600 hover:bg-orange-500 text-white cta-strong-white',
  outline:
    'bg-lime-200 hover:bg-lime-300 border border-lime-300 text-emerald-900 font-semibold',
  outlineLight:
    'bg-lime-200 hover:bg-lime-300 text-emerald-900 font-medium',
  ghost:
    'border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700',
} as const

const sizeStyles = {
  sm: 'py-2 px-4 rounded-lg',
  md: 'py-3 px-6 rounded-lg',
  mdWide: 'py-2 px-6 rounded-lg',
  lg: 'py-3 px-8 rounded-lg',
  icon: 'p-3 rounded-full',
} as const

export type ButtonVariant = keyof typeof variantStyles
export type ButtonSize = keyof typeof sizeStyles

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  fullWidth?: boolean
  children: React.ReactNode
}

export default function Button({
  variant = 'primary',
  size = 'lg',
  fullWidth = false,
  className = '',
  children,
  type = 'button',
  ...props
}: ButtonProps) {
  return (
    <button
      type={type}
      className={[
        'font-semibold transition-colors duration-200 flex items-center justify-center gap-2',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'flex-1 w-full',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      {...props}
    >
      {children}
    </button>
  )
}
