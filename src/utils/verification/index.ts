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

export { verifyDaoFee } from './daoFeeVerification'
export { verifySiloAddress } from './siloAddressVerification'
export { verifySiloImplementation } from './siloImplementationVerification'
export { verifyHookOwner } from './hookOwnerVerification'
export { verifyIrmOwner } from './irmOwnerVerification'
export { verifyAddressInJson } from './addressInJsonVerification'

// Note: verifySiloAddress and verifyAddressInJson are async and require additional parameters
