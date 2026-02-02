# Custom errors (Silo contracts)

Lista custom errors wyekstrahowanych z repozytorium **silo-contracts-v2** (silo-core + silo-oracles) oraz ich selektory w HEX i dziesiętnie.

## Pliki

- **customErrorsList.json** – pełna lista: sygnatura + pliki źródłowe (`.sol`).
- **customErrorsSelectors.json** – mapowanie selector → sygnatura oraz lista z `selectorHex` i `selectorDecimal` (do porównań w UI).

## Generowanie

Skrypt skanuje katalogi z kontraktami i zapisuje listę + selektory:

```bash
npm run build:errors
```

Domyślne ścieżki (względem repozytorium `silo-market-crafter`):

- `../silo-contracts-v2/silo-core/contracts`
- `../silo-contracts-v2/silo-oracles/contracts`

Inna lokalizacja `silo-contracts-v2`:

```bash
SILO_CONTRACTS_V2=/ścieżka/do/silo-contracts-v2 node scripts/buildCustomErrorsSelectors.mjs
```

## Użycie w UI

W UI porównujemy HEX selectora z revert data z mapą `customErrorsSelectors.bySelector`.  
Jeśli `bySelector[selectorHex]` istnieje, można wyświetlić nazwę błędu (sygnaturę) zamiast samego hexa.
