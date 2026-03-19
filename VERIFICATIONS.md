# Verification Audit (Step 11)

This document explains, in plain language, what the verification page checks after a market deployment.

Legend:
- `*` = After Deployment Only (this check is available only when the deployment transaction comes from the wizard).
- `(i)` at the beginning of a line = information only (shown to the user, no pass/fail result).

## SILO CONFIG

- SiloFactory checks
  - Official SiloFactory address: we check which factory is the official one for the selected network.
  - Silo validity in factory: we check that both deployed silos (`silo0` and `silo1`) are recognized as real silos by that factory.
  - Factory consistency: we check that factory address stored in each silo matches the official current SiloFactory.

- SILO implementation check
  - Implementation address validation: we read implementation from deployment transaction and check that it matches an official implementation from repository list. *

- Fees
  - DAO Fee
    - DAO fee match: we check that fee on-chain is exactly the same as in wizard settings. *
  - Deployer Fee
    - Deployer fee match: we check that fee on-chain is exactly the same as in wizard settings. *

- Hook Receiver
  - Hook owner checks
    - Hook owner consistency: we read hook owner from chain, compare it with wizard owner, and also verify that this address exists in official Silo address list. *
  - Defaulting hook / gauge checks
    - Defaulting mode detection: we check whether market uses defaulting liquidation mode and whether one or both assets are borrowable.
    - Gauge required/exists: when only one asset is borrowable, we check if required Silo Incentives Controller (gauge) is configured.
    - (i) Show LT margin for defaulting.
    - Gauge ownership and wiring: for configured gauge, we check owner against official list, compare owner with hook owner and wizard owner, and verify that notifier points to hook address. *

## SILO 0

- Token
  - Token address validation: we check that on-chain token matches wizard token and exists in official Silo address list. *

- Share tokens
  - (i) Show share token details (symbol, decimals, decimals offset).

- Solvency Oracle
  - Price checks
    - Oracle price sanity: we check if price is suspiciously low, suspiciously high, or has an invalid raw format/length.
  - PT Linear specific
    - PT base discount validation: we check that base discount is in allowed range and matches wizard value. *
  - Owner checks
    - Oracle owner validation: we check that owner exists in official Silo address list and matches wizard owner. *
  - (i) Show underlying oracle and timelock when available.
  - (i) Show Chainlink aggregator details when available.

- Max LTV Oracle (only when different from Solvency Oracle)
  - Price checks
    - Oracle price sanity: we check if price is suspiciously low, suspiciously high, or has an invalid raw format/length.
  - (i) Show underlying oracle and timelock when available.
  - (i) Show Chainlink aggregator details when available.

- Interest Rate Model
  - Owner checks
    - IRM owner validation: we check that owner exists in official Silo address list and matches wizard owner. *
  - Dynamic Kink config checks
    - Dynamic Kink config match: we check whether current IRM config matches one of known official Dynamic Kink configurations (otherwise it is shown as not matched).
  - Pending/history checks
    - IRM pending/history identification: we check pending and historical IRM configs and try to map them to known config names.
    - (i) Show pending/history details as context.

- Risk and fee parameters
  - Max LTV: check on-chain value equals wizard value *
  - Liquidation Threshold (LT): check on-chain value equals wizard value *
  - Liquidation Target LTV: check on-chain value equals wizard value *
  - Liquidation Fee: check on-chain value equals wizard value *
  - Flashloan Fee: check on-chain value equals wizard value *
  - Call Before Quote
    - Check is defined in the UI flow, but currently wizard value is missing.

## SILO 1

- Token
  - Token address validation: we check that on-chain token matches wizard token and exists in official Silo address list. *

- Share tokens
  - (i) Show share token details.

- Solvency Oracle
  - Oracle price sanity: same checks as SILO 0 (too low / too high / invalid raw format).
  - PT Linear specific:
    - PT base discount validation: we check range and wizard match. *
  - Owner checks:
    - Oracle owner validation: we check official-list presence and wizard match. *
  - (i) Show underlying/timelock and Chainlink details when available.

- Max LTV Oracle (if separate)
  - Oracle price sanity: same checks as SILO 0 (too low / too high / invalid raw format).
  - (i) Show underlying/timelock and Chainlink details when available.

- Interest Rate Model
  - IRM owner validation: we check official-list presence and wizard match. *
  - Dynamic Kink config match: we check whether current config matches known official configs.
  - (i) Show pending config and config history details.

- Risk and fee parameters
  - Check that these on-chain values match wizard values: Max LTV, LT, Liquidation Target LTV, Liquidation Fee, Flashloan Fee *
  - Call Before Quote currently behaves like SILO 0 (wizard value is missing).

## Shared Address List Checks

- Check selected important addresses against the official Silo address list for the current network.
- Addresses included:
  - Hook owner
  - Gauge owner (if gauge exists)
  - IRM owners (if available)
  - Solvency oracle owners (if available)
  - Token0 and Token1 addresses

## Notes

- `buildVerificationChecks.ts` also exists, but is not currently wired into the Step 11 view.
