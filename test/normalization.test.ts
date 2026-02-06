/**
 * Unit tests for the app's normalization API (display ↔ BigInt).
 *
 * We test only the same methods used in the UI and across the app:
 * - displayNumberToBigint (form/display value → BigInt)
 * - bigintToDisplayNumber (BigInt → display value)
 *
 * We do not test any external library; we test the single conversion API
 * from @/utils/verification/normalization that the UI and other code use.
 */

import { convertWizardTo18Decimals, convert18DecimalsToWizard, bigintToDisplayNumber, displayNumberToBigint, BP2DP_NORMALIZATION } from '@/utils/verification/normalization'

describe('convertWizardTo18Decimals', () => {
  describe('basic percentage conversions', () => {
    it('converts 0% correctly', () => {
      const result = convertWizardTo18Decimals(BigInt(0))
      // Wizard stores as BigInt in on-chain format, so 0% = 0
      expect(result).toBe(BigInt(0))
    })

    it('converts 1% correctly', () => {
      // 1% in on-chain format: 1 * 10^16 = 10000000000000000
      const wizardValue = BigInt('10000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('10000000000000000'))
    })

    it('converts 4% correctly', () => {
      // 4% in on-chain format: 4 * 10^16 = 40000000000000000
      const wizardValue = BigInt('40000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('40000000000000000'))
    })

    it('converts 5% correctly', () => {
      // 5% in on-chain format: 5 * 10^16 = 50000000000000000
      const wizardValue = BigInt('50000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('50000000000000000'))
    })

    it('converts 10% correctly', () => {
      // 10% in on-chain format: 10 * 10^16 = 100000000000000000
      const wizardValue = BigInt('100000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('100000000000000000'))
    })

    it('converts 20% correctly', () => {
      // 20% in on-chain format: 20 * 10^16 = 200000000000000000
      const wizardValue = BigInt('200000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('200000000000000000'))
    })

    it('converts 100% correctly', () => {
      // 100% in on-chain format: 100 * 10^16 = 1000000000000000000
      const wizardValue = BigInt('1000000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('1000000000000000000'))
    })
  })

  describe('decimal precision conversions (5 decimal places)', () => {
    it('converts 0.001% correctly', () => {
      // 0.001% in on-chain format: 0.001 * 10^16 = 10000000000000
      const wizardValue = BigInt('10000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('10000000000000'))
    })

    it('converts 0.01% correctly', () => {
      // 0.01% in on-chain format: 0.01 * 10^16 = 100000000000000
      const wizardValue = BigInt('100000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('100000000000000'))
    })

    it('converts 0.1% correctly', () => {
      // 0.1% in on-chain format: 0.1 * 10^16 = 1000000000000000
      const wizardValue = BigInt('1000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('1000000000000000'))
    })

    it('converts 4.001% correctly', () => {
      // 4.001% in on-chain format: 4.001 * 10^16 = 40010000000000000
      const wizardValue = BigInt('40010000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('40010000000000000'))
    })

    it('converts 4.01% correctly', () => {
      // 4.01% in on-chain format: 4.01 * 10^16 = 40100000000000000
      const wizardValue = BigInt('40100000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('40100000000000000'))
    })

    it('converts 4.12345% correctly', () => {
      // 4.12345% in on-chain format: 4.12345 * 10^16 = 41234500000000000
      const wizardValue = BigInt('41234500000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('41234500000000000'))
    })

    it('converts 4.5% correctly', () => {
      // 4.5% in on-chain format: 4.5 * 10^16 = 45000000000000000
      const wizardValue = BigInt('45000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('45000000000000000'))
    })

    it('converts 4.99% correctly', () => {
      // 4.99% in on-chain format: 4.99 * 10^16 = 49900000000000000
      const wizardValue = BigInt('49900000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('49900000000000000'))
    })

    it('converts 4.99999% correctly', () => {
      // 4.99999% in on-chain format: 4.99999 * 10^16 = 49999900000000000
      const wizardValue = BigInt('49999900000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('49999900000000000'))
    })

    it('converts 75% correctly', () => {
      // 75% in on-chain format: 75 * 10^16 = 750000000000000000
      const wizardValue = BigInt('750000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt('750000000000000000'))
    })
  })

  describe('pass-through behavior (wizard stores BigInt directly)', () => {
    it('returns the same BigInt value (pass-through)', () => {
      const wizardValue = BigInt('50000000000000000')
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(wizardValue)
      expect(result).toBe(BigInt('50000000000000000'))
    })

    it('handles zero correctly', () => {
      const wizardValue = BigInt(0)
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(BigInt(0))
    })

    it('handles very large values correctly', () => {
      const wizardValue = BigInt('1500000000000000000') // 150%
      const result = convertWizardTo18Decimals(wizardValue)
      expect(result).toBe(wizardValue)
      expect(result).toBe(BigInt('1500000000000000000'))
    })

    it('returns bigint type', () => {
      const result = convertWizardTo18Decimals(BigInt('50000000000000000'))
      expect(typeof result).toBe('bigint')
    })
  })
})

describe('convert18DecimalsToWizard', () => {
  describe('basic conversions', () => {
    it('converts 0 correctly', () => {
      const result = convert18DecimalsToWizard(BigInt(0))
      expect(result).toBe(BigInt(0))
    })

    it('converts 0.001% (10000000000000) correctly', () => {
      const onChainValue = BigInt('10000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('10000000000000'))
    })

    it('converts 1% (10000000000000000) correctly', () => {
      const onChainValue = BigInt('10000000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('10000000000000000'))
    })

    it('converts 4% (40000000000000000) correctly', () => {
      const onChainValue = BigInt('40000000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('40000000000000000'))
    })

    it('converts 4.001% (40010000000000000) correctly', () => {
      const onChainValue = BigInt('40010000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('40010000000000000'))
    })

    it('converts 4.01% (40100000000000000) correctly', () => {
      const onChainValue = BigInt('40100000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('40100000000000000'))
    })

    it('converts 5% (50000000000000000) correctly', () => {
      const onChainValue = BigInt('50000000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('50000000000000000'))
    })

    it('converts 100% (1000000000000000000) correctly', () => {
      const onChainValue = BigInt('1000000000000000000')
      const result = convert18DecimalsToWizard(onChainValue)
      expect(result).toBe(onChainValue)
      expect(result).toBe(BigInt('1000000000000000000'))
    })
  })

  describe('round-trip conversion', () => {
    it('converts wizard -> on-chain -> wizard correctly (pass-through)', () => {
      const testCases = [
        BigInt(0),
        BigInt('10000000000000000'), // 1%
        BigInt('40000000000000000'), // 4%
        BigInt('50000000000000000'), // 5%
        BigInt('100000000000000000'), // 10%
        BigInt('200000000000000000'), // 20%
        BigInt('750000000000000000'), // 75%
        BigInt('1000000000000000000') // 100%
      ]
      
      testCases.forEach(wizardValue => {
        const onChain = convertWizardTo18Decimals(wizardValue)
        const backToWizard = convert18DecimalsToWizard(onChain)
        // Should be exact pass-through - no conversion needed
        expect(backToWizard).toBe(wizardValue)
        expect(backToWizard).toBe(onChain)
      })
    })
  })
})

describe('bigintToDisplayNumber (app conversion API: BigInt → display, same as used in UI)', () => {
  describe('basic conversions', () => {
    it('converts 0 correctly', () => {
      const result = bigintToDisplayNumber(BigInt(0))
      expect(result).toBe(0)
    })

    it('converts 0.001% (10000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('10000000000000'))
      // 10000000000000 / 10^16 = 0.001
      expect(result).toBe(0.001)
    })

    it('converts 1% (10000000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('10000000000000000'))
      // 10000000000000000 / 10^16 = 1.0
      expect(result).toBe(1.0)
    })

    it('converts 4% (40000000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('40000000000000000'))
      // 40000000000000000 / 10^16 = 4.0
      expect(result).toBe(4.0)
    })

    it('converts 4.001% (40010000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('40010000000000000'))
      // 40010000000000000 / 10^16 = 4.001
      expect(result).toBe(4.001)
    })

    it('converts 4.01% (40100000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('40100000000000000'))
      // 40100000000000000 / 10^16 = 4.01
      expect(result).toBe(4.01)
    })

    it('converts 5% (50000000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('50000000000000000'))
      // 50000000000000000 / 10^16 = 5.0
      expect(result).toBe(5.0)
    })

    it('converts 100% (1000000000000000000) correctly', () => {
      const result = bigintToDisplayNumber(BigInt('1000000000000000000'))
      // 1000000000000000000 / 10^16 = 100.0
      expect(result).toBe(100.0)
    })
  })
})

describe('displayNumberToBigint (app conversion API: display → BigInt, same as used in UI)', () => {
  describe('basic conversions', () => {
    it('converts 0 correctly', () => {
      const result = displayNumberToBigint(0)
      expect(result).toBe(BigInt(0))
    })

    it('converts 0.001% correctly', () => {
      const result = displayNumberToBigint(0.001)
      // 0.001 * 10^16 = 10000000000000
      expect(result).toBe(BigInt('10000000000000'))
    })

    it('converts 1% correctly', () => {
      const result = displayNumberToBigint(1.0)
      // 1.0 * 10^16 = 10000000000000000
      expect(result).toBe(BigInt('10000000000000000'))
    })

    it('converts 4% correctly', () => {
      const result = displayNumberToBigint(4.0)
      // 4.0 * 10^16 = 40000000000000000
      expect(result).toBe(BigInt('40000000000000000'))
    })

    it('converts 4.001% correctly', () => {
      const result = displayNumberToBigint(4.001)
      // 4.001 * 10^16 = 40010000000000000
      expect(result).toBe(BigInt('40010000000000000'))
    })

    it('converts 4.01% correctly', () => {
      const result = displayNumberToBigint(4.01)
      // 4.01 * 10^16 = 40100000000000000
      expect(result).toBe(BigInt('40100000000000000'))
    })

    it('converts 5% correctly', () => {
      const result = displayNumberToBigint(5.0)
      // 5.0 * 10^16 = 50000000000000000
      expect(result).toBe(BigInt('50000000000000000'))
    })

    it('converts 100% correctly', () => {
      const result = displayNumberToBigint(100.0)
      // 100.0 * 10^16 = 1000000000000000000
      expect(result).toBe(BigInt('1000000000000000000'))
    })
  })

  describe('truncation behavior (no rounding)', () => {
    it('truncates 4.0012345% correctly', () => {
      const result = displayNumberToBigint(4.0012345)
      // Math.trunc(4.0012345 * 10^16) = Math.trunc(40012345000000000) = 40012345000000000
      expect(result).toBe(BigInt('40012345000000000'))
    })

    it('truncates 4.99999% correctly', () => {
      const result = displayNumberToBigint(4.99999)
      // Math.trunc(4.99999 * 10^16) = Math.trunc(49999900000000000) = 49999900000000000
      expect(result).toBe(BigInt('49999900000000000'))
    })
  })

  describe('exact conversion for 10 decimal places (no float precision loss)', () => {
    const FORM_VALUE = '92.9876543219'
    const EXPECTED_BIGINT = BigInt('929876543219000000')

    it('converts form value 92.9876543219 to exact BigInt 929876543219000000', () => {
      const result = displayNumberToBigint(FORM_VALUE)
      expect(result).toBe(EXPECTED_BIGINT)
    })

    it('converts form value 92.9876543219 as number to exact BigInt (string-based path)', () => {
      const result = displayNumberToBigint(92.9876543219)
      expect(result).toBe(EXPECTED_BIGINT)
    })

    it('round-trip: BigInt 929876543219000000 back to display number 92.9876543219', () => {
      const result = bigintToDisplayNumber(EXPECTED_BIGINT)
      expect(result).toBe(92.9876543219)
    })

    it('full round-trip: form value -> BigInt -> display number equals original', () => {
      const big = displayNumberToBigint(FORM_VALUE)
      expect(big).toBe(EXPECTED_BIGINT)
      const back = bigintToDisplayNumber(big)
      expect(back).toBe(92.9876543219)
    })
  })
})

describe('BP2DP_NORMALIZATION constant', () => {
  it('has correct value (10^13)', () => {
    expect(BP2DP_NORMALIZATION).toBe(BigInt(10 ** 13))
    expect(BP2DP_NORMALIZATION).toBe(BigInt('10000000000000'))
  })

  it('is a bigint', () => {
    expect(typeof BP2DP_NORMALIZATION).toBe('bigint')
  })
})
