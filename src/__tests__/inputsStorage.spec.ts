import { describe, it, expect, beforeEach } from 'vitest'
import { DEFAULT_INPUTS, loadInputs, saveInputs } from '@/infrastructure/inputsStorage'

describe('inputsStorage', () => {
  beforeEach(() => {
    localStorage.clear()
  })

  it('round-trips inputs', () => {
    const inputs = { ...DEFAULT_INPUTS, horizonMonths: 42 }
    saveInputs(inputs)
    expect(loadInputs()).toEqual(inputs)
  })

  it('returns null when nothing is stored', () => {
    expect(loadInputs()).toBeNull()
  })

  it('returns null on unparseable data', () => {
    localStorage.setItem('mortgage:inputs:v1', '{ not json')
    expect(loadInputs()).toBeNull()
  })

  it('returns null on a blob of the wrong shape', () => {
    localStorage.setItem('mortgage:inputs:v1', JSON.stringify({ horizonMonths: 12 }))
    expect(loadInputs()).toBeNull()
  })
})
