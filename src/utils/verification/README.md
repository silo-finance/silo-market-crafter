# Verification Functions

This directory contains all verification logic for the market deployment verification step (Step 11).

## Purpose

All verification functions are isolated in this directory to make it easy for auditors to review verification logic without searching through component files. Each function clearly documents:

- What values are being compared (on-chain vs wizard state)
- The source of each value (e.g., `wizardData.hookOwnerAddress`, `config.silo0.daoFee`)
- The verification logic itself

## Structure

Each verification function is in its own file:

- `daoFeeVerification.ts` - Verifies DAO fee matches wizard configuration
- `siloAddressVerification.ts` - Verifies silo addresses exist in Silo Factory
- `siloImplementationVerification.ts` - Verifies implementation address matches repository
- `hookOwnerVerification.ts` - Verifies hook owner address matches wizard configuration
- `irmOwnerVerification.ts` - Verifies IRM owner address matches wizard configuration

## Usage

All verification functions are exported from `index.ts`:

```typescript
import { 
  verifyDaoFee, 
  verifySiloAddress, 
  verifySiloImplementation,
  verifyHookOwner,
  verifyIrmOwner 
} from '@/utils/verification'
```

## Function Signatures

### `verifyDaoFee(onChainValue: bigint, wizardValue: number): boolean`

Verifies that the on-chain DAO fee value matches the value set in the wizard.

- `onChainValue`: DAO fee from on-chain contract (in 18 decimals format)
  - Source: `config.silo0.daoFee` (from `fetchMarketConfig`)
- `wizardValue`: DAO fee from wizard state (0-1 format, e.g., 0.05 for 5%)
  - Source: `wizardData.feesConfiguration.daoFee`

### `verifySiloAddress(siloAddress: string, siloFactoryAddress: string, provider: ethers.Provider): Promise<boolean>`

Verifies that a silo address exists in the Silo Factory contract by calling `SiloFactory.isSilo(siloAddress)` on-chain.

- `siloAddress`: Silo address to verify (from on-chain config)
  - Source: `config.silo0.silo` or `config.silo1.silo`
- `siloFactoryAddress`: Silo Factory contract address
  - Source: Repository deployment JSON (`silo-core/deployments/{chainName}/SiloFactory.sol.json`)
- `provider`: Ethers.js provider for making on-chain contract calls
  - Source: `new ethers.BrowserProvider(window.ethereum)`
- Returns: `Promise<boolean>` - true if address is verified as a silo, false otherwise

### `verifySiloImplementation(implementationFromEvent: string, implementationFromRepo: string | null): boolean`

Verifies that the implementation address used for deployment matches the expected implementation address from the repository.

- `implementationFromEvent`: Implementation address extracted from NewSilo event (on-chain)
  - Source: `parsed.implementation` from `parseDeployTxReceipt(receipt)`
- `implementationFromRepo`: Implementation address from repository JSON file
  - Source: `silo-core/deploy/silo/_siloImplementations.json[chainName]`

### `verifyHookOwner(onChainOwner: string, wizardOwner: string | null | undefined): boolean`

Verifies that the on-chain hook owner address matches the value set in the wizard.

- `onChainOwner`: Hook owner address from on-chain contract
  - Source: `marketConfig.silo0.hookReceiverOwner` (from `fetchMarketConfig`)
- `wizardOwner`: Hook owner address from wizard state
  - Source: `wizardData.hookOwnerAddress`

### `verifyIrmOwner(onChainOwner: string, wizardOwner: string | null | undefined): boolean`

Verifies that the on-chain IRM owner address matches the value set in the wizard.

- `onChainOwner`: IRM owner address from on-chain contract
  - Source: `marketConfig.silo0.interestRateModel.owner` (from `fetchMarketConfig`)
- `wizardOwner`: IRM owner address from wizard state
  - Source: `wizardData.hookOwnerAddress` (IRM owner is the same as hook owner)

## Where Verification Functions Are Called

- `src/components/Step11Verification.tsx` - Main verification step component
- `src/components/MarketConfigTree.tsx` - Component that displays verification results in the UI

## Audit Checklist

When auditing verification logic:

1. ✅ Check each verification function in this directory
2. ✅ Verify that on-chain values are correctly fetched
3. ✅ Verify that wizard values are correctly referenced (check `wizardData` structure)
4. ✅ Verify that comparison logic is correct (normalization, type conversion, etc.)
5. ✅ Verify that error cases are handled appropriately
6. ✅ Check that verification results are correctly displayed in the UI
