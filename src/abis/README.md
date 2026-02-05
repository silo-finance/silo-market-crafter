# ABIs – Silo contracts V2 (Foundry artifacts)

Pliki JSON to **artefakty Foundry** skopiowane z repozytorium:

**https://github.com/silo-finance/silo-contracts-v2** (branch: `master`)

W kodzie używany jest **wyłącznie klucz `abi`** z każdego pliku. ABI nie jest nigdzie modyfikowane – używane jest tak, jak w artefakcie (żeby uniknąć błędów przy wysyłaniu transakcji).

| Plik | Źródło w silo-contracts-v2 |
|------|----------------------------|
| `silo/ISiloDeployer.json` | `silo-core/contracts/interfaces/ISiloDeployer.sol` |
| `silo/ISiloLens.json` | `silo-core/contracts/interfaces/ISiloLens.sol` |
| `silo/IInterestRateModelV2.json` | `silo-core/contracts/interfaces/IInterestRateModelV2.sol` (encodowanie struct Config z wyjścia `getConfig`) |
| `oracle/OracleScaler.json` | `silo-oracles/contracts/scaler/OracleScaler.sol` |
| `IERC20.json` | ERC20 (np. z forge-std / openzeppelin) – tokeny w Silo |

Przy aktualizacji protokołu Silo skopiuj ponownie te pliki z powyższych ścieżek (np. z `out/` po `forge build`).
