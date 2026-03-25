# Changelog
All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## 0.22.2 - 2026-03-25
### Updated
- add bg animation

## 0.22.1 - 2026-03-25
### Fixed
- fix background image

## 0.22.0 - 2026-03-25
### Changed
- update UI to match new brand

## 0.21.0 - 2026-03-24
### Added
- discover and switch to blockchain on verification when siloConfig is known

## 0.20.0 - 2026-03-24
### Added
- IRM verification

## 0.19.2 - 2026-03-24
### Fixed
- fix logo path

## 0.19.1 - 2026-03-24
### Updated
- logo

## 0.19.0 - 2026-03-24
### Added
- add support for CustomMethod oracle

## [Unreleased]
## 0.18.2 - 2026-03-19
### Added
- ensure aggregator is not the same for two oracles

### Fixed
- external price

## 0.18.1 - 2026-03-19
### Added
- add verification for price when no oracle

### Updated
- print PTLinear data

## 0.18.0 - 2026-03-19
### Updated
- option to open PR requires price sources

## 0.17.1 - 2026-03-13
### Updated
- option to open PR for market with screenshot

## 0.17.0 - 2026-03-13
### Added
- option to open PR for market

## 0.16.0 - 2026-03-13
### Added
- display pending IRM
- display IRM history

## Updated
- display verification page based on silo address

## 0.15.1 - 2026-03-10
### Updated
- improve visualy verification page

## 0.15.0 - 2026-03-10
### Updated
- improve visualy verification page

## 0.14.0 - 2026-03-10
### Added
- display chainlink info on verification page

## 0.13.0 - 2026-03-09
### Updated
- add check for same quote token

## 0.12.2 - 2026-03-09
### Fixed
- ensure we can input hash for verification
- catch error when base and quote token are the same for chainlink

### Updated
- inprove PTLinear configuration section

### Removed
- remove SiloConfig version check

## 0.12.1 - 2026-03-05
### Fixed
- fix automatic redirection to verification

## 0.12.0 - 2026-03-05
### Added
- check contract versions against repository version
- support for Vault oracle with custom quote
- display IRM config

## 0.11.0 - 2026-03-04
### Updated
- added predefined options for chainlink aggregator, DAO

### Fixed
- fix some UI errors

## 0.10.0 - 2026-03-04
### Updated
- accept url as address
- predefined selector for quote token

## 0.9.1 - 2026-03-03
### Fixed
- fix behaviour on verification page

## 0.9.0 - 2026-03-03
### Added
- add support for manageable oracle
- add support for Silo V3

### Updated
- better validation

### Removed
- remove connected wallet as owner

## 0.8.0 - 2026-02-19
### Updated
- general UI improvements
- decimals offset

## 0.7.3 - 2026-02-18
### Fixed
- general fixes

## 0.7.2 - 2026-02-18
### Fixed
- fix backwards compatibility issue with cache

## 0.7.1 - 2026-02-18
### Fixed
- added clear cache to error page

## 0.7.0 - 2026-02-18
### Updated
- Make Wizard Home Page
- Display versions of all contracts in the verification step.

### Fixed
- fix cache issue by adding option to clear it

## 0.6.0 - 2026-02-16
### Added
- OKX support
- BNB support

### Changed
- lime layout

## 0.5.0 - 2026-02-12
### Added
- Injective support

## 0.4.0 - 2026-02-06
### Added
- market verification

## 0.3.1 - 2026-02-06
### Updated
- general UI improvements

## 0.3.0 - 2026-02-05
### Added
- pendle linear oracle support

### Fixed
- non-borrowable setup

## 0.2.1 - 2026-02-05
### Fixed
- improve error handling for invalid network on market verification

## 0.2.0 - 2026-02-05
### Added
- Configuration Tree

## 0.1.0 - 2026-02-04
### Added
- Oracle support: Chainlink V3 and OracleScaler
- Hook support: SiloHookV1, SiloHookV2, SiloHookV3.
- IRM support: Dynamic Kink Model and legacy IRM V2.
- Alpha disclaimer
