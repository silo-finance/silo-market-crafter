# Verification Functions

This directory contains all verification logic for the market deployment verification step (Step 11).

## Purpose

All verification functions are isolated in this directory to make it easy for auditors to review verification logic without searching through component files. Each function clearly documents:

- What values are being compared (on-chain vs wizard state)
- The source of each value (e.g., `wizardData.hookOwnerAddress`, `config.silo0.daoFee`)
- The verification logic itself

## Structure

Each verification function is in its own file:

- `numericValueVerification.ts` - **Base function** for verifying numeric values (used for DAO Fee, Deployer Fee, Max LTV, Liquidation Threshold, Liquidation Target LTV, Liquidation Fee, Flashloan Fee, etc.)
- `addressVerification.ts` - **Base function** for verifying addresses match wizard configuration (used for Hook Owner, IRM Owner, Token addresses, etc.)
- `siloAddressVerification.ts` - Verifies silo addresses exist in Silo Factory
- `siloImplementationVerification.ts` - Verifies implementation address matches repository
- `addressInJsonVerification.ts` - Verifies addresses exist in repository JSON (always performed, independent of wizard data)
- `highValueVerification.ts` - **Global function** for checking if values are unexpectedly high

## Usage

All verification functions are exported from `index.ts`:

```typescript
import { 
  verifyNumericValue,
  verifyAddress,
  verifySiloAddress, 
  verifySiloImplementation,
  verifyAddressInJson,
  isValueHigh5
} from '@/utils/verification'
```

## Function Signatures

### `verifyNumericValue(onChainValue: bigint, wizardValue: number): boolean`

**Base verification function** for numeric values. Used for verifying DAO Fee, Deployer Fee, Max LTV, Liquidation Threshold, Liquidation Target LTV, Liquidation Fee, and Flashloan Fee.

- `onChainValue`: Value from on-chain contract (in 18 decimals format)
  - Source: Any on-chain numeric value (e.g., `config.silo0.daoFee`, `config.silo0.maxLtv`, `config.silo0.lt`)
- `wizardValue`: Value from wizard state (0-1 format, e.g., 0.75 for 75%)
  - Source: Any wizard numeric value (e.g., `wizardData.feesConfiguration.daoFee`, `wizardData.borrowConfiguration.token0.maxLTV`)

**Note:** This function performs the conversion from wizard format (0-1) to on-chain format (18 decimals) using the same logic as `deployArgs.ts`: `BigInt(Math.round(wizardValue * 100)) * 10^14`

**Usage examples:**
- DAO Fee: `verifyNumericValue(config.silo0.daoFee, wizardData.feesConfiguration.daoFee)`
- Deployer Fee: `verifyNumericValue(config.silo0.deployerFee, wizardData.feesConfiguration.deployerFee)`
- Max LTV: `verifyNumericValue(config.silo0.maxLtv, wizardData.borrowConfiguration.token0.maxLTV)`
- Liquidation Threshold: `verifyNumericValue(config.silo0.lt, wizardData.borrowConfiguration.token0.liquidationThreshold)`

### `verifyAddress(onChainAddress: string, wizardAddress: string | null | undefined): boolean`

**Base verification function** for addresses. Used for verifying Hook Owner, IRM Owner, and any other address comparisons.

- `onChainAddress`: Address from on-chain contract
  - Source: Any on-chain address (e.g., `marketConfig.silo0.hookReceiverOwner`, `marketConfig.silo0.interestRateModel.owner`)
- `wizardAddress`: Address from wizard state
  - Source: Any wizard address (e.g., `wizardData.hookOwnerAddress`)

**Note:** This function normalizes addresses to lowercase before comparison.

**Usage examples:**
- Hook Owner: `verifyAddress(marketConfig.silo0.hookReceiverOwner, wizardData.hookOwnerAddress)`
- IRM Owner: `verifyAddress(marketConfig.silo0.interestRateModel.owner, wizardData.hookOwnerAddress)`
- Token: `verifyAddress(config.silo0.token, wizardData.token0.address)`

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

### `verifyAddressInJson(address: string, chainId: string): Promise<boolean>`

Verifies whether an address exists in the addresses JSON file for the given chain.
**This verification is independent of wizard data and is always performed.**

- `address`: Address to check (from on-chain config or any source)
  - Source: Any address (e.g., `marketConfig.silo0.hookReceiverOwner`, `marketConfig.silo0.interestRateModel.owner`)
- `chainId`: Chain ID as string (e.g., "1" for mainnet, "137" for polygon)
  - Source: `wizardData.networkInfo?.chainId` or `provider.getNetwork().chainId.toString()`
- Returns: `Promise<boolean>` - true if address is found in addresses JSON, false otherwise

### `isValueHigh5(onChainValue: bigint): boolean`

**High value verification function** - Checks if a value in 18 decimals format is unexpectedly high (> 5%).
Can be used for any percentage-based value (DAO Fee, Deployer Fee, Liquidation Fee, Flashloan Fee, etc.).

- `onChainValue`: Value from on-chain contract (in 18 decimals format)
  - Source: Any on-chain value (e.g., `config.silo0.deployerFee`, `config.silo0.daoFee`, `config.silo0.liquidationFee`)
- Returns: `true` if value is greater than 5%, `false` otherwise

**Note:** The threshold is hardcoded to 5% in this function. If a different threshold is needed (e.g., 10%), create a new function with a different number in the name (e.g., `isValueHigh10`).

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
