import { ethers } from 'ethers'
import type { VerificationCheckFactory } from '../types'

const BP2DP_NORMALIZATION = 10n ** 14n

const to18Decimals = (bp: number): bigint => {
  return BigInt(Math.round(bp * 100)) * BP2DP_NORMALIZATION
}

const factory: VerificationCheckFactory = {
  id: 'CheckWizardConfigMatchesOnchain',
  build: (context) => [
    {
      id: 'CheckWizardConfigMatchesOnchain',
      order: 340,
      checkName: 'wizard config matches on-chain values',
      sourceFile: '',
      run: async () => {
        const wizardData = context.wizardData
        if (
          !wizardData?.token0 ||
          !wizardData.token1 ||
          !wizardData.feesConfiguration ||
          !wizardData.borrowConfiguration
        ) {
          return {
            status: 'warning',
            message: 'Wizard data is incomplete, cannot compare configuration'
          }
        }

        const mismatches: string[] = []

        const expectedDaoFee = to18Decimals(wizardData.feesConfiguration.daoFee || 0)
        const expectedDeployerFee = to18Decimals(wizardData.feesConfiguration.deployerFee || 0)

        if (context.config0.daoFee !== expectedDaoFee || context.config1.daoFee !== expectedDaoFee) {
          mismatches.push(
            `daoFee (expected ${expectedDaoFee.toString()} got ${context.config0.daoFee.toString()})`
          )
        }
        if (
          context.config0.deployerFee !== expectedDeployerFee ||
          context.config1.deployerFee !== expectedDeployerFee
        ) {
          mismatches.push(
            `deployerFee (expected ${expectedDeployerFee.toString()} got ${context.config0.deployerFee.toString()})`
          )
        }

        const token0Address = ethers.getAddress(wizardData.token0.address)
        const token1Address = ethers.getAddress(wizardData.token1.address)
        if (ethers.getAddress(context.config0.token) !== token0Address) {
          mismatches.push(`token0 (expected ${token0Address} got ${context.config0.token})`)
        }
        if (ethers.getAddress(context.config1.token) !== token1Address) {
          mismatches.push(`token1 (expected ${token1Address} got ${context.config1.token})`)
        }

        const expectedMaxLtv0 = to18Decimals(wizardData.borrowConfiguration.token0.maxLTV || 0)
        const expectedLt0 = to18Decimals(wizardData.borrowConfiguration.token0.liquidationThreshold || 0)
        const expectedLiqTarget0 = to18Decimals(wizardData.borrowConfiguration.token0.liquidationTargetLTV || 0)
        const expectedLiqFee0 = to18Decimals(wizardData.feesConfiguration.token0.liquidationFee || 0)
        const expectedFlashFee0 = to18Decimals(wizardData.feesConfiguration.token0.flashloanFee || 0)

        if (context.config0.maxLtv !== expectedMaxLtv0) {
          mismatches.push(
            `maxLtv0 (expected ${expectedMaxLtv0.toString()} got ${context.config0.maxLtv.toString()})`
          )
        }
        if (context.config0.lt !== expectedLt0) {
          mismatches.push(
            `lt0 (expected ${expectedLt0.toString()} got ${context.config0.lt.toString()})`
          )
        }
        if (context.config0.liquidationTargetLtv !== expectedLiqTarget0) {
          mismatches.push(
            `liquidationTargetLtv0 (expected ${expectedLiqTarget0.toString()} got ${context.config0.liquidationTargetLtv.toString()})`
          )
        }
        if (context.config0.liquidationFee !== expectedLiqFee0) {
          mismatches.push(
            `liquidationFee0 (expected ${expectedLiqFee0.toString()} got ${context.config0.liquidationFee.toString()})`
          )
        }
        if (context.config0.flashloanFee !== expectedFlashFee0) {
          mismatches.push(
            `flashloanFee0 (expected ${expectedFlashFee0.toString()} got ${context.config0.flashloanFee.toString()})`
          )
        }

        const expectedMaxLtv1 = to18Decimals(wizardData.borrowConfiguration.token1.maxLTV || 0)
        const expectedLt1 = to18Decimals(wizardData.borrowConfiguration.token1.liquidationThreshold || 0)
        const expectedLiqTarget1 = to18Decimals(wizardData.borrowConfiguration.token1.liquidationTargetLTV || 0)
        const expectedLiqFee1 = to18Decimals(wizardData.feesConfiguration.token1.liquidationFee || 0)
        const expectedFlashFee1 = to18Decimals(wizardData.feesConfiguration.token1.flashloanFee || 0)

        if (context.config1.maxLtv !== expectedMaxLtv1) {
          mismatches.push(
            `maxLtv1 (expected ${expectedMaxLtv1.toString()} got ${context.config1.maxLtv.toString()})`
          )
        }
        if (context.config1.lt !== expectedLt1) {
          mismatches.push(
            `lt1 (expected ${expectedLt1.toString()} got ${context.config1.lt.toString()})`
          )
        }
        if (context.config1.liquidationTargetLtv !== expectedLiqTarget1) {
          mismatches.push(
            `liquidationTargetLtv1 (expected ${expectedLiqTarget1.toString()} got ${context.config1.liquidationTargetLtv.toString()})`
          )
        }
        if (context.config1.liquidationFee !== expectedLiqFee1) {
          mismatches.push(
            `liquidationFee1 (expected ${expectedLiqFee1.toString()} got ${context.config1.liquidationFee.toString()})`
          )
        }
        if (context.config1.flashloanFee !== expectedFlashFee1) {
          mismatches.push(
            `flashloanFee1 (expected ${expectedFlashFee1.toString()} got ${context.config1.flashloanFee.toString()})`
          )
        }

        if (mismatches.length === 0) {
          return { status: 'success', message: 'wizard config matches on-chain values' }
        }

        return {
          status: 'failed',
          message: `wizard config does NOT match on-chain values: ${mismatches.join(', ')}`
        }
      }
    }
  ]
}

export default factory
