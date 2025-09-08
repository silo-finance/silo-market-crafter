## Boilerplate

Create NodeJs boilerplate for web3 app:
- app will be standalone
- style similar to https://silo.finance/
- bolerplat must have just one page - landing page with text "Silo Market Crafter", everything else will be created in next steps.
- app must be easily launch locally
- choose libraries that are current standard for UI web3 but also that are less problematic durring development process, must be well supported
- there should be CI setup with: linter, check if code is compilable
- add basic rus steps to readme

## connect wallet

Add button to connect wallet for MetaMask plugin.

add header with:
- use silo logo from https://silo.finance/, on click it should open landing page.
- 2 menu itemw that will lead to silo finanse page and silo app
- connect button should be on top right
- app style should match https://silo.finance/
- when wallet is connected, diplay also network name and ID
- do not explain how it works

## wizzard

In next few steps we will create wizzard for market creation. This steps must store user input/selection and when user navigate back/forward it must display data. 
Overfiew of steps: each market is created out of 2 Silos. Each silo is a vault for one asset. We will guide user step by step to prepare setup for one Silo, then same steps must be reuse to prepare setup for other silo. Final step will deploy whole market.
Prepare design in a way, that will allow for clean navigation between steps, it will have summary section visible all the time with progress details. Progress section will not only display which step we are on, but also details eg. if some step will deploy a contract, it should display this contract address/name. Details will be specified for each step. Do not "create" them by yourself.

### Step 1 - asset

Implement first step:
- current landing page will be starting point
- add fancy graphics (some fancy web animation) to current landing page, that will present new Silo market ceration
- add button that will start whole process, when user click this button it will start wizzard for and display first step

Step 1 section:
- first step will be to provide asset addresses (text fields)
- when user provide address, verify address format on the fly, if checksum is invalid fix it automatically
- when verification pass, pull metadata about assets: symbol, decimals

Summary section: this should be progress of all setup with all necessady details, details will be provided for every step. Details for step1: 
  - network name
  - token symbol, decimals and address, make addres a link to block explorer (based on network)

### oracle

### IRM setup

### LT, LTV

