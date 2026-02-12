/**
 * Formatting utilities for displaying values in various formats
 */

import { ethers } from 'ethers'

/**
 * Format bigint value as E18 notation
 * 
 * IMPORTANT: This function assumes the value is already in 18 decimals format.
 * For wizard values (percentage * 10^16), use formatWizardBigIntToE18 instead.
 * 
 * @param value - BigInt value in 18 decimals format (e.g., 1000000000000000000n for 1e18)
 * @param fullPrecision - If true, always shows all 18 decimal places. If false, removes trailing zeros.
 * @returns Formatted string in E18 notation (e.g., "1.000000000000000000e18" or "1e18")
 * 
 * @example
 * ```typescript
 * formatBigIntToE18(1000000000000000000n) // "1.000000000000000000e18" (fullPrecision=true) or "1e18" (fullPrecision=false)
 * formatBigIntToE18(500000000000000000n) // "0.500000000000000000e18" or "0.5e18"
 * formatBigIntToE18(950000000000000000n) // "0.950000000000000000e18" or "0.95e18"
 * formatBigIntToE18(0n) // "0"
 * ```
 */
export function formatBigIntToE18(value: bigint, fullPrecision: boolean = false): string {
  if (value === BigInt(0)) return '0'
  
  const str = value.toString()
  
  if (fullPrecision) {
    // Pad to exactly 19 digits (1 integer digit + 18 fractional digits)
    // This ensures we always show full precision
    const padded = str.padStart(19, '0')
    
    // Format as: first digit, decimal point, remaining 18 digits (always show all), e18
    // Example: 1000000000000000000 → "1.000000000000000000e18"
    // Example: 500000000000000000 → "0.500000000000000000e18"
    return `${padded[0]}.${padded.slice(1)}e18`
  } else {
    // Use ethers.formatUnits to avoid floating point precision issues
    // This ensures exact conversion without rounding errors
    const formatted = ethers.formatUnits(value, 18)
    // Remove trailing zeros and decimal point if needed
    const cleaned = formatted.replace(/\.?0+$/, '')
    return `${cleaned}e18`
  }
}

/**
 * Format wizard bigint value (percentage * 10^16) as E18 notation
 * 
 * Wizard values are stored as percentage * 10^16 (e.g., 95% = 950000000000000000n).
 * This function converts them to E18 format (e.g., 0.95e18).
 * 
 * Uses the same normalization logic as bigintToDisplayNumber to ensure consistency.
 * Uses string manipulation to avoid floating point precision issues.
 * 
 * @param value - BigInt value in wizard format (percentage * 10^16)
 * @param fullPrecision - If true, always shows all 18 decimal places. If false, removes trailing zeros.
 * @returns Formatted string in E18 notation (e.g., "0.950000000000000000e18" or "0.95e18")
 * 
 * @example
 * ```typescript
 * formatWizardBigIntToE18(950000000000000000n) // "0.950000000000000000e18" (fullPrecision=true) or "0.95e18" (fullPrecision=false)
 * formatWizardBigIntToE18(50000000000000000n) // "0.050000000000000000e18" or "0.05e18"
 * formatWizardBigIntToE18(0n) // "0"
 * ```
 */
export function formatWizardBigIntToE18(value: bigint, fullPrecision: boolean = false): string {
  if (value === BigInt(0)) return '0'
  
  // Convert wizard format (percentage * 10^16) to E18 format using string manipulation
  // to avoid floating point precision issues
  // value = percentage * 10^16
  // E18 format = (percentage / 100) * 10^18 = percentage * 10^16 = value
  // So value is already the correct magnitude, we just need to format it with 18 decimals
  
  const str = value.toString()
  
  if (fullPrecision) {
    // Pad to exactly 19 digits (1 integer digit + 18 fractional digits)
    const padded = str.padStart(19, '0')
    
    // Format as: first digit, decimal point, remaining 18 digits (always show all), e18
    // Example: 950000000000000000 → "0.950000000000000000e18"
    // Example: 50000000000000000 → "0.050000000000000000e18"
    return `${padded[0]}.${padded.slice(1)}e18`
  } else {
    // Convert percentage to E18 coefficient using string manipulation to avoid precision issues
    // percentage / 100 = coefficient
    // We'll use the percentage string directly and divide by 100 using string math
    const percentageStr = ethers.formatUnits(value, 16)
    
    // Parse percentage as string to avoid floating point errors
    // If percentage is an integer, we can format directly
    if (percentageStr.includes('.')) {
      const [intPart, fracPart = ''] = percentageStr.split('.')
      const intNum = parseInt(intPart, 10)
      const fracNum = fracPart.padEnd(16, '0').slice(0, 16)
      
      // Divide by 100: intNum / 100 + fracNum / (100 * 10^16)
      const intCoeff = Math.floor(intNum / 100)
      const intRemainder = intNum % 100
      
      // Combine remainder with fractional part
      const combinedFrac = (intRemainder.toString().padStart(2, '0') + fracNum).padEnd(18, '0').slice(0, 18)
      
      // Remove trailing zeros
      const cleanedFrac = combinedFrac.replace(/0+$/, '')
      
      if (cleanedFrac === '') {
        return `${intCoeff}e18`
      } else {
        return `${intCoeff}.${cleanedFrac}e18`
      }
    } else {
      // Integer percentage
      const intNum = parseInt(percentageStr, 10)
      const intCoeff = Math.floor(intNum / 100)
      const intRemainder = intNum % 100
      
      if (intRemainder === 0) {
        return `${intCoeff}e18`
      } else {
        // Format remainder as 18 decimal places
        const fracStr = intRemainder.toString().padStart(2, '0').padEnd(18, '0')
        const cleanedFrac = fracStr.replace(/0+$/, '')
        return `${intCoeff}.${cleanedFrac}e18`
      }
    }
  }
}

/**
 * Format number, bigint, or string value as E18 notation
 * Useful for values that might come in different formats
 * 
 * @param value - Value as number, bigint, or string
 * @param fullPrecision - If true, always shows all 18 decimal places. If false, removes trailing zeros.
 * @returns Formatted string in E18 notation
 */
export function formatToE18(value: number | bigint | string, fullPrecision: boolean = false): string {
  const bigintValue = typeof value === 'bigint' 
    ? value 
    : typeof value === 'string' 
      ? BigInt(value) 
      : BigInt(Math.round(Number(value)))
  return formatBigIntToE18(bigintValue, fullPrecision)
}
