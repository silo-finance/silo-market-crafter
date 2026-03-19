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
    - Hook owner in official list: we check that hook owner address exists in official Silo address list.
    - Hook owner matches wizard: we check that hook owner on-chain matches hook owner selected in wizard. *
  - Defaulting hook / gauge checks
    - Defaulting mode detection: we check whether market uses defaulting liquidation mode and whether one or both assets are borrowable.
    - Gauge required/exists: when only one asset is borrowable, we check if required Silo Incentives Controller (gauge) is configured.
    - (i) Show LT margin for defaulting.
    - Gauge owner in official list: for configured gauge, we check that gauge owner exists in official Silo address list.
    - Gauge owner matches hook owner: for configured gauge, we check whether gauge owner and hook owner are the same.
    - Gauge owner matches wizard: for configured gauge, we check whether gauge owner matches wizard hook owner. *
    - Gauge notifier wiring: for configured gauge, we check whether notifier points to hook address.

## SILO 0

- Token
  - Token in official list: we check that token address exists in official Silo address list.
  - Token matches wizard: we check that token address on-chain matches token selected in wizard. *

- Share tokens
  - (i) Show share token details (symbol, decimals, decimals offset).

- Solvency Oracle
  - Price checks
    - Price too low check: we flag if price looks suspiciously low.
    - Price too high check: we flag if price looks suspiciously high.
    - Price format check: we flag if raw price format/length looks invalid.
  - PT Linear specific
    - PT base discount validation: we check that base discount is in allowed range and matches wizard value. *
  - Owner checks
    - Oracle owner in official list: we check that oracle owner address exists in official Silo address list.
    - Oracle owner matches wizard: we check that oracle owner matches wizard owner. *
  - (i) Show underlying oracle and timelock when available.
  - (i) Show Chainlink aggregator details when available.

- Max LTV Oracle (only when different from Solvency Oracle)
  - Price checks
    - Price too low check: we flag if price looks suspiciously low.
    - Price too high check: we flag if price looks suspiciously high.
    - Price format check: we flag if raw price format/length looks invalid.
  - (i) Show underlying oracle and timelock when available.
  - (i) Show Chainlink aggregator details when available.

- Interest Rate Model
  - Owner checks
    - IRM owner in official list: we check that IRM owner address exists in official Silo address list.
    - IRM owner matches wizard: we check that IRM owner matches wizard owner. *
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
  - Token in official list: we check that token address exists in official Silo address list.
  - Token matches wizard: we check that token address on-chain matches token selected in wizard. *

- Share tokens
  - (i) Show share token details.

- Solvency Oracle
  - Price checks: same three checks as SILO 0 (too low / too high / invalid format).
  - PT Linear specific:
    - PT base discount validation: we check range and wizard match. *
  - Owner checks:
    - Oracle owner in official list: we check that owner address exists in official Silo address list.
    - Oracle owner matches wizard: we check that owner matches wizard owner. *
  - (i) Show underlying/timelock and Chainlink details when available.

- Max LTV Oracle (if separate)
  - Price checks: same three checks as SILO 0 (too low / too high / invalid format).
  - (i) Show underlying/timelock and Chainlink details when available.

- Interest Rate Model
  - IRM owner in official list: we check that IRM owner address exists in official Silo address list.
  - IRM owner matches wizard: we check that IRM owner matches wizard owner. *
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
