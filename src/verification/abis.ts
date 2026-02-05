export const ownableAbi = ['function owner() view returns (address)']
export const gaugeHookReceiverAbi = ['function configuredGauges(address) view returns (address)']
export const incentivesControllerAbi = ['function SHARE_TOKEN() view returns (address)']
export const siloAbi = ['function factory() view returns (address)']
export const siloFactoryAbi = ['function isSilo(address) view returns (bool)']
export const isiloOracleAbi = ['function quote(uint256,address) view returns (uint256)']
export const erc20MetadataAbi = ['function decimals() view returns (uint8)', 'function symbol() view returns (string)']
export const erc4626Abi = ['function convertToAssets(uint256) view returns (uint256)']
export const pendleLpWrapperAbi = ['function LP() view returns (address)']
export const ptLinearAggregatorAbi = ['function PT() view returns (address)']
export const chainlinkV3OracleAbi = ['function oracleConfig() view returns (address)']
export const chainlinkV3OracleConfigAbi = [
  'function getConfig() view returns (tuple(address primaryAggregator,address secondaryAggregator,uint256 primaryHeartbeat,uint256 secondaryHeartbeat,uint256 normalizationDivider,uint256 normalizationMultiplier,address baseToken,address quoteToken,bool convertToQuote,bool invertSecondPrice))'
]
export const dynamicKinkModelAbi = ['function irmConfig() view returns (address)']
export const dynamicKinkModelFactoryAbi = ['function createdByFactory(address) view returns (bool)']
export const interestRateModelV2Abi = ['function irmConfig() view returns (address)']
export const interestRateModelV2ConfigAbi = [
  'function getConfig() view returns (tuple(int256 uopt,int256 ucrit,int256 ulow,int256 ki,int256 kcrit,int256 klow,int256 klin,int256 beta,int112 ri,int112 Tcrit))'
]
