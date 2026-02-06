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

### `verifyAddressInJson(address: string, chainId: string): Promise<boolean>`

Verifies whether an address exists in the addresses JSON file for the given chain.
**This verification is independent of wizard data and is always performed.**

- `address`: Address to check (from on-chain config or any source)
  - Source: Any address (e.g., `marketConfig.silo0.hookReceiverOwner`, `marketConfig.silo0.interestRateModel.owner`)
- `chainId`: Chain ID as string (e.g., "1" for mainnet, "137" for polygon)
  - Source: `wizardData.networkInfo?.chainId` or `provider.getNetwork().chainId.toString()`
- Returns: `Promise<boolean>` - true if address is found in addresses JSON, false otherwise

### `verifyDeployerFee(onChainValue: bigint, wizardValue: number): boolean`

Verifies that the on-chain Deployer fee value matches the value set in the wizard.

- `onChainValue`: Deployer fee from on-chain contract (in 18 decimals format)
  - Source: `config.silo0.deployerFee` (from `fetchMarketConfig`)
- `wizardValue`: Deployer fee from wizard state (0-1 format, e.g., 0.05 for 5%)
  - Source: `wizardData.feesConfiguration.deployerFee`

### `isValueHigh(onChainValue: bigint, thresholdPercent?: number): boolean`

**Global verification function** - Checks if a value in 18 decimals format is unexpectedly high.
Can be used for any percentage-based value (DAO Fee, Deployer Fee, Max LTV, etc.).

- `onChainValue`: Value from on-chain contract (in 18 decimals format)
  - Source: Any on-chain value (e.g., `config.silo0.deployerFee`, `config.silo0.daoFee`)
- `thresholdPercent`: Threshold percentage (default: 5, meaning 5%)
- Returns: `true` if value is greater than threshold, `false` otherwise

### `verifyToken(onChainToken: string, wizardToken: string | null | undefined): boolean`

Verifies that the on-chain token address matches the value set in the wizard.

- `onChainToken`: Token address from on-chain contract
  - Source: `config.silo0.token` or `config.silo1.token` (from `fetchMarketConfig`)
- `wizardToken`: Token address from wizard state
  - Source: `wizardData.token0.address` or `wizardData.token1.address`

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
