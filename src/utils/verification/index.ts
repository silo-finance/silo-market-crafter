/**
 * Verification Functions
 * 
 * This directory contains all verification logic for the market deployment verification step.
 * Each verification function is isolated and clearly documents:
 * - What values are being compared (on-chain vs wizard state)
 * - The source of each value (e.g., wizardData.hookOwnerAddress)
 * 
 * This structure makes it easy for auditors to review verification logic without
 * searching through component files.
 */

export { isValueHigh5 } from './highValueVerification'
export { verifySiloAddress } from './siloAddressVerification'
export { verifySiloImplementation } from './siloImplementationVerification'
export { verifyAddress } from './addressVerification'
export { verifyAddressInJson } from './addressInJsonVerification'
export { verifyNumericValue } from './numericValueVerification'

// Note: verifySiloAddress and verifyAddressInJson are async and require additional parameters
