# Verification Audit (Step 11)

This document explains, in plain language, what the verification page checks after a market deployment.

Legend:
- `*` = After Deployment Only (this check is available only when the deployment transaction comes from the wizard).
- `(i)` at the beginning of a line = information only (shown to the user, no pass/fail result).

## SILO CONFIG

- SiloFactory checks
  - Check which SiloFactory address should be used on the current network (based on the official Silo repository).
  - Check for `silo0` and `silo1` that both silo addresses are recognized by the current SiloFactory (in simple terms: both silos are valid/registered).
  - Check that the factory address saved inside each silo matches the current official SiloFactory address.

- SILO implementation check
  - Read the implementation address used by the deployment transaction *
  - Compare that implementation address with the official implementation list from the repository *
  - Confirm that the deployed market used an implementation from the official list *

- Fees
  - DAO Fee
    - Check that on-chain DAO fee is exactly the same as in wizard settings *
    - If wizard value is not available, this check is shown as `N/A`.
  - Deployer Fee
    - Check that on-chain deployer fee is exactly the same as in wizard settings *
    - If wizard value is not available, this check is shown as `N/A`.

- Hook Receiver
  - Hook owner checks
    - Read current hook owner address from chain (if available).
    - Check that hook owner on-chain matches hook owner selected in wizard *
    - Check that hook owner address exists in the official Silo address list.
  - Defaulting hook / gauge checks
    - Detect whether this market uses defaulting liquidation mode.
    - Detect whether only one asset is borrowable (or both are borrowable).
    - If only one asset is borrowable:
      - Check whether a Silo Incentives Controller (gauge) is configured where required.
    - (i) Show LT margin for defaulting.
    - If gauge exists:
      - Read gauge owner.
      - Check that gauge owner exists in official Silo address list.
      - Check that gauge owner matches hook owner.
      - Check that gauge owner matches wizard hook owner *
      - Check that gauge notifier points to the hook address.
      - (i) Show gauge owner label/name (if available in address list).

## SILO 0

- Token
  - Check that on-chain token address matches token selected in wizard *
  - Check that token address exists in official Silo address list.

- Share tokens
  - (i) Show share token details (symbol, decimals, decimals offset).

- Solvency Oracle
  - Price checks
    - Check whether oracle price looks too low (possible wrong scaling).
    - Check whether oracle price looks too high (possible wrong scaling).
    - Check whether raw price format/length looks valid for expected precision.
  - PT Linear specific
    - Check whether base discount value is inside allowed range.
    - Check that base discount on-chain matches wizard value *
  - Owner checks
    - Check that oracle owner address exists in official Silo address list.
    - Check that oracle owner matches wizard owner *
  - (i) Show underlying oracle and timelock when available.
  - (i) Show Chainlink aggregator details when available.

- Max LTV Oracle (only when different from Solvency Oracle)
  - Price checks
    - Check whether oracle price looks too low.
    - Check whether oracle price looks too high.
    - Check whether raw price format/length looks valid.
  - (i) Show underlying oracle and timelock when available.
  - (i) Show Chainlink aggregator details when available.

- Interest Rate Model
  - Owner checks
    - Check that IRM owner address exists in official Silo address list.
    - Check that IRM owner matches wizard owner *
  - Dynamic Kink config checks
    - Check whether current IRM configuration matches one of the known official Dynamic Kink configurations.
    - If no match is found, it is shown as not matched.
  - Pending/history checks
    - Check if there is a pending IRM configuration change and try to identify its config name.
    - Check historical IRM configurations and try to identify their names.
    - (i) Show pending/history details as context.

- Risk and fee parameters
  - Max LTV: check on-chain value equals wizard value *
  - Liquidation Threshold (LT): check on-chain value equals wizard value *
  - Liquidation Target LTV: check on-chain value equals wizard value *
  - Liquidation Fee: check on-chain value equals wizard value *
  - Flashloan Fee: check on-chain value equals wizard value *
  - Call Before Quote
    - Check is defined in the UI flow, but currently wizard value is missing, so result is `N/A`.

## SILO 1

- Token
  - Check that on-chain token address matches token selected in wizard *
  - Check that token address exists in official Silo address list.

- Share tokens
  - (i) Show share token details.

- Solvency Oracle
  - Run the same price checks as in SILO 0.
  - PT Linear specific:
    - Check base discount range.
    - Check base discount matches wizard value *
  - Owner checks:
    - Check owner address exists in official Silo address list.
    - Check owner matches wizard owner *
  - (i) Show underlying/timelock and Chainlink details when available.

- Max LTV Oracle (if separate)
  - Run the same price checks as in SILO 0.
  - (i) Show underlying/timelock and Chainlink details when available.

- Interest Rate Model
  - Check that IRM owner exists in official Silo address list.
  - Check that IRM owner matches wizard owner *
  - Check whether current Dynamic Kink config matches known official configs.
  - (i) Show pending config and config history details.

- Risk and fee parameters
  - Check that these on-chain values match wizard values: Max LTV, LT, Liquidation Target LTV, Liquidation Fee, Flashloan Fee *
  - Call Before Quote currently behaves like SILO 0 (`N/A` because wizard value is missing).

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
