# Custom errors (Silo contracts)

Custom error signatures are generated from canonical `IErrors.sol` and stored with selector mappings for UI decoding.

## Files

- **customErrorsList.json**: full list of signatures with source URL.
- **customErrorsSelectors.json**: `selectorHex -> signature` mapping plus selector list (`selectorHex`, `selectorDecimal`).

## Generation

Generate (or refresh) mappings:

```bash
npm run build:errors
```

Default source:

- `https://raw.githubusercontent.com/silo-finance/silo-contracts-v3/refs/heads/develop/common/utils/interfaces/IErrors.sol`

Override source URL:

```bash
SILO_IERRORS_URL=https://example.com/IErrors.sol node scripts/buildCustomErrorsSelectors.mjs
```

## UI usage

When revert data contains a selector, compare it against `customErrorsSelectors.bySelector`.
If `bySelector[selectorHex]` exists, show that signature instead of raw hex.
